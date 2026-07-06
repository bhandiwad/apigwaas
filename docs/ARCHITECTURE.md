# Architecture Documentation

## System Architecture

The CloudInfinit API Gateway platform is a multi-layered system designed for enterprise-grade API management. This document describes the architectural decisions, component interactions, and data flows that underpin the platform.

---

## High-Level Architecture

The system is composed of four primary layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                              │
│  React 19 · Tailwind CSS 4 · shadcn/ui · tRPC Client                   │
│  Wizard-driven UI · Tenant switcher · Sync badges · Sify branding       │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP/tRPC (JSON over HTTP POST)
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          Application Layer                               │
│  Express 4 · tRPC 11 · 25 Routers · ~140 Procedures                    │
│  Auth Middleware · RBAC Guards · Input Validation (Zod)                  │
│  Background jobs: alert evaluator · analytics sync                       │
├────────────────────┬────────────────────────┬───────────────────────────┤
│  Gravitee Sync     │  Business Logic        │  Audit & Compliance       │
│  (graviteeSync.ts) │  (routers.ts + db.ts)  │  (SHA-256, immutable log) │
└────────┬───────────┴────────────┬───────────┴───────────────────────────┘
         │                        │
┌────────▼───────────┐  ┌────────▼───────────────────────────────────────┐
│  Gravitee APIM 4.x │  │  Data Layer                                     │
│  Management API v2 │  │  PostgreSQL 16 · 35 Tables · Drizzle ORM        │
│  + v4 API import   │  │  8 migrations · append-only audit log           │
└────────────────────┘  └─────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Architecture

The frontend follows a page-based architecture with shared layout components:

```
App.tsx (Router + Providers)
├── ThemeProvider (light/dark mode)
├── TooltipProvider
├── Toaster (notifications)
└── Router (wouter)
    ├── DashboardLayout (authenticated pages)
    │   ├── Sidebar Navigation (collapsible, section-grouped)
    │   ├── Header (connection status badge, notifications)
    │   └── Content Area (page components)
    └── Public Routes (Signup, NotFound)
```

Each page component follows a consistent pattern:

1. Fetch data using `trpc.*.useQuery()` with appropriate loading states
2. Render data in tables, cards, or charts using shadcn/ui components
3. Handle mutations using `trpc.*.useMutation()` with optimistic updates
4. Show toast notifications for success/error feedback

### Backend Architecture

The backend is a single Express process serving both the API and the built frontend:

```
Express Server (server/_core/index.ts)
├── Static File Serving (Vite build output / Vite middleware in dev)
├── Auth Handlers (/api/auth/*: register, login, reset, accept-invite)
├── tRPC Handler (/api/trpc)
│   ├── Context Builder (session cookie → JWT → user)
│   ├── Public Procedures (no auth required)
│   └── Protected Procedures (auth required)
│       ├── Tenant / Workspace Routers
│       ├── API Router → Gravitee Sync
│       ├── Gateway Router → Gravitee Sync
│       ├── Policy Chain / Masking / DCR / DevPortal Routers → Gravitee Sync
│       ├── Subscription Router → Gravitee Sync
│       ├── Billing / Audit / Analytics Routers
│       └── ... (25 feature routers total)
└── Background jobs (startAlertEvaluator, startAnalyticsSync)
```

### Gravitee Integration Architecture

The Gravitee integration uses a two-layer approach:

**Layer 1: API Client (`gravitee.ts`)**

A typed Axios-based HTTP client that maps to the Gravitee Management API v2 endpoints (`/management/v2/environments/{envId}/…`) and supports v4 native API definitions (including OpenAPI/Swagger import via `_import/swagger`). It handles authentication (Bearer token or basic auth), request retry with exponential backoff, timeout management, a fail-fast health probe, and structured error responses.

**Layer 2: Sync Service (`graviteeSync.ts`)**

A higher-level service that implements the hybrid pattern:

```
Request → Check Connection Status (cached 30s)
         ├── Connected → Forward to Gravitee API
         │               ├── Success → Return Gravitee response + update local DB
         │               └── Failure → Fallback to local DB
         └── Disconnected → Use local DB directly
```

This architecture ensures the platform never fails due to Gravitee unavailability, while providing real-time gateway state when connected.

---

## Data Architecture

### Database Design Principles

1. **Multi-tenancy** — All data tables include a `tenantId` foreign key for tenant isolation
2. **Soft deletes** — Status fields (active/archived/suspended) instead of hard deletes
3. **Audit trail** — The `audit_events` table is append-only with no UPDATE or DELETE operations
4. **Temporal tracking** — All tables include `createdAt` and `updatedAt` timestamps
5. **JSON flexibility** — Configuration fields use JSON columns for schema-flexible data

### Entity Relationship Summary

```
Tenant (1) ──── (N) Workspace (1) ──── (N) API
                                              │
                                    (1) ──── (N) Plan
                                              │
Consumer App (1) ──── (N) Subscription ──── (1) Plan
                                              │
                                    (N) ──── (1) API
```

### Data Flow: API Deployment

```
1. User clicks "Deploy" on an API
2. Frontend calls trpc.gateway.deploy({ apiId, clusterId, tenantId, version, strategy })
3. Router invokes graviteeSync.deployApiHybrid(input)
4. Sync service checks connection status:
   a. If LIVE:
      - Looks up graviteeApiId from local API record
      - Calls gravitee.deployApi(graviteeApiId, label)
      - Creates local deployment record with graviteeDeploymentId
   b. If LOCAL:
      - Creates local deployment record with status "deployed"
5. Audit event created: "api.deployed"
6. Response returned to frontend
7. Frontend invalidates deployment queries
```

---

## Security Architecture

### Authentication Flow

```
Browser → POST /api/auth/login { email, password }
         → Load user by email; verify bcrypt password hash
         → Sign JWT session token
         → Set httpOnly, secure, sameSite cookie
         → Frontend loads with session active
```

Register, reset-password, and accept-invite follow the same bcrypt + JWT pattern. Invitations are backed by `invite_tokens`; tenants may also enable self-registration (`allowSelfRegistration`, `allowedEmailDomains`, `selfRegDefaultRole`).

### Authorization Model

```
Request → tRPC Context Builder
         → Extract session cookie → verify JWT signature
         → Load user from database → inject ctx.user
         → protectedProcedure  : requires ctx.user
         → tenantProcedure      : scopes to ctx.tenantId
         → tenantWriteProcedure : requires platform-admin OR tenant role
                                  owner/admin/developer (null role = view-only)
```

### Data Protection

| Layer | Protection |
|-------|-----------|
| Transport | HTTPS/TLS for all communications |
| Session | httpOnly, secure, sameSite=none cookies with JWT |
| API | Bearer token authentication for Gravitee API calls |
| Database | PostgreSQL over TLS, parameterized queries via Drizzle ORM |
| Secrets | Environment variables, never committed to code |
| Audit | SHA-256 signatures on exported audit logs |
| PII | JSONPath-based data masking at the gateway level |

---

## Scalability Considerations

### Horizontal Scaling

The application is stateless (session in JWT cookie, data in database), enabling horizontal scaling behind a load balancer. The Gravitee health check cache (30-second TTL) ensures minimal overhead from connection status polling.

### Database Scaling

PostgreSQL 16 backs the platform. The schema uses integer primary keys with auto-increment for efficient B-tree indexing, composite indexes on hot query paths (e.g. tenant + createdAt on metering events), and `jsonb` columns for flexible configuration that does not require relational queries. Read scaling is achieved via read replicas; the application is stateless and can run behind a load balancer.

### Gateway Scaling

Gravitee APIM supports multi-node deployments with sharding tags for regional routing. The platform's cluster management interface allows operators to monitor and manage gateway nodes across regions.

---

## Monitoring and Observability

### Internal Metrics

The platform tracks the following metrics through the analytics router:

- Total API call volume (aggregated from usage records)
- Per-API and per-consumer breakdowns
- Latency percentiles (P50, P95, P99)
- Error rates by status code
- Quota utilization per subscription

### Gravitee Metrics

When connected to Gravitee, additional metrics are available:

- Real-time request counts from gateway analytics
- Gateway instance health and resource utilization
- API deployment state and sync status
- Subscription processing times

### Alerting

The alert system is evaluated by a **live background job** (`alertEvaluator.ts`) that runs on a 60-second interval, compares configured thresholds against real metering data, and fires in-app notifications on breach:

- **Metrics**: Error rate, latency P99, quota usage (plus certificate/subscription expiry rules)
- **Evaluation**: Threshold-based with configurable comparison operators, run continuously against `metering_events`
- **Delivery**: In-app notifications; email/Slack/PagerDuty/Webhook channels are configurable per rule

A second background job (`analyticsSync.ts`) aggregates usage/metering data for the analytics dashboard.
