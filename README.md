# CloudInfinit API Gateway as a Service

A production-grade, multi-tenant API Gateway management platform built on **Gravitee APIM**, designed for Indian enterprise compliance (GST, DPDP, RBI CSCRF). The platform provides full lifecycle API management, billing, observability, and SRE tooling through a modern, wizard-driven dashboard with the **Sify / infinitAIZEN** brand identity.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Backend API Reference](#backend-api-reference)
6. [Frontend Pages](#frontend-pages)
7. [Gravitee Integration](#gravitee-integration)
8. [Policy Enforcement](#policy-enforcement)
9. [Authentication and RBAC](#authentication-and-rbac)
10. [Compliance and Security](#compliance-and-security)
11. [Environment Variables](#environment-variables)
12. [Development Setup](#development-setup)
13. [Deployment](#deployment)
14. [Testing](#testing)

---

## Architecture Overview

The platform follows a **hybrid architecture** that bridges a local management database (PostgreSQL) with the live Gravitee APIM Management API. When Gravitee credentials are configured and the gateway is reachable, operations are forwarded to the live gateway and mirrored locally. When the gateway is unreachable, the platform falls back to **Local Mode** using the internal database, so the UI never blocks on gateway availability.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                          │
│  Wizard-driven UI · Sify/infinitAIZEN Branding · tRPC Client        │
│  Tenant/Workspace switcher · API hub · Sync badges                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ tRPC over HTTP (batched)
┌────────────────────────────────▼────────────────────────────────────┐
│                     Backend (Express + tRPC)                         │
│  ~140 Procedures · Hybrid Sync · Audit · Billing · RBAC             │
│  Background jobs: alert evaluator · analytics sync                   │
├─────────────────┬───────────────────────────────┬───────────────────┤
│  PostgreSQL     │     Gravitee Sync Service     │  Policy Composer  │
│  (Drizzle ORM)  │     (graviteeSync.ts)         │  (flows → gateway)│
└────────┬────────┴───────────────┬───────────────┴───────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────────────────────────────┐
│  35 Tables      │    │  Gravitee APIM (v4.x)                        │
│  8 Migrations   │    │  Management API v2 · Token/Basic Auth        │
│  Drizzle ORM    │    │  APIs · Plans · Subscriptions · Flows        │
└─────────────────┘    │  Gateway (traffic) · Elasticsearch (analytics)│
                       └─────────────────────────────────────────────┘
```

The system supports four named subscription tiers: **Starter**, **Business**, **Enterprise**, and **Sovereign**.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, TypeScript, Tailwind CSS 4 | Single-page application |
| UI Components | shadcn/ui, Radix Primitives, Lucide Icons | Consistent design system |
| Charts | Custom lightweight SVG/CSS charts + Recharts primitives | Analytics visualizations |
| Routing | Wouter | Client-side navigation |
| State | TanStack React Query + tRPC | Type-safe data fetching |
| Backend | Express 4, tRPC 11 | API server |
| Database | **PostgreSQL 16** | Persistent storage |
| ORM | Drizzle ORM | Type-safe queries and migrations |
| Gateway | Gravitee APIM 4.x | API gateway engine |
| Analytics store | Elasticsearch | Gravitee gateway analytics backend |
| Auth | Email/password (bcrypt) + JWT session cookies | Authentication |
| Build | Vite 7, esbuild | Development and production builds |
| Testing | Vitest | Unit and integration tests |
| Package manager | pnpm 10 | Dependency management |

---

## Project Structure

```
apigwaas/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── pages/                   # Feature pages (~49 files)
│   │   │   ├── Home.tsx             # Overview dashboard (KPIs, quick actions, activity)
│   │   │   ├── Apis.tsx             # API catalog (filters, sync badges)
│   │   │   ├── ApiCreateWizard.tsx  # /apis/new — guided API creation
│   │   │   ├── ApiDetail.tsx        # API hub (Overview/Design/Plans/Test/Deployments/Portal/Spec tabs)
│   │   │   ├── ApiLifecycle.tsx     # Guided stepper (Draft→Published→Deprecated→Retired)
│   │   │   ├── SubscribeWizard.tsx  # /subscribe — guided subscription
│   │   │   ├── DeployWizard.tsx     # /deployments/new — guided deployment
│   │   │   ├── ConsumerApps.tsx     # App registry + credentials/keys drawer
│   │   │   ├── Subscriptions.tsx    # Subscription approval workflows
│   │   │   ├── Plans.tsx            # Plan configuration
│   │   │   ├── Policies.tsx         # Policy config (incl. IP/CIDR filtering)
│   │   │   ├── Analytics.tsx        # Real-time metrics + requests-over-time chart
│   │   │   ├── Metering.tsx         # Persisted metric-extraction rules + pipeline view
│   │   │   ├── Deployments.tsx      # Deployment history + operation logs
│   │   │   ├── Alerts.tsx           # Threshold alert rules (live evaluator)
│   │   │   ├── DataMasking.tsx      # PII masking rules (gateway-enforced)
│   │   │   └── ...                  # Tenants, Workspaces, Billing, Audit, RBAC, SRE, etc.
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx  # Sidebar + tenant switcher + nav groups
│   │   │   ├── SyncBadge.tsx        # synced / local_only / disconnected indicator
│   │   │   ├── ApiDesignTab.tsx     # API hub tab components
│   │   │   ├── ApiTestTab.tsx
│   │   │   ├── ApiPlansTab.tsx
│   │   │   ├── ApiDeploymentsTab.tsx
│   │   │   ├── ApiPortalTab.tsx
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── contexts/
│   │   │   ├── ThemeContext.tsx     # Light/dark mode
│   │   │   └── TenantContext.tsx    # Admin cross-tenant/workspace switcher
│   │   └── lib/trpc.ts             # tRPC client binding
│   └── index.html
├── server/
│   ├── routers.ts                   # ~140 tRPC procedures across 25 feature routers
│   ├── db.ts                        # Database helpers (Drizzle)
│   ├── gravitee.ts                  # Gravitee Management API client (v2 + v4 import)
│   ├── graviteeSync.ts             # Hybrid sync + unified flow composer
│   ├── alertEvaluator.ts           # Background job: threshold alert evaluation (60s)
│   ├── analyticsSync.ts            # Background job: analytics/usage aggregation
│   ├── _core/                       # Framework plumbing (auth, env, trpc, context)
│   │   ├── auth.ts                 # Email/password register/login/reset + invites
│   │   └── env.ts                  # Validated environment configuration
│   ├── apiFlow.test.ts             # Flow/lifecycle/wizard tests
│   ├── routers.test.ts             # Router validation + CRUD round-trips
│   ├── features.test.ts            # Feature integration (audit, billing, analytics)
│   ├── gateway.test.ts             # Gateway operations (clusters, deployments, DCR, masking)
│   ├── gravitee.test.ts            # Gravitee client hybrid behavior
│   └── auth.logout.test.ts         # Session teardown
├── drizzle/
│   ├── schema.ts                    # 35 tables, 50 enums
│   ├── 0000_bright_quasar.sql ... 0007_metric_extraction_rules.sql   # 8 migrations
│   └── meta/                        # Drizzle journal + snapshots
├── deploy/                          # Docker Compose, Helm, Terraform, scripts
├── docs/                            # Architecture, API reference, deployment, environment
├── shared/                          # Shared types and constants
└── package.json
```

> **Migrations note:** the Drizzle journal is authoritative through `0003`. Migrations `0004`–`0007` are hand-written, idempotent SQL (with `IF NOT EXISTS` / `DO $$ … duplicate_object` guards) applied out-of-band. When adding schema, prefer a hand-written numbered migration rather than `drizzle-kit generate`, which produces a polluted diff against the stale journal.

---

## Database Schema

The platform uses **35 PostgreSQL tables** organized by domain:

| Domain | Tables | Description |
|--------|--------|-------------|
| Identity | `users`, `tenants`, `workspaces`, `invite_tokens` | Multi-tenant hierarchy, tenant roles, invitations, self-registration |
| API Management | `apis`, `plans`, `consumer_apps`, `subscriptions`, `policies` | Core API lifecycle entities |
| Gateway | `gateway_clusters`, `api_deployments`, `policy_chains`, `api_environments` | Gravitee gateway state, deployment history + operation logs |
| Security | `dcr_clients`, `identity_providers`, `masking_rules`, `byok_keys`, `roles`, `role_assignments` | Access control and data protection |
| Observability | `alert_rules`, `event_entrypoints`, `metering_events`, `metric_extraction_rules`, `kafka_reporter_configs`, `audit_events` | Monitoring, custom metrics, compliance |
| Billing | `invoices`, `usage_records` | GST-compliant financial records |
| DPDP Compliance | `dpdp_requests`, `consent_records`, `data_processing_activities` | Data Principal Rights, consent ledger, RoPA |
| Operations | `support_tickets`, `incidents`, `notifications`, `compliance_artifacts`, `developer_portals` | Operational management |

All tables use auto-incrementing integer primary keys with `createdAt`/`updatedAt` timestamps. The `audit_events` table is append-only by design for tamper-evidence.

---

## Backend API Reference

The backend exposes **~140 tRPC procedures across 25 feature routers**. Procedures are guarded by `protectedProcedure` (authenticated), `tenantProcedure` (tenant-scoped), `tenantWriteProcedure` (write role required), or `adminProcedure`.

### Core Management Routers

| Router | Key Procedures | Description |
|--------|-----------|-------------|
| `tenant` | `list`, `create`, `update`, `getById` | Multi-tenant management with KYC/KYB fields (GSTIN, PAN) |
| `workspace` | `list`, `create`, `update`, `delete` | Per-tenant workspace lifecycle |
| `api` | `list`, `create`, `update`, `delete`, `getById`, `importOpenApi`, `checkContextPath`, `testCall`, `publish`, `deprecate`, `retire` | API CRUD, OpenAPI/Swagger import, context-path checks, server-side test proxy, atomic status transitions |
| `plan` | `list`, `create`, `update`, `delete` | Rate-limited plans with quota and pricing |
| `consumerApp` | `list`, `create`, `update`, `regenerateCredentials` | Application registry + credential management |
| `subscription` | `list`, `create`, `approve`, `reject`, `revoke`, `rotateKey` | Subscription workflows + API-key rotation |
| `policy` | `list`, `create`, `update`, `delete`, `deployIpFiltering` | Policy config incl. gateway-enforced IP/CIDR filtering |

### Gateway Routers

| Router | Key Procedures | Description |
|--------|-----------|-------------|
| `gateway` | `clusters`, `createCluster`, `updateCluster`, `deployments`, `deploy`, `undeploy`, `instances`, `connectionStatus`, `startApi`, `stopApi` | Cluster management + live Gravitee sync; `connectionStatus` reports the configurable gateway base URL |
| `policyChain` | `list`, `add`, `update`, `remove` | Ordered policy chains per API |
| `devPortal` | `list`, `create`, `update` | Developer portal configuration |
| `masking` | `rules`, `createRule`, `updateRule`, `deleteRule`, `deployToGateway` | JSONPath masking rules compiled to a gateway policy |
| `dcr` | `clients`, `register`, `rotateSecret`, `updateStatus` | RFC 7591/7592 dynamic client registration |
| `idp` | `list`, `create`, `update` | OIDC/SAML/LDAP identity providers |
| `env` | `list`, `create`, `promote` | Multi-environment promotion (APIOps) |
| `alert` | `rules`, `create`, `channels` | Threshold alerting evaluated by a live background job |
| `event` | `list`, `create`, `update` | Event-native entrypoints (Kafka, MQTT, RabbitMQ, Webhook) |
| `kafkaReporter` | `config`, `update` | Observability event streaming configuration |

### Operations Routers

| Router | Key Procedures | Description |
|--------|-----------|-------------|
| `audit` | `list`, `export` | Immutable audit trail with SHA-256 signed exports (CSV/JSONL) |
| `billing` | `usage`, `invoices`, `createInvoice`, `payments`, `dunning` | GST-compliant billing, dual metering pipeline |
| `analytics` | `dashboard`, `usage`, `metering`, `recordCall`, `simulateTraffic`, `extractionRules`, `createExtractionRule`, `updateExtractionRule`, `deleteExtractionRule` | Real-time metrics + persisted custom metric-extraction rules |
| `rbac` | `roles`, `createRole`, `permissions`, `assign` | Custom roles with a 4-scope permission matrix |
| `compliance` | `artifacts`, `createArtifact`, `byokKeys`, `createByokKey` | SOC 2, ISO 27001, RBI CSCRF, DPDP artifacts |
| `support` | `tickets`, `createTicket`, `updateTicket` | Severity-based ticketing with SLA tracking |
| `status` | `services`, `incidents`, `createIncident` | Service health + incident management |
| `notification` | `list`, `markRead` | In-app notifications (fired by the alert evaluator) |
| `system` | health/version plumbing | Framework/system endpoints |

---

## Frontend Pages

The dashboard is organized into collapsible, section-grouped navigation. Highlights of the modern UX:

### Guided wizards
- **Create API** (`/apis/new`) — multi-step: definition → workspace/backend → review, with live context-path checks.
- **Subscribe** (`/subscribe`) — API + plan → consumer app (existing/new) → subscribe → shows the API key + ready-to-run curl.
- **Deploy** (`/deployments/new`) — API → clusters + strategy (rolling / blue-green / canary) + version → deploy.

### API hub (`/apis/:id`)
A tabbed detail view: **Overview · Design · Plans · Test · Deployments · Portal · Spec**. Publish/Deprecate/Retire run through confirm dialogs and are **atomic** with Gravitee (the DB status only flips on gateway success). A live **Sync badge** shows `synced` / `local_only` / `disconnected`.

### Main
- **Overview** — status pill, quick actions (Create/Import/Subscribe/Deploy), KPI tiles, recent activity feed.
- **Tenants / Workspaces** — CRUD with KYC/KYB, tiers, lifecycle. An admin **tenant/workspace switcher** in the top bar scopes cross-tenant views.

### API management
- **APIs** — catalog with status/protocol filter chips, sync badges, keyboard-navigable cards.
- **API Lifecycle** — guided stepper with a readiness checklist and per-stage CTAs.
- **Plans / Consumer Apps / Subscriptions / Policies** — plan config, app credentials + key rotation drawer, subscription approvals, and policy config including IP/CIDR filtering.

### Gateway
- **Clusters · Deployments · Data Masking · Developer Portal · Event Entrypoints · Environments** — cluster health, deployment history with expandable operation logs, gateway-enforced masking, portal publishing, event protocols, and APIOps promotion.

### Observability
- **Analytics** — real-time volume, top APIs, quota gauges, and a **requests-over-time** chart derived from usage records.
- **Metering** — **persisted** custom metric-extraction rules (create/toggle/delete, backed by the database) and an end-to-end pipeline view.
- **Alerts** — threshold rules evaluated by a live background job that fires notifications.

### Billing · Operations · Platform (SRE)
- **Billing · Payment Methods · Audit · RBAC · Role Assignments · Compliance · Support · Status**, plus the **SRE Dashboard**, **Tenant Lifecycle**, and **GitOps Pipeline** views.

> Some specialized pages (Kafka Reporter, Event Entrypoints, GeoIP Filtering, Payment Methods) are hidden from the default navigation but remain routable; IP Filtering lives under **Policies**, Alerts under **Operations**, and Identity Providers under **Platform**.

---

## Gravitee Integration

The platform integrates with Gravitee APIM 4.x through a **hybrid sync architecture** in two layers.

### Gravitee API Client (`server/gravitee.ts`)

A typed Axios client for the Gravitee **Management API v2** (`/management/v2/environments/{envId}/…`), with support for **v4 native API definitions**:

- **API Management** — list, create, update, delete, **native OpenAPI/Swagger import** (`_import/swagger`, JSON/YAML, OpenAPI 3.x + Swagger 2.0), start, stop, deploy.
- **Plans / Subscriptions / Applications** — full lifecycle (publish/close/deprecate plans; approve/reject subscriptions).
- **Flows & Policies** — read/write API flows; list available policies (`/plugins/policies`).
- **Instances / Analytics / Health / Portal** — gateway instance monitoring, analytics, health, portal APIs.

The client supports Bearer **token** or **basic** auth, configurable retry/backoff, and a **fail-fast health probe** (bounded to a few seconds) so an unreachable-but-configured gateway never hangs the UI.

### Hybrid Sync Service (`server/graviteeSync.ts`)

Provides transparent live→local fallback and owns gateway writes:

1. **Connection status** — cached health check selects live vs. local mode.
2. **API sync** — `createApiHybrid`, `publishApiHybrid` (idempotent `startApi`), `deleteApiHybrid` (closes published plans before delete).
3. **Unified flow composer** — `composeApiFlows(apiId)` + `syncApiFlowsToGateway(apiId)` is the **single writer** of an API's gateway flows, merging design, masking, and IP-filtering flows so no policy clobbers another.
4. **Deployment / instance / portal / subscription sync** — forwarded to Gravitee when live, mirrored locally regardless.

### Connection Modes

| Mode | Badge | Behavior |
|------|-------|----------|
| **Gravitee Live** | Green | Operations forwarded to Gravitee; local DB holds metadata and tenant associations |
| **Local Mode** | Amber | Operations use the local database only — suitable for development and demos |

---

## Policy Enforcement

Policies are compiled and pushed to the gateway (not just stored as metadata):

- **Data masking** — masking rules compile into a Groovy response policy (`onResponseContentScript`, using `JsonSlurper`/`JsonOutput`/`MessageDigest`) and deploy via the flow composer. Supports full replace, partial, SHA-256 hash, and redact.
- **IP / CIDR filtering** — whitelist/blacklist rules compile into a gateway ip-filtering policy.
- **Alerting** — `alertEvaluator.ts` runs on a 60-second interval, evaluating `error_rate`, `latency_p99`, and `quota_usage` against metering events and firing notifications on breach.

> **Enterprise-gated:** country-level **GeoIP** filtering requires the Gravitee EE MaxMind plugin. The OSS engine supports IP/CIDR only, so country-geo is surfaced as EE-gated. Kafka/MQTT entrypoints and external IdP runtimes likewise require the corresponding external infrastructure.

---

## Authentication and RBAC

### Authentication

The platform uses **email/password authentication** with bcrypt-hashed credentials and JWT session cookies (`server/_core/auth.ts`):

- **Register / Login / Reset password** — self-service flows with bcrypt (cost 12).
- **Invitations** — `invite_tokens` back an accept-invite flow for adding users to a tenant with a chosen tenant role.
- **Self-registration** — tenants may opt in (`allowSelfRegistration`, `allowedEmailDomains`, `selfRegDefaultRole`).
- Session cookies are `httpOnly`, `secure`, `sameSite`-scoped; `ctx.user` is populated from the verified JWT on each request.

### Role-Based Access Control

Two complementary layers:

- **Platform role** — `admin` (platform-wide) or `user`.
- **Tenant role** — `owner`, `admin`, `developer`, or `viewer`. Write operations require platform-admin **or** a tenant role of owner/admin/developer (`requireTenantWrite`); a `null` tenant role is view-only.

Custom RBAC roles add a 4-scope permission matrix (platform, workspace, API, application) for finer-grained delegation.

---

## Compliance and Security

### Indian Regulatory Compliance

| Regulation | Implementation |
|-----------|---------------|
| **GST** | Invoices include GSTIN, HSN codes, CGST/SGST/IGST breakdowns, e-invoice format |
| **DPDP Act 2023** | Data Principal Rights portal, consent ledger, and RoPA (`dpdp_requests`, `consent_records`, `data_processing_activities`) |
| **RBI CSCRF** | Compliance artifact mapping with certification roadmap tracking |
| **PCI DSS** | Gateway-enforced masking for credit-card numbers |
| **Aadhaar/PAN** | Pre-built masking categories for Indian identity documents |

### Security Features

- **Gateway-enforced PII masking** — Groovy response policy compiled from masking rules.
- **BYOK** — customer-managed encryption keys with rotation scheduling.
- **HashiCorp Vault** — KV v2 secrets and dynamic credentials.
- **Immutable audit trail** — append-only log with SHA-256 signed exports.
- **IP/CIDR filtering** — gateway-level allow/deny enforcement.
- **DCR with credential rotation** — automated client-secret rotation.
- **AES-256 encryption** — optional `ENCRYPTION_KEY` (64 hex chars) for encrypting sensitive stored values.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | **PostgreSQL** connection string (e.g. `postgresql://user:pass@host:5432/db`) |
| `JWT_SECRET` | Yes | Session-cookie signing secret (minimum 32 characters) |
| `ENCRYPTION_KEY` | No | AES-256 key — exactly 64 hex characters (32 bytes) if set |
| `GRAVITEE_API_URL` | No | Gravitee Management API base URL |
| `GRAVITEE_API_TOKEN` | No | Gravitee Personal Access Token (token auth) |
| `GRAVITEE_API_USER` / `GRAVITEE_API_PASSWORD` | No | Gravitee basic-auth credentials (alternative to token) |
| `GRAVITEE_ORG_ID` | No | Gravitee organization ID (default `DEFAULT`) |
| `GRAVITEE_ENV_ID` | No | Gravitee environment ID (default `DEFAULT`) |
| `GRAVITEE_GATEWAY_URL` | No | Base URL of the gateway that serves API traffic, used by the test console (default `http://localhost:8082`) |
| `ELASTICSEARCH_URL` | No | Gravitee analytics backend (default `http://localhost:9200`) |
| `APP_URL` | No | Public base URL of the app |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS allowlist |
| `NODE_ENV` | No | `development` \| `production` \| `test` |

When Gravitee variables are unset or the gateway is unreachable, the platform runs in **Local Mode** using only PostgreSQL.

---

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL 16 (local, Docker, or managed)

### Installation

```bash
# Clone the repository
git clone https://github.com/bhandiwad/apigwaas.git
cd apigwaas

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env          # then edit DATABASE_URL, JWT_SECRET, etc.

# Apply database migrations (against your PostgreSQL DATABASE_URL)
pnpm drizzle-kit migrate      # runs the committed 0000–0007 SQL migrations

# Start the development server
pnpm dev
```

The application is available at `http://localhost:3000` (the server auto-increments the port if 3000 is busy).

> **Local Postgres via Docker:** `deploy/docker/docker-compose.yml` brings up the full stack (platform app + Postgres 16 + Gravitee APIM + MongoDB + Elasticsearch + Redis + Nginx). For just a database, run a `postgres:16-alpine` container and point `DATABASE_URL` at it.

### Connecting to Gravitee

1. Deploy Gravitee APIM 4.x (or use the compose stack above).
2. Generate a Personal Access Token (Console → User Settings → Tokens), or use basic-auth credentials.
3. Set `GRAVITEE_API_URL`, `GRAVITEE_API_TOKEN` (or `GRAVITEE_API_USER`/`GRAVITEE_API_PASSWORD`), and optionally `GRAVITEE_GATEWAY_URL`.
4. Restart — the header badge switches from **Local Mode** to **Gravitee Live**.

---

## Deployment

The `deploy/` directory contains a multi-stage Dockerfile, Docker Compose stacks (prod/dev/monitoring/Gravitee), an Nginx reverse proxy, Helm charts, Terraform modules, and management scripts. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full guide.

### Production Build

```bash
pnpm build      # Vite (frontend) + esbuild (backend) into a single Node process
pnpm start
```

### Infrastructure Requirements

| Component | Specification |
|-----------|--------------|
| Runtime | Node.js 22+ |
| Memory | 512 MiB minimum, 1 GiB recommended |
| CPU | 1 vCPU minimum |
| Database | **PostgreSQL 16** with TLS |
| Network | Outbound HTTPS to the Gravitee Management API |

> ⚠️ **Known infra inconsistency:** the Docker Compose stack correctly provisions **PostgreSQL 16**, but the Terraform RDS module (`deploy/terraform/modules/rds`) currently provisions **MySQL 8.0**. Since the platform requires PostgreSQL, the Terraform RDS engine must be switched to `postgres` (with the matching parameter-group family and port 5432) before cloud deployment. This is tracked as an IaC fix.

---

## Testing

The project includes **50 passing tests across 6 test files**, run against a real PostgreSQL database (tests create and then clean up their own rows):

```bash
pnpm test                                 # run all tests
pnpm test -- server/gravitee.test.ts      # run a specific file
```

| Test File | Focus |
|-----------|-------|
| `auth.logout.test.ts` | Session teardown |
| `routers.test.ts` | Router validation + CRUD round-trips (incl. metric-extraction rules) |
| `features.test.ts` | Feature integration (audit, billing, analytics) |
| `gateway.test.ts` | Gateway operations (clusters, deployments, DCR, masking) |
| `gravitee.test.ts` | Gravitee client hybrid-mode behavior |
| `apiFlow.test.ts` | Status transitions, context-path checks, wizard create+plan flow |

> Tests hit the live database rather than an isolated test DB. A dedicated test database is recommended to avoid contention with dev data.

---

## License

Proprietary — CloudInfinit / Sify Technologies. All rights reserved.
