# API Reference

All backend APIs are exposed via tRPC over HTTP POST at `/api/trpc`. This document describes every available procedure, its input schema, and expected response.

---

## Authentication

All procedures marked as **protected** require a valid session cookie. The cookie is issued by the email/password auth handlers (`/api/auth/login`, `/api/auth/register`, reset, accept-invite) after verifying a bcrypt password hash. Unauthenticated requests to protected procedures return a `401 UNAUTHORIZED` error.

Procedure guards: `protectedProcedure` (authenticated), `tenantProcedure` (scoped to `ctx.tenantId`), `tenantWriteProcedure` (requires platform-admin or tenant role owner/admin/developer), and `adminProcedure`.

---

## Auth Router

### `auth.me` (Query, Public)

Returns the current authenticated user or `null`.

**Response:**
```typescript
{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
} | null
```

### `auth.logout` (Mutation, Public)

Clears the session cookie and logs out the user.

**Response:** `{ success: true }`

---

## Tenant Router

### `tenant.list` (Query, Protected)

Lists all tenants with optional filtering.

**Input:**
```typescript
{
  status?: "active" | "suspended" | "pending" | "offboarded";
  tier?: "starter" | "business" | "enterprise" | "sovereign";
}
```

**Response:** `Array<Tenant>`

### `tenant.create` (Mutation, Protected)

Creates a new tenant with KYC/KYB information.

**Input:**
```typescript
{
  name: string;
  tier: "starter" | "business" | "enterprise" | "sovereign";
  region: string;
  gstin?: string;
  pan?: string;
  contactEmail: string;
  contactPhone?: string;
}
```

### `tenant.update` (Mutation, Protected)

Updates tenant details including tier changes.

**Input:**
```typescript
{
  id: number;
  name?: string;
  tier?: "starter" | "business" | "enterprise" | "sovereign";
  status?: "active" | "suspended" | "pending" | "offboarded";
  region?: string;
  gstin?: string;
  pan?: string;
}
```

### `tenant.getById` (Query, Protected)

Retrieves a single tenant by ID.

**Input:** `{ id: number }`

---

## Workspace Router

### `workspace.list` (Query, Protected)

Lists workspaces for a tenant.

**Input:** `{ tenantId: number }`

### `workspace.create` (Mutation, Protected)

Creates a new workspace.

**Input:**
```typescript
{
  tenantId: number;
  name: string;
  description?: string;
}
```

### `workspace.update` (Mutation, Protected)

Updates workspace details or status.

**Input:**
```typescript
{
  id: number;
  name?: string;
  description?: string;
  status?: "active" | "archived" | "suspended";
}
```

### `workspace.delete` (Mutation, Protected)

Deletes a workspace (soft delete via status change).

**Input:** `{ id: number }`

---

## API Router

### `api.list` (Query, Protected)

Lists APIs for a tenant, optionally filtered by workspace. Uses hybrid Gravitee sync when connected.

**Input:**
```typescript
{
  tenantId: number;
  workspaceId?: number;
}
```

### `api.create` (Mutation, Protected)

Creates a new API definition. When Gravitee is connected, also creates the API in the gateway.

**Input:**
```typescript
{
  tenantId: number;
  workspaceId: number;
  name: string;
  version: string;
  protocol: "rest" | "graphql" | "grpc" | "websocket" | "kafka" | "mqtt";
  description?: string;
  targetUrl?: string;
}
```

### `api.update` (Mutation, Protected)

Updates API metadata.

**Input:**
```typescript
{
  id: number;
  name?: string;
  version?: string;
  status?: "draft" | "published" | "deprecated" | "retired";
  description?: string;
  targetUrl?: string;
}
```

### `api.delete` (Mutation, Protected)

Deletes an API definition.

**Input:** `{ id: number }`

### `api.getById` (Query, Protected)

Gets detailed API information including Gravitee sync state.

**Input:** `{ id: number }`

### `api.importOpenApi` (Mutation, Protected)

Imports an API from an OpenAPI/Swagger specification (OpenAPI 3.x or Swagger 2.0, JSON or YAML). When Gravitee is connected, imports natively into the gateway via `_import/swagger`.

**Input:**
```typescript
{
  tenantId: number;
  workspaceId: number;
  spec: string;                 // OpenAPI/Swagger JSON or YAML content
  withDocumentation?: boolean;  // also import the spec as portal documentation
}
```

### `api.checkContextPath` (Query, Protected)

Checks whether a gateway context path is available (used by the create wizard).

**Input:** `{ contextPath: string; tenantId?: number; excludeApiId?: number }`

**Response:** `{ available: boolean; conflictingApi?: { id: number; name: string } }`

### `api.testCall` (Mutation, Protected)

Server-side proxy that sends a test request through the gateway (or simulates it in Local Mode) and records a metering event.

**Input:** `{ apiId: number; method?: string; path?: string; headers?: Record<string,string>; body?: string }`

### `api.publish` / `api.deprecate` / `api.retire` (Mutation, Protected)

Atomic status transitions. The local status only changes after the corresponding Gravitee operation succeeds; the real gateway error is surfaced on failure. `retire` closes published plans first.

**Input:** `{ id: number }`

---

## Plan Router

### `plan.list` (Query, Protected)

Lists plans for an API.

**Input:** `{ apiId: number }`

### `plan.create` (Mutation, Protected)

Creates a new plan with rate limiting and pricing. Syncs to Gravitee when connected.

**Input:**
```typescript
{
  apiId: number;
  name: string;
  rateLimit: number;
  rateLimitPeriod: "second" | "minute" | "hour" | "day";
  quotaLimit: number;
  quotaPeriod: "day" | "week" | "month";
  monthlyFee?: string; // Decimal string
  description?: string;
}
```

### `plan.update` (Mutation, Protected)

Updates plan configuration.

**Input:**
```typescript
{
  id: number;
  name?: string;
  rateLimit?: number;
  quotaLimit?: number;
  monthlyFee?: string;
  status?: "active" | "closed" | "deprecated";
}
```

### `plan.delete` (Mutation, Protected)

Deletes a plan (blocked while it has active subscribers). **Input:** `{ id: number }`

---

## Gateway Router

### `gateway.clusters` (Query, Protected)

Lists gateway clusters with live instance data from Gravitee when connected.

**Input:** `{ tenantId: number }`

### `gateway.createCluster` (Mutation, Protected)

Registers a new gateway cluster.

**Input:**
```typescript
{
  tenantId: number;
  name: string;
  region: string;
  shardingTags?: string;
  endpoint?: string;
}
```

### `gateway.deployments` (Query, Protected)

Lists API deployments with live sync status from Gravitee.

**Input:** `{ tenantId: number; clusterId?: number }`

### `gateway.deploy` (Mutation, tenant-write)

Deploys an API to one or more gateway clusters. Triggers Gravitee deployment when connected; if the API isn't yet on the gateway it is published (with a default plan) as part of the deploy.

**Input:**
```typescript
{
  apiId: number;
  clusterIds: number[] | "all";  // specific clusters, or every registered cluster
  version: string;
  strategy: "rolling" | "blue_green" | "canary";
}
```

### `gateway.undeploy` (Mutation, Protected)

Undeploys (retires) a deployment from its cluster.

**Input:** `{ id: number }`  // the deployment id

### `gateway.instances` (Query, Protected)

Lists live gateway instances from Gravitee.

**Response:** Array of Gravitee instance objects with hostname, IP, status, and version.

### `gateway.connectionStatus` (Query, Protected)

Returns the current Gravitee connection status.

**Response:**
```typescript
{
  connected: boolean;
  mode: "live" | "local";
  version?: string;
  gatewayBaseUrl: string; // configurable via GRAVITEE_GATEWAY_URL
  error?: string;
}
```

### `gateway.startApi` (Mutation, Protected)

Starts an API on the Gravitee gateway.

**Input:** `{ apiId: number }`

### `gateway.stopApi` (Mutation, Protected)

Stops an API on the Gravitee gateway.

**Input:** `{ apiId: number }`

---

## Audit Router

### `audit.list` (Query, Protected)

Queries the immutable audit log with filtering.

**Input:**
```typescript
{
  tenantId?: number;
  actor?: string;
  action?: string;
  resource?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}
```

**Response:** `{ events: Array<AuditEvent>; total: number }`

### `audit.export` (Mutation, Protected)

Exports audit logs with SHA-256 tamper-evidence signature.

**Input:**
```typescript
{
  tenantId?: number;
  format: "csv" | "jsonl";
  startDate?: string;
  endDate?: string;
}
```

**Response:**
```typescript
{
  data: string; // CSV or JSONL content
  signature: string; // SHA-256 hash
  recordCount: number;
  exportedAt: string;
}
```

---

## Billing Router

### `billing.usage` (Query, Protected)

Returns usage aggregates for billing.

**Input:** `{ tenantId: number; period?: string }`

### `billing.invoices` (Query, Protected)

Lists invoices for a tenant.

**Input:** `{ tenantId: number }`

### `billing.createInvoice` (Mutation, Protected)

Generates a GST-compliant invoice.

**Input:**
```typescript
{
  tenantId: number;
  periodStart: string;
  periodEnd: string;
  lineItems: Array<{ description: string; amount: string; quantity: number }>;
  gstRate?: number;
}
```

### `billing.payments` (Query, Protected)

Lists payment history.

**Input:** `{ tenantId: number }`

### `billing.dunning` (Query, Protected)

Returns failed payment alerts requiring attention.

**Input:** `{ tenantId: number }`

---

## Analytics Router

### `analytics.dashboard` (Query, Protected)

Returns the platform/tenant KPI summary (APIs, consumer apps, subscriptions, workspaces, call totals). Platform admins with no `tenantId` get platform-wide stats.

**Input:** `{ tenantId?: number }`

### `analytics.usage` (Query, Protected)

Returns usage records (per-API calls, errors, latency, `date`) for charts such as top-APIs and requests-over-time.

**Input:** `{ tenantId?: number; startDate?: string; endDate?: string }`

### `analytics.metering` (Query, Protected)

Returns metering events for a pipeline (dual: customer-facing + Sify-side).

**Input:** `{ tenantId?: number; pipeline?: "customer_facing" | "sify_internal" }`

### `analytics.recordCall` (Mutation, Protected)

Records a single API call into `metering_events` + `usage_records` (used by the test console).

**Input:** `{ apiId: number; statusCode?: number; latencyMs?: number; method?: string }`

### `analytics.simulateTraffic` (Mutation, Protected)

Seeds synthetic traffic for demos/analytics. **Input:** `{ count?: number }`

### Metric Extraction Rules (persisted)

Custom metric-extraction rules for the metering pipeline, backed by the `metric_extraction_rules` table.

- `analytics.extractionRules` (Query, tenant) → `Array<MetricExtractionRule>`
- `analytics.createExtractionRule` (Mutation, tenant) — `{ name, extractionPath, extractionType?: "jsonpath"|"header"|"regex"|"groovy", metricType?: "counter"|"gauge"|"histogram"|"summary", kafkaTopic? }`
- `analytics.updateExtractionRule` (Mutation, tenant) — `{ id, enabled?, extractionPath?, extractionType?, metricType?, kafkaTopic? }`
- `analytics.deleteExtractionRule` (Mutation, tenant) — `{ id }`

---

## RBAC Router

### `rbac.roles` (Query, Protected)

Lists custom roles for a tenant.

**Input:** `{ tenantId: number }`

### `rbac.createRole` (Mutation, Protected)

Creates a custom role with permission matrix.

**Input:**
```typescript
{
  tenantId: number;
  name: string;
  description?: string;
  scope: "platform" | "workspace" | "api" | "application";
  permissions: Record<string, boolean>; // JSON permission matrix
}
```

### `rbac.permissions` (Query, Protected)

Returns the full permission matrix for a role.

**Input:** `{ roleId: number }`

### `rbac.assign` (Mutation, Protected)

Assigns a role to a user.

**Input:**
```typescript
{
  userId: number;
  roleId: number;
  tenantId: number;
  scope: string;
  scopeId?: number;
}
```

---

## Additional Routers

The following routers follow similar patterns (list, create, update, delete):

| Router | Key Procedures |
|--------|---------------|
| `consumerApp` | `list`, `create`, `update`, `regenerateCredentials` |
| `subscription` | `list`, `create`, `approve`, `reject`, `revoke`, `rotateKey` |
| `policy` | `list`, `create`, `update`, `delete`, `deployIpFiltering` |
| `policyChain` | `list`, `add`, `update`, `remove` |
| `devPortal` | `list`, `create`, `update` |
| `dcr` | `clients`, `register`, `rotateSecret`, `updateStatus` |
| `masking` | `rules`, `createRule`, `updateRule`, `deleteRule`, `deployToGateway` |
| `idp` | `list`, `create`, `update` |
| `env` | `list`, `create`, `promote` |
| `alert` | `rules`, `create`, `channels` (evaluated by the `alertEvaluator` background job) |
| `event` | `list`, `create`, `update` (Kafka/MQTT/RabbitMQ/Webhook entrypoints) |
| `kafkaReporter` | `config`, `update` |
| `notification` | `list`, `markRead` |
| `compliance` | `artifacts`, `createArtifact`, `byokKeys`, `createByokKey` |
| `support` | `tickets`, `createTicket`, `updateTicket` |
| `status` | `services`, `incidents`, `createIncident` |

---

## Error Handling

All procedures return structured tRPC errors:

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid session |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `BAD_REQUEST` | 400 | Invalid input (Zod validation failure) |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

Error responses include a `message` field with human-readable details and a `code` field for programmatic handling.
