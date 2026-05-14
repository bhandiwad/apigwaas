# Architecture Documentation

## System Architecture

The CloudInfinit API Gateway platform is a multi-layered system designed for enterprise-grade API management. This document describes the architectural decisions, component interactions, and data flows that underpin the platform.

---

## High-Level Architecture

The system is composed of four primary layers:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                              │
│  React 19 · Tailwind CSS 4 · shadcn/ui · Recharts · tRPC Client        │
│  38 Feature Pages · DashboardLayout · infinitAIZEN Branding             │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTP/tRPC (JSON over HTTP POST)
┌─────────────────────────────────▼───────────────────────────────────────┐
│                          Application Layer                               │
│  Express 4 · tRPC 11 · 20 Routers · 91 Procedures                      │
│  Auth Middleware · RBAC Guards · Input Validation (Zod)                  │
├────────────────────┬────────────────────────┬───────────────────────────┤
│  Gravitee Sync     │  Business Logic        │  Audit & Compliance       │
│  (graviteeSync.ts) │  (routers.ts + db.ts)  │  (SHA-256, immutable log) │
└────────┬───────────┴────────────┬───────────┴───────────────────────────┘
         │                        │
┌────────▼───────────┐  ┌────────▼───────────────────────────────────────┐
│  Gravitee APIM     │  │  Data Layer                                     │
│  Management API    │  │  TiDB/MySQL · 29 Tables · Drizzle ORM           │
│  (REST v2)         │  │  S3 Object Storage · File Uploads               │
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
├── Static File Serving (Vite build output)
├── OAuth Callback Handler (/api/oauth/callback)
├── Storage Proxy (/manus-storage/*)
├── tRPC Handler (/api/trpc)
│   ├── Context Builder (session → user)
│   ├── Public Procedures (no auth required)
│   └── Protected Procedures (auth required)
│       ├── Tenant Router
│       ├── Workspace Router
│       ├── API Router → Gravitee Sync
│       ├── Gateway Router → Gravitee Sync
│       ├── Policy Chain Router → Gravitee Sync
│       ├── DCR Router → Gravitee Sync
│       ├── DevPortal Router → Gravitee Sync
│       ├── Subscription Router → Gravitee Sync
│       ├── Billing Router
│       ├── Audit Router
│       ├── Analytics Router → Gravitee Analytics
│       └── ... (20 routers total)
└── Heartbeat Handler (scheduled tasks)
```

### Gravitee Integration Architecture

The Gravitee integration uses a two-layer approach:

**Layer 1: API Client (`gravitee.ts`)**

A typed Axios-based HTTP client that maps to the Gravitee Management API v2 endpoints. It handles authentication (Bearer token), request retry with exponential backoff, timeout management, and structured error responses.

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
Browser → /api/oauth/callback?code=xxx&state=yyy
         → Validate OAuth code with Manus OAuth server
         → Upsert user in local database
         → Sign JWT session token
         → Set httpOnly, secure, sameSite cookie
         → Redirect to frontend with session active
```

### Authorization Model

```
Request → tRPC Context Builder
         → Extract session cookie
         → Verify JWT signature
         → Load user from database
         → Inject ctx.user into procedure
         → protectedProcedure checks ctx.user exists
         → Business logic checks ctx.user.role for admin operations
```

### Data Protection

| Layer | Protection |
|-------|-----------|
| Transport | HTTPS/TLS for all communications |
| Session | httpOnly, secure, sameSite=none cookies with JWT |
| API | Bearer token authentication for Gravitee API calls |
| Database | TLS connection, parameterized queries via Drizzle ORM |
| Secrets | Environment variables, never committed to code |
| Audit | SHA-256 signatures on exported audit logs |
| PII | JSONPath-based data masking at the gateway level |

---

## Scalability Considerations

### Horizontal Scaling

The application is stateless (session in JWT cookie, data in database), enabling horizontal scaling behind a load balancer. The Gravitee health check cache (30-second TTL) ensures minimal overhead from connection status polling.

### Database Scaling

TiDB provides horizontal scaling for the database layer. The schema uses integer primary keys with auto-increment for efficient B-tree indexing. JSON columns are used for flexible configuration data that does not require relational queries.

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

The alert system supports configurable thresholds with multi-channel delivery:

- **Channels**: Email, Slack, PagerDuty, Webhook
- **Metrics**: Error rate, latency P99, quota usage, certificate expiry, subscription expiry
- **Evaluation**: Threshold-based with configurable comparison operators and time windows
