# CloudInfinit API Gateway as a Service

A production-grade, multi-tenant API Gateway management platform built on **Gravitee APIM**, designed for Indian enterprise compliance (GST, DPDP, RBI CSCRF). The platform provides full lifecycle API management, billing, observability, and SRE tooling through an intuitive dashboard with the **infinitAIZEN** brand identity.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Backend API Reference](#backend-api-reference)
6. [Frontend Pages](#frontend-pages)
7. [Gravitee Integration](#gravitee-integration)
8. [Authentication and RBAC](#authentication-and-rbac)
9. [Compliance and Security](#compliance-and-security)
10. [Environment Variables](#environment-variables)
11. [Development Setup](#development-setup)
12. [Deployment](#deployment)
13. [Testing](#testing)

---

## Architecture Overview

The platform follows a **hybrid architecture** that bridges a local management database with the live Gravitee APIM Management API. When Gravitee credentials are configured and the gateway is reachable, all operations are forwarded to the live gateway. When disconnected, the platform operates in local/demo mode using the internal database.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19)                          │
│  Dashboard UI · Sify/infinitAIZEN Branding · 38 Feature Pages      │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ tRPC over HTTP
┌────────────────────────────────▼────────────────────────────────────┐
│                     Backend (Express + tRPC)                         │
│  91 Procedures · Hybrid Sync · Audit · Billing · RBAC              │
├─────────────────┬───────────────────────────────┬───────────────────┤
│  Local Database │     Gravitee Sync Service     │  S3 Storage       │
│  (TiDB/MySQL)   │     (graviteeSync.ts)         │  (File uploads)   │
└────────┬────────┴───────────────┬───────────────┴───────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌─────────────────────────────────────────────┐
│  29 Tables      │    │  Gravitee APIM Management API               │
│  Drizzle ORM    │    │  REST v2 · Bearer Token Auth                │
│  Migrations     │    │  APIs · Plans · Subscriptions · Instances   │
└─────────────────┘    └─────────────────────────────────────────────┘
```

The system supports four named subscription tiers: **Starter**, **Business**, **Enterprise**, and **Sovereign**.

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19, TypeScript, Tailwind CSS 4 | Single-page application |
| UI Components | shadcn/ui, Radix Primitives, Lucide Icons | Consistent design system |
| Charts | Recharts | Analytics visualizations |
| Routing | Wouter | Client-side navigation |
| State | TanStack React Query + tRPC | Type-safe data fetching |
| Backend | Express 4, tRPC 11 | API server |
| Database | TiDB (MySQL-compatible) | Persistent storage |
| ORM | Drizzle ORM | Type-safe queries and migrations |
| Gateway | Gravitee APIM | API gateway engine |
| Auth | Manus OAuth + JWT sessions | Authentication |
| Build | Vite 7, esbuild | Development and production builds |
| Testing | Vitest | Unit and integration tests |

---

## Project Structure

```
cloudinfinit-apigw/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── pages/                   # 38 feature pages
│   │   │   ├── Home.tsx             # Overview dashboard
│   │   │   ├── Tenants.tsx          # Tenant management
│   │   │   ├── Workspaces.tsx       # Workspace management
│   │   │   ├── Apis.tsx             # API catalog
│   │   │   ├── ApiDetail.tsx        # API detail view
│   │   │   ├── ApiLifecycle.tsx     # State machine management
│   │   │   ├── Plans.tsx            # Plan configuration
│   │   │   ├── ConsumerApps.tsx     # Application registry
│   │   │   ├── Subscriptions.tsx    # Subscription management
│   │   │   ├── Policies.tsx         # Policy configuration
│   │   │   ├── GatewayClusters.tsx  # Cluster management
│   │   │   ├── Deployments.tsx      # API deployment status
│   │   │   ├── PolicyChains.tsx     # Flow editor
│   │   │   ├── DataMasking.tsx      # PII masking rules
│   │   │   ├── DevPortal.tsx        # Developer portal config
│   │   │   ├── DcrClients.tsx       # Dynamic client registration
│   │   │   ├── IdentityProviders.tsx # IdP configuration
│   │   │   ├── Environments.tsx     # APIOps promotion
│   │   │   ├── EventEntrypoints.tsx # Kafka/MQTT/RabbitMQ
│   │   │   ├── Alerts.tsx           # Alerting rules
│   │   │   ├── ApiDesigner.tsx      # Visual policy designer
│   │   │   ├── MultiRegion.tsx      # Sharding tags
│   │   │   ├── GeoIpFiltering.tsx   # Country-level filtering
│   │   │   ├── VaultSecrets.tsx     # HashiCorp Vault
│   │   │   ├── KafkaReporter.tsx    # Observability streaming
│   │   │   ├── Metering.tsx         # Dual pipeline metering
│   │   │   ├── Analytics.tsx        # Real-time metrics
│   │   │   ├── Billing.tsx          # GST invoicing
│   │   │   ├── Audit.tsx            # Immutable audit trail
│   │   │   ├── Rbac.tsx             # Role management
│   │   │   ├── RoleAssignments.tsx  # User-role mapping
│   │   │   ├── Compliance.tsx       # Regulatory artifacts
│   │   │   ├── Status.tsx           # Service health
│   │   │   ├── Support.tsx          # Ticket management
│   │   │   ├── SreDashboard.tsx     # Platform SRE view
│   │   │   ├── TenantLifecycle.tsx  # Provisioning workflows
│   │   │   ├── PaymentMethods.tsx   # Payment management
│   │   │   └── Signup.tsx           # Self-service onboarding
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx  # Main layout with sidebar
│   │   │   └── ui/                  # shadcn/ui components
│   │   ├── lib/trpc.ts             # tRPC client binding
│   │   └── index.css               # Theme and branding
│   └── index.html
├── server/
│   ├── routers.ts                   # 91 tRPC procedures
│   ├── db.ts                        # Database helpers
│   ├── gravitee.ts                  # Gravitee API client
│   ├── graviteeSync.ts             # Hybrid sync service
│   ├── storage.ts                   # S3 file storage
│   ├── routers.test.ts             # Router unit tests
│   ├── features.test.ts            # Feature integration tests
│   ├── gateway.test.ts             # Gateway-specific tests
│   ├── gravitee.test.ts            # Gravitee client tests
│   └── _core/                       # Framework plumbing
├── drizzle/
│   ├── schema.ts                    # 29 database tables
│   └── 0001_huge_quasimodo.sql     # Initial migration
├── shared/                          # Shared types and constants
└── package.json
```

---

## Database Schema

The platform uses 29 database tables organized by domain:

| Domain | Tables | Description |
|--------|--------|-------------|
| Identity | `users`, `tenants`, `workspaces` | Multi-tenant organization hierarchy |
| API Management | `apis`, `plans`, `consumer_apps`, `subscriptions`, `policies` | Core API lifecycle entities |
| Gateway | `gateway_clusters`, `api_deployments`, `policy_chains`, `api_environments` | Gravitee gateway state |
| Security | `dcr_clients`, `identity_providers`, `masking_rules`, `byok_keys`, `roles`, `role_assignments` | Access control and data protection |
| Observability | `alert_rules`, `event_entrypoints`, `metering_events`, `audit_events` | Monitoring and compliance |
| Billing | `invoices`, `usage_records` | GST-compliant financial records |
| Operations | `support_tickets`, `incidents`, `notifications`, `compliance_artifacts`, `developer_portals` | Operational management |

All tables use auto-incrementing integer primary keys with `createdAt` and `updatedAt` timestamps. The audit events table is append-only by design to ensure tamper-evidence.

---

## Backend API Reference

The backend exposes 91 tRPC procedures organized into 20 routers:

### Core Management Routers

| Router | Procedures | Description |
|--------|-----------|-------------|
| `tenant` | `list`, `create`, `update`, `getById` | Multi-tenant organization management with KYC/KYB fields (GSTIN, PAN) |
| `workspace` | `list`, `create`, `update`, `delete` | Per-tenant workspace lifecycle (active, archived, suspended) |
| `api` | `list`, `create`, `update`, `delete`, `getById`, `importOpenApi` | API CRUD with OpenAPI import and Gravitee sync |
| `plan` | `list`, `create`, `update` | Rate-limited plans with quota and pricing configuration |
| `consumerApp` | `list`, `create`, `update`, `regenerateCredentials` | Application registry with client credential management |
| `subscription` | `list`, `create`, `update` | Consumer-to-plan subscription management |
| `policy` | `list`, `create`, `update`, `delete` | Policy configuration (masking, rate limit, GeoIP, vault) |

### Gateway Routers

| Router | Procedures | Description |
|--------|-----------|-------------|
| `gateway` | `clusters`, `createCluster`, `updateCluster`, `deployments`, `deploy`, `undeploy`, `instances`, `connectionStatus`, `startApi`, `stopApi` | Gateway cluster management with live Gravitee sync |
| `policyChain` | `list`, `add`, `update`, `remove` | Ordered policy chain management per API |
| `devPortal` | `list`, `create`, `update` | Developer portal configuration and theming |
| `dcr` | `clients`, `register`, `rotateSecret`, `updateStatus` | RFC 7591/7592 dynamic client registration |
| `masking` | `rules`, `createRule`, `updateRule`, `deleteRule` | JSONPath-based data masking with pre-built rulesets |
| `idp` | `list`, `create`, `update` | OIDC/SAML/LDAP identity provider configuration |
| `environment` | `list`, `create`, `promote` | Multi-environment promotion pipeline (APIOps) |
| `alert` | `rules`, `create`, `channels` | Threshold-based alerting with multi-channel delivery |
| `eventEntrypoint` | `list`, `create`, `update` | Event-native protocol support (Kafka, MQTT, RabbitMQ, Webhook) |

### Operations Routers

| Router | Procedures | Description |
|--------|-----------|-------------|
| `audit` | `list`, `export` | Immutable audit trail with SHA-256 signed exports (CSV/JSONL) |
| `billing` | `usage`, `invoices`, `createInvoice`, `payments`, `dunning` | GST-compliant billing with dual metering pipeline |
| `analytics` | `dashboard`, `topApis`, `topConsumers`, `latencyTrends`, `metering`, `gravitee` | Real-time analytics and platform metrics |
| `rbac` | `roles`, `createRole`, `permissions`, `assign` | Custom role definitions with 4-scope permission matrix |
| `compliance` | `artifacts`, `createArtifact`, `byokKeys`, `createByokKey` | SOC 2, ISO 27001, RBI CSCRF artifact management |
| `support` | `tickets`, `createTicket`, `updateTicket` | Severity-based ticket management with SLA tracking |
| `status` | `services`, `incidents`, `createIncident` | Service health monitoring and incident management |

---

## Frontend Pages

The dashboard contains 38 feature pages organized into the following navigation sections:

### Main
- **Overview** — KPI cards (Total APIs, Consumer Apps, Subscriptions, Tenants), platform status, and quick-access navigation cards
- **Tenants** — Full CRUD with KYC/KYB fields, tier management, and status indicators
- **Workspaces** — Per-tenant workspace lifecycle management

### API Management
- **APIs** — Catalog view with OpenAPI import, protocol selection, and workspace filtering
- **API Detail** — Version history, deployment status, and policy attachment
- **API Lifecycle** — Visual state machine (Draft → Published → Deprecated → Retired)
- **Plans** — Rate limit and quota configuration with pricing tiers
- **Consumer Apps** — Application registry with client credential generation and rotation
- **Subscriptions** — Consumer-to-plan mapping with approval workflows
- **Policies** — Multi-type policy configuration (masking, rate limit, GeoIP, vault)

### Gateway
- **Clusters** — Gateway cluster health, node counts, sharding tags, and region assignment
- **Deployments** — Deploy/undeploy APIs to clusters with strategy selection (rolling, blue-green, canary)
- **Policy Chains** — Visual flow editor for request/response/connect phases with ordering and conditions
- **Data Masking** — JSONPath rules with pre-built rulesets for PAN, Aadhaar, credit card, email, phone
- **Developer Portal** — Themed portal configuration, API catalog publishing, signup settings
- **Event Entrypoints** — Kafka, MQTT, RabbitMQ, and Webhook protocol configuration

### Identity and Security
- **DCR Clients** — RFC 7591/7592 dynamic client registration with auto-subscribe and credential rotation
- **Identity Providers** — OIDC/SAML/LDAP configuration with group mapping and JIT provisioning
- **GeoIP Filtering** — Country-level allow/deny lists with MaxMind integration
- **Vault Secrets** — HashiCorp Vault KV v2 integration with dynamic secrets and cache TTL

### Observability
- **Analytics** — Real-time API call volume, top APIs/consumers, latency P99 trends, quota gauges
- **Metering** — Dual pipeline status (customer-facing Lago + Sify-side billing)
- **Kafka Reporter** — Observability event streaming with Avro/JSON format and topic mapping
- **Alerts** — Threshold-based rules with multi-channel notifications (email, Slack, PagerDuty, webhook)
- **API Designer** — Visual policy flow editor with drag-and-drop phases

### Billing
- **Billing** — Usage dashboard, GST-compliant invoices, payment history, dunning alerts
- **Payment Methods** — Card and bank account management

### Operations
- **Audit Trail** — Immutable log viewer with filtering and SHA-256 signed exports
- **RBAC** — Custom role editor with 4-scope permission matrix (platform, workspace, API, application)
- **Role Assignments** — User-to-role mapping interface
- **Compliance** — SOC 2, ISO 27001, RBI CSCRF artifact downloads, DPDP rights portal, BYOK management
- **Support** — Ticket creation with severity-based SLA tracking
- **Status** — Per-region, per-service health with incident timeline

### Platform (SRE)
- **SRE Dashboard** — Platform health, per-tenant drilldown, capacity forecasting, cost attribution, security anomalies
- **Tenant Lifecycle** — Provisioning, suspension, offboarding workflows with data export bundles
- **Multi-Region** — Sharding tag management and region-based routing configuration
- **Environments** — Multi-environment promotion pipeline (dev → staging → production)
- **Signup** — Self-service onboarding with corporate email, KYC/KYB verification, MFA enrollment, tier selection

---

## Gravitee Integration

The platform integrates with Gravitee APIM through a **hybrid sync architecture** implemented in two service layers:

### Gravitee API Client (`server/gravitee.ts`)

A typed HTTP client covering the full Gravitee Management API v2:

- **API Management** — List, create, update, delete, import (OpenAPI and native definitions), start, stop, deploy
- **Plan Management** — List, create, publish, close, deprecate plans per API
- **Subscription Management** — List, create, process (approve/reject), close subscriptions
- **Application Management** — List, create, delete applications (DCR backing)
- **Instance Monitoring** — List gateway instances, get instance details
- **Analytics** — Per-API and platform-level analytics (count, date_histo, group_by)
- **Health Checks** — API health status and availability metrics
- **Policy Management** — List available policies, get/update API flows
- **Portal** — List portal APIs, get portal API details

The client includes automatic retry with exponential backoff (configurable attempts and delay), request timeout handling, and structured error responses.

### Hybrid Sync Service (`server/graviteeSync.ts`)

The sync service provides transparent fallback behavior:

1. **Connection Status** — Cached health checks (30-second interval) determine whether to use live or local mode
2. **API Sync** — Enriches local API records with live Gravitee state (deployment status, lifecycle state)
3. **Deployment Sync** — Forwards deploy/undeploy commands to Gravitee when connected, records locally regardless
4. **Flow Sync** — Fetches live policy flows from Gravitee and maps them to the local policy chain model
5. **Instance Sync** — Retrieves live gateway instances for cluster health enrichment
6. **Portal Sync** — Fetches published portal APIs for developer portal management
7. **Subscription Sync** — Creates subscriptions in both Gravitee and local database

### Connection Modes

| Mode | Badge Color | Behavior |
|------|-------------|----------|
| **Gravitee Live** | Green | All operations forwarded to Gravitee, local DB used for metadata and tenant associations |
| **Local Mode** | Amber | All operations use local database only, suitable for development and demos |

The mode is displayed as a badge in the application header and automatically switches based on Gravitee reachability.

---

## Authentication and RBAC

### Authentication Flow

The platform uses Manus OAuth with JWT session cookies. The flow is:

1. User clicks "Sign In" → redirected to Manus OAuth portal
2. OAuth callback at `/api/oauth/callback` validates the token and creates a session
3. Session cookie is set with secure, httpOnly, sameSite attributes
4. Subsequent requests include the cookie; `ctx.user` is populated in tRPC context

### Role-Based Access Control

The RBAC system supports custom role definitions with a 4-scope permission matrix:

| Scope | Examples |
|-------|----------|
| Platform | Manage tenants, view all workspaces, configure gateway clusters |
| Workspace | Create APIs, manage plans, view analytics within a workspace |
| API | Edit API definition, manage subscriptions, configure policies |
| Application | View credentials, manage subscriptions, access developer portal |

Roles are defined per-tenant with granular permission assignments. The system includes pre-built roles (Platform Admin, Workspace Admin, API Publisher, Consumer) and supports custom role creation.

---

## Compliance and Security

### Indian Regulatory Compliance

| Regulation | Implementation |
|-----------|---------------|
| **GST** | All invoices include GSTIN, HSN codes, CGST/SGST/IGST breakdowns, and e-invoice format support |
| **DPDP Act 2023** | Data Principal Rights portal for access, correction, erasure, and portability requests |
| **RBI CSCRF** | Compliance artifact mapping with certification roadmap tracking |
| **PCI DSS** | Data masking rules for credit card numbers with pre-built rulesets |
| **Aadhaar/PAN** | Pre-built masking categories for Indian identity documents |

### Security Features

- **BYOK (Bring Your Own Key)** — Customer-managed encryption keys with rotation scheduling
- **HashiCorp Vault Integration** — KV v2 secrets, dynamic credentials, and cache TTL configuration
- **Audit Trail** — Immutable, append-only log with SHA-256 signed exports for tamper-evidence
- **GeoIP Filtering** — Country-level allow/deny lists with MaxMind database integration
- **MFA Enrollment** — Required during onboarding for all tenant administrators
- **DCR with Credential Rotation** — Automated client secret rotation with configurable intervals

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL/TiDB connection string |
| `JWT_SECRET` | Yes | Session cookie signing secret |
| `GRAVITEE_API_URL` | No | Gravitee Management API base URL (e.g., `https://apim.example.com`) |
| `GRAVITEE_API_TOKEN` | No | Gravitee Personal Access Token for API authentication |
| `GRAVITEE_ORG_ID` | No | Gravitee organization ID (defaults to `DEFAULT`) |
| `GRAVITEE_ENV_ID` | No | Gravitee environment ID (defaults to `DEFAULT`) |
| `VITE_APP_TITLE` | No | Application title displayed in the browser tab |
| `VITE_APP_LOGO` | No | Logo URL for the application header |
| `OWNER_OPEN_ID` | Yes | OAuth identifier for the platform owner (auto-promoted to admin) |

When `GRAVITEE_API_URL` and `GRAVITEE_API_TOKEN` are not configured or the gateway is unreachable, the platform operates in **Local Mode** using only the internal database.

---

## Development Setup

### Prerequisites

- Node.js 22+
- pnpm 10+
- MySQL 8+ or TiDB (for local development)

### Installation

```bash
# Clone the repository
git clone https://github.com/bhandiwad/apigwaas.git
cd apigwaas

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and other secrets

# Generate and apply database migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate

# Start the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

### Connecting to Gravitee

To enable live gateway synchronization:

1. Deploy Gravitee APIM (version 4.x recommended)
2. Generate a Personal Access Token in Gravitee Console → User Settings → Tokens
3. Set the environment variables:
   ```
   GRAVITEE_API_URL=https://your-gravitee-instance.com
   GRAVITEE_API_TOKEN=your-personal-access-token
   GRAVITEE_ORG_ID=DEFAULT
   GRAVITEE_ENV_ID=DEFAULT
   ```
4. Restart the application — the header badge should switch from "Local Mode" to "Gravitee Live"

---

## Deployment

### Production Build

```bash
# Build the application
pnpm build

# Start in production mode
pnpm start
```

The production build bundles the frontend with Vite and the backend with esbuild into a single Node.js process.

### Infrastructure Requirements

| Component | Specification |
|-----------|--------------|
| Runtime | Node.js 22+ |
| Memory | 512 MiB minimum, 1 GiB recommended |
| CPU | 1 vCPU minimum |
| Database | MySQL 8+ or TiDB with SSL |
| Network | Outbound HTTPS to Gravitee Management API |

---

## Testing

The project includes 43 passing tests across 5 test files:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test -- server/gravitee.test.ts
```

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `auth.logout.test.ts` | 1 | Authentication flow |
| `routers.test.ts` | 11 | Core router validation |
| `features.test.ts` | 13 | Feature integration (audit, billing, analytics) |
| `gateway.test.ts` | 13 | Gateway operations (clusters, deployments, DCR, masking) |
| `gravitee.test.ts` | 5 | Gravitee client hybrid mode behavior |

---

## License

Proprietary — CloudInfinit / Sify Technologies. All rights reserved.
