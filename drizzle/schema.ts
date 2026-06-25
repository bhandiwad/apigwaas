import {
  pgTable, pgEnum, serial, integer, text, varchar,
  timestamp, boolean, numeric, bigint, jsonb, index,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const tenantRoleEnum = pgEnum("tenant_role", ["owner", "admin", "developer", "viewer"]);

export const tenantTierEnum = pgEnum("tenant_tier", ["starter", "business", "enterprise", "sovereign"]);
export const tenantStatusEnum = pgEnum("tenant_status", ["active", "provisioning", "suspended", "offboarding", "terminated"]);

export const workspaceStatusEnum = pgEnum("workspace_status", ["active", "archived", "deleted"]);

export const apiStatusEnum = pgEnum("api_status", ["draft", "published", "deprecated", "retired"]);
export const apiProtocolEnum = pgEnum("api_protocol", ["rest", "graphql", "grpc", "websocket", "kafka", "mqtt"]);

export const rateLimitPeriodEnum = pgEnum("rate_limit_period", ["second", "minute", "hour", "day"]);
export const quotaPeriodEnum = pgEnum("quota_period", ["day", "week", "month"]);
export const planStatusEnum = pgEnum("plan_status", ["active", "closed", "deprecated"]);

export const appStatusEnum = pgEnum("app_status", ["active", "suspended", "revoked"]);

export const subscriptionStatusEnum = pgEnum("subscription_status", ["pending", "approved", "rejected", "revoked", "expired"]);

export const policyTypeEnum = pgEnum("policy_type", ["masking", "rate_limit", "geoip", "vault_secret", "cors", "ip_filtering", "jwt_validation", "oauth2"]);
export const policyPhaseEnum = pgEnum("policy_phase", ["request", "response", "both"]);

export const auditActionTypeEnum = pgEnum("audit_action_type", ["create", "read", "update", "delete", "login", "logout", "approve", "reject", "deploy", "export"]);

export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "issued", "paid", "overdue", "cancelled", "disputed"]);

export const ticketSeverityEnum = pgEnum("ticket_severity", ["S1", "S2", "S3", "S4"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting_customer", "resolved", "closed"]);

export const incidentSeverityEnum = pgEnum("incident_severity", ["minor", "major", "critical"]);
export const incidentStatusEnum = pgEnum("incident_status", ["investigating", "identified", "monitoring", "resolved"]);

export const artifactTypeEnum = pgEnum("artifact_type", ["soc2", "iso27001", "rbi_cscrf", "dpdp", "pentest", "sub_processor", "sla_report"]);
export const artifactStatusEnum = pgEnum("artifact_status", ["current", "expired", "draft"]);

export const roleScopeEnum = pgEnum("role_scope", ["platform", "workspace", "api", "application"]);

export const byokProviderEnum = pgEnum("byok_provider", ["vault", "aws_kms", "azure_keyvault"]);
export const byokStatusEnum = pgEnum("byok_status", ["active", "rotating", "revoked"]);

export const notificationTypeEnum = pgEnum("notification_type", ["incident", "maintenance", "usage_threshold", "invoice", "security", "system"]);

export const meteringPipelineEnum = pgEnum("metering_pipeline", ["customer_facing", "sify_internal"]);

export const clusterTierEnum = pgEnum("cluster_tier", ["shared", "dedicated", "sovereign"]);
export const clusterStatusEnum = pgEnum("cluster_status", ["healthy", "degraded", "offline", "provisioning"]);

export const deploymentStatusEnum = pgEnum("deployment_status", ["pending", "deploying", "deployed", "failed", "undeploying", "undeployed"]);
export const deploymentStrategyEnum = pgEnum("deployment_strategy", ["rolling", "blue_green", "canary"]);
export const syncStatusEnum = pgEnum("sync_status", ["synced", "out_of_sync", "syncing", "error"]);

export const portalStatusEnum = pgEnum("portal_status", ["active", "draft", "disabled"]);

export const maskingActionEnum = pgEnum("masking_action", ["full_replace", "partial", "hash_sha256", "redact"]);
export const maskingCategoryEnum = pgEnum("masking_category", ["pan_card", "aadhaar", "credit_card", "email", "phone", "iban", "ifsc", "custom"]);

export const dcrStatusEnum = pgEnum("dcr_status", ["active", "suspended", "revoked"]);

export const idpTypeEnum = pgEnum("idp_type", ["oidc", "saml", "ldap"]);
export const idpStatusEnum = pgEnum("idp_status", ["active", "inactive", "testing"]);

export const alertTypeEnum = pgEnum("alert_type", ["error_rate", "latency_p99", "quota_usage", "cert_expiry", "subscription_expiry", "custom"]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);

export const entrypointTypeEnum = pgEnum("entrypoint_type", ["kafka", "mqtt", "rabbitmq", "webhook"]);
export const entrypointAuthEnum = pgEnum("entrypoint_auth", ["none", "sasl_plain", "sasl_scram", "mtls", "api_key"]);
export const entrypointStatusEnum = pgEnum("entrypoint_status", ["active", "inactive", "error"]);

export const chainPhaseEnum = pgEnum("chain_phase", ["request", "response", "connect", "subscribe", "publish"]);

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: text("name"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }).default("email"),
  role: userRoleEnum("role").default("user").notNull(),
  tenantRole: tenantRoleEnum("tenantRole"),
  // FK defined with arrow fn to handle forward-reference (tenants defined after users)
  tenantId: integer("tenantId").references(() => tenants.id, { onDelete: "set null" }),
  resetToken: varchar("resetToken", { length: 64 }),
  resetTokenExpiresAt: timestamp("resetTokenExpiresAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  tier: tenantTierEnum("tier").default("starter").notNull(),
  status: tenantStatusEnum("status").default("provisioning").notNull(),
  gstin: varchar("gstin", { length: 20 }),
  pan: varchar("pan", { length: 12 }),
  region: varchar("region", { length: 64 }).default("mumbai"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  address: text("address"),
  kybVerified: boolean("kybVerified").default(false),
  mfaEnabled: boolean("mfaEnabled").default(false),
  allowSelfRegistration: boolean("allowSelfRegistration").default(false).notNull(),
  selfRegDefaultRole: varchar("selfRegDefaultRole", { length: 32 }).default("developer").notNull(),
  allowedEmailDomains: jsonb("allowedEmailDomains").default([]).notNull(),
  maxWorkspaces: integer("maxWorkspaces").default(1),
  maxApis: integer("maxApis").default(5),
  maxConsumerApps: integer("maxConsumerApps").default(50),
  includedCallsPerMonth: bigint("includedCallsPerMonth", { mode: "number" }).default(1000000),
  dataTransferLimitGb: integer("dataTransferLimitGb").default(10),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Invite Tokens ───────────────────────────────────────────────────────────
export const inviteTokens = pgTable("invite_tokens", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull(),
  tenantRole: tenantRoleEnum("tenantRole").default("developer").notNull(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  invitedByUserId: integer("invitedByUserId").references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp("usedAt", { withTimezone: true }),
  usedByUserId: integer("usedByUserId").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("invite_tokens_tenant_idx").on(t.tenantId),
  index("invite_tokens_token_idx").on(t.token),
]);

export type InviteToken = typeof inviteTokens.$inferSelect;

// ─── Workspaces ──────────────────────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().references(() => tenants.id),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull(),
  status: workspaceStatusEnum("status").default("active").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("workspaces_tenant_idx").on(t.tenantId),
]);

export type Workspace = typeof workspaces.$inferSelect;

// ─── APIs ────────────────────────────────────────────────────────────────────
export const apis = pgTable("apis", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspaceId").notNull().references(() => workspaces.id),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 32 }).default("1.0.0"),
  status: apiStatusEnum("status").default("draft").notNull(),
  protocol: apiProtocolEnum("protocol").default("rest").notNull(),
  backendUrl: text("backendUrl"),
  contextPath: varchar("contextPath", { length: 512 }),
  openApiSpec: jsonb("openApiSpec"),
  description: text("description"),
  tags: jsonb("tags"),
  graviteeApiId: varchar("graviteeApiId", { length: 128 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("apis_tenant_idx").on(t.tenantId),
  index("apis_workspace_idx").on(t.workspaceId),
  index("apis_status_idx").on(t.status),
  index("apis_tenant_status_idx").on(t.tenantId, t.status),
  index("apis_workspace_status_idx").on(t.workspaceId, t.status),
]);

export type Api = typeof apis.$inferSelect;

// ─── Plans ───────────────────────────────────────────────────────────────────
export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  apiId: integer("apiId").notNull(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  rateLimit: integer("rateLimit").default(100),
  rateLimitPeriod: rateLimitPeriodEnum("rateLimitPeriod").default("minute"),
  quotaLimit: bigint("quotaLimit", { mode: "number" }).default(10000),
  quotaPeriod: quotaPeriodEnum("quotaPeriod").default("month"),
  pricePerCall: numeric("pricePerCall", { precision: 10, scale: 6 }),
  monthlyFee: numeric("monthlyFee", { precision: 10, scale: 2 }),
  status: planStatusEnum("status").default("active").notNull(),
  autoApprove: boolean("autoApprove").default(true),
  graviteeApiId: varchar("graviteeApiId", { length: 128 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("plans_api_idx").on(t.apiId),
  index("plans_tenant_idx").on(t.tenantId),
]);

export type Plan = typeof plans.$inferSelect;

// ─── Consumer Applications ───────────────────────────────────────────────────
export const consumerApps = pgTable("consumer_apps", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  workspaceId: integer("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  clientId: varchar("clientId", { length: 128 }).notNull().unique(),
  clientSecretHash: varchar("clientSecretHash", { length: 512 }),
  status: appStatusEnum("status").default("active").notNull(),
  ownerEmail: varchar("ownerEmail", { length: 320 }),
  graviteeAppId: varchar("graviteeAppId", { length: 128 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("consumer_apps_tenant_idx").on(t.tenantId),
  index("consumer_apps_tenant_status_idx").on(t.tenantId, t.status),
]);

export type ConsumerApp = typeof consumerApps.$inferSelect;

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  consumerAppId: integer("consumerAppId").notNull(),
  planId: integer("planId").notNull(),
  apiId: integer("apiId").notNull(),
  tenantId: integer("tenantId").notNull(),
  status: subscriptionStatusEnum("status").default("pending").notNull(),
  approvedAt: timestamp("approvedAt", { withTimezone: true }),
  expiresAt: timestamp("expiresAt", { withTimezone: true }),
  graviteeSubId: varchar("graviteeSubId", { length: 128 }),
  apiKey: varchar("apiKey", { length: 256 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("subscriptions_tenant_idx").on(t.tenantId),
  index("subscriptions_consumer_app_idx").on(t.consumerAppId),
  index("subscriptions_api_idx").on(t.apiId),
  index("subscriptions_tenant_status_idx").on(t.tenantId, t.status),
  index("subscriptions_api_status_idx").on(t.apiId, t.status),
]);

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Policies ────────────────────────────────────────────────────────────────
export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  apiId: integer("apiId"),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: policyTypeEnum("type").notNull(),
  phase: policyPhaseEnum("phase").default("both").notNull(),
  configuration: jsonb("configuration"),
  enabled: boolean("enabled").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("policies_tenant_idx").on(t.tenantId),
  index("policies_api_idx").on(t.apiId),
]);

export type Policy = typeof policies.$inferSelect;

// ─── Audit Events ────────────────────────────────────────────────────────────
export const auditEvents = pgTable("audit_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  actorId: integer("actorId"),
  actorName: varchar("actorName", { length: 255 }),
  actorEmail: varchar("actorEmail", { length: 320 }),
  action: varchar("action", { length: 128 }).notNull(),
  actionType: auditActionTypeEnum("actionType").notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 128 }),
  targetName: varchar("targetName", { length: 255 }),
  beforeState: jsonb("beforeState"),
  afterState: jsonb("afterState"),
  sourceIp: varchar("sourceIp", { length: 45 }),
  userAgent: text("userAgent"),
  correlationId: varchar("correlationId", { length: 128 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("audit_tenant_created_idx").on(t.tenantId, t.createdAt),
  index("audit_actor_idx").on(t.actorId),
]);

export type AuditEvent = typeof auditEvents.$inferSelect;

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
  periodStart: timestamp("periodStart", { withTimezone: true }).notNull(),
  periodEnd: timestamp("periodEnd", { withTimezone: true }).notNull(),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  cgst: numeric("cgst", { precision: 12, scale: 2 }).default("0"),
  sgst: numeric("sgst", { precision: 12, scale: 2 }).default("0"),
  igst: numeric("igst", { precision: 12, scale: 2 }).default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  dueDate: timestamp("dueDate", { withTimezone: true }),
  paidAt: timestamp("paidAt", { withTimezone: true }),
  lineItems: jsonb("lineItems"),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  serviceCredits: numeric("serviceCredits", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("invoices_tenant_idx").on(t.tenantId),
  index("invoices_status_idx").on(t.status),
]);

export type Invoice = typeof invoices.$inferSelect;

// ─── Usage Records ───────────────────────────────────────────────────────────
export const usageRecords = pgTable("usage_records", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  workspaceId: integer("workspaceId"),
  apiId: integer("apiId"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  apiCalls: bigint("apiCalls", { mode: "number" }).default(0),
  dataInBytes: bigint("dataInBytes", { mode: "number" }).default(0),
  dataOutBytes: bigint("dataOutBytes", { mode: "number" }).default(0),
  errorCount: integer("errorCount").default(0),
  avgLatencyMs: integer("avgLatencyMs").default(0),
  p99LatencyMs: integer("p99LatencyMs").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("usage_tenant_date_idx").on(t.tenantId, t.date),
]);

export type UsageRecord = typeof usageRecords.$inferSelect;

// ─── Support Tickets ─────────────────────────────────────────────────────────
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId").notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  description: text("description"),
  severity: ticketSeverityEnum("severity").default("S3").notNull(),
  status: ticketStatusEnum("status").default("open").notNull(),
  category: varchar("category", { length: 128 }),
  assignee: varchar("assignee", { length: 255 }),
  slaResponseDue: timestamp("slaResponseDue", { withTimezone: true }),
  slaResolutionDue: timestamp("slaResolutionDue", { withTimezone: true }),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("tickets_tenant_idx").on(t.tenantId),
  index("tickets_user_idx").on(t.userId),
]);

export type SupportTicket = typeof supportTickets.$inferSelect;

// ─── Incidents (Status Page) ─────────────────────────────────────────────────
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  severity: incidentSeverityEnum("severity").default("minor").notNull(),
  status: incidentStatusEnum("status").default("investigating").notNull(),
  affectedServices: jsonb("affectedServices"),
  affectedRegions: jsonb("affectedRegions"),
  startedAt: timestamp("startedAt", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;

// ─── Compliance Artifacts ────────────────────────────────────────────────────
export const complianceArtifacts = pgTable("compliance_artifacts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: artifactTypeEnum("type").notNull(),
  version: varchar("version", { length: 32 }),
  fileUrl: text("fileUrl"),
  validFrom: timestamp("validFrom", { withTimezone: true }),
  validUntil: timestamp("validUntil", { withTimezone: true }),
  status: artifactStatusEnum("status").default("current").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type ComplianceArtifact = typeof complianceArtifacts.$inferSelect;

// ─── Roles ───────────────────────────────────────────────────────────────────
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  scope: roleScopeEnum("scope").default("workspace").notNull(),
  permissions: jsonb("permissions"),
  isSystem: boolean("isSystem").default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("roles_tenant_idx").on(t.tenantId),
]);

export type Role = typeof roles.$inferSelect;

// ─── Role Assignments ────────────────────────────────────────────────────────
export const roleAssignments = pgTable("role_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  roleId: integer("roleId").notNull().references(() => roles.id),
  tenantId: integer("tenantId"),
  workspaceId: integer("workspaceId"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("role_assignments_user_idx").on(t.userId),
  index("role_assignments_tenant_idx").on(t.tenantId),
]);

export type RoleAssignment = typeof roleAssignments.$inferSelect;

// ─── BYOK Keys ───────────────────────────────────────────────────────────────
export const byokKeys = pgTable("byok_keys", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: byokProviderEnum("provider").notNull(),
  keyIdentifier: varchar("keyIdentifier", { length: 512 }).notNull(),
  status: byokStatusEnum("status").default("active").notNull(),
  lastRotatedAt: timestamp("lastRotatedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("byok_tenant_idx").on(t.tenantId),
]);

export type ByokKey = typeof byokKeys.$inferSelect;

// ─── Notifications ───────────────────────────────────────────────────────────
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  userId: integer("userId"),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  message: text("message"),
  read: boolean("read").default(false),
  actionUrl: text("actionUrl"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("notifications_user_idx").on(t.userId),
  index("notifications_tenant_idx").on(t.tenantId),
]);

export type Notification = typeof notifications.$inferSelect;

// ─── Metering Events ────────────────────────────────────────────────────────
export const meteringEvents = pgTable("metering_events", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  apiId: integer("apiId"),
  consumerAppId: integer("consumerAppId"),
  subscriptionId: integer("subscriptionId"),
  planId: integer("planId"),
  endpoint: varchar("endpoint", { length: 512 }),
  method: varchar("method", { length: 10 }),
  statusCode: integer("statusCode"),
  requestBytes: integer("requestBytes").default(0),
  responseBytes: integer("responseBytes").default(0),
  latencyMs: integer("latencyMs").default(0),
  pipeline: meteringPipelineEnum("pipeline").default("customer_facing").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("metering_tenant_created_idx").on(t.tenantId, t.createdAt),
  index("metering_api_idx").on(t.apiId),
  index("metering_tenant_api_created_idx").on(t.tenantId, t.apiId, t.createdAt),
]);

export type MeteringEvent = typeof meteringEvents.$inferSelect;

// ─── Gateway Clusters ───────────────────────────────────────────────────────
export const gatewayClusters = pgTable("gateway_clusters", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 512 }),
  region: varchar("region", { length: 64 }).notNull(),
  tier: clusterTierEnum("tier").default("shared").notNull(),
  status: clusterStatusEnum("status").default("provisioning").notNull(),
  // Gravitee connection details for this cluster/environment
  graviteeEnvId: varchar("graviteeEnvId", { length: 64 }).default("DEFAULT"),
  graviteeOrgId: varchar("graviteeOrgId", { length: 64 }).default("DEFAULT"),
  managementUrl: varchar("managementUrl", { length: 512 }),
  nodeCount: integer("nodeCount").default(0),
  maxNodes: integer("maxNodes").default(10),
  cpuUsagePercent: integer("cpuUsagePercent").default(0),
  memoryUsagePercent: integer("memoryUsagePercent").default(0),
  requestsPerSecond: integer("requestsPerSecond").default(0),
  shardingTags: jsonb("shardingTags"),
  graviteeVersion: varchar("graviteeVersion", { length: 32 }),
  lastSyncAt: timestamp("lastSyncAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type GatewayCluster = typeof gatewayClusters.$inferSelect;

// ─── API Deployments ────────────────────────────────────────────────────────
export const apiDeployments = pgTable("api_deployments", {
  id: serial("id").primaryKey(),
  apiId: integer("apiId").notNull(),
  clusterId: integer("clusterId").notNull(),
  tenantId: integer("tenantId").notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  status: deploymentStatusEnum("status").default("pending").notNull(),
  strategy: deploymentStrategyEnum("strategy").default("rolling").notNull(),
  syncStatus: syncStatusEnum("syncStatus").default("out_of_sync").notNull(),
  deployedAt: timestamp("deployedAt", { withTimezone: true }),
  lastSyncAt: timestamp("lastSyncAt", { withTimezone: true }),
  // Stores the last error message when status=failed, cleared on success
  errorMessage: text("errorMessage"),
  // Full operation log: array of {ts, action, result, detail} entries
  operationLog: jsonb("operationLog").default([]),
  configuration: jsonb("configuration"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("deployments_api_idx").on(t.apiId),
  index("deployments_tenant_idx").on(t.tenantId),
]);

export type ApiDeployment = typeof apiDeployments.$inferSelect;

// ─── Developer Portal Config ────────────────────────────────────────────────
export const developerPortals = pgTable("developer_portals", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  customDomain: varchar("customDomain", { length: 512 }),
  theme: jsonb("theme"),
  logoUrl: text("logoUrl"),
  description: text("description"),
  status: portalStatusEnum("status").default("draft").notNull(),
  enableSignup: boolean("enableSignup").default(true),
  enableAutoApprove: boolean("enableAutoApprove").default(false),
  publishedApis: jsonb("publishedApis"),
  customCss: text("customCss"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("portals_tenant_idx").on(t.tenantId),
]);

export type DeveloperPortal = typeof developerPortals.$inferSelect;

// ─── Data Masking Rules ─────────────────────────────────────────────────────
export const maskingRules = pgTable("masking_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  apiId: integer("apiId"),
  name: varchar("name", { length: 255 }).notNull(),
  jsonPath: varchar("jsonPath", { length: 512 }).notNull(),
  action: maskingActionEnum("action").notNull(),
  replacement: varchar("replacement", { length: 255 }),
  showLastN: integer("showLastN"),
  category: maskingCategoryEnum("category").default("custom").notNull(),
  phase: policyPhaseEnum("phase").default("both").notNull(),
  enabled: boolean("enabled").default(true),
  priority: integer("priority").default(0),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("masking_tenant_idx").on(t.tenantId),
]);

export type MaskingRule = typeof maskingRules.$inferSelect;

// ─── DCR (Dynamic Client Registration) ─────────────────────────────────────
export const dcrClients = pgTable("dcr_clients", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  clientId: varchar("clientId", { length: 128 }).notNull().unique(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientSecretHash: varchar("clientSecretHash", { length: 512 }),
  redirectUris: jsonb("redirectUris"),
  grantTypes: jsonb("grantTypes"),
  responseTypes: jsonb("responseTypes"),
  tokenEndpointAuthMethod: varchar("tokenEndpointAuthMethod", { length: 64 }).default("client_secret_basic"),
  scope: text("scope"),
  autoSubscribePlan: integer("autoSubscribePlan"),
  status: dcrStatusEnum("status").default("active").notNull(),
  registrationAccessToken: varchar("registrationAccessToken", { length: 512 }),
  lastRotatedAt: timestamp("lastRotatedAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("dcr_tenant_idx").on(t.tenantId),
]);

export type DcrClient = typeof dcrClients.$inferSelect;

// ─── Identity Providers (OIDC/SAML) ────────────────────────────────────────
export const identityProviders = pgTable("identity_providers", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: idpTypeEnum("type").notNull(),
  issuerUrl: text("issuerUrl"),
  clientId: varchar("clientId", { length: 255 }),
  clientSecretRef: varchar("clientSecretRef", { length: 255 }),
  discoveryUrl: text("discoveryUrl"),
  samlMetadataUrl: text("samlMetadataUrl"),
  groupClaimMapping: jsonb("groupClaimMapping"),
  roleClaimMapping: jsonb("roleClaimMapping"),
  jitProvisioning: boolean("jitProvisioning").default(true),
  scimEnabled: boolean("scimEnabled").default(false),
  scimEndpoint: text("scimEndpoint"),
  status: idpStatusEnum("status").default("inactive").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("idp_tenant_idx").on(t.tenantId),
]);

export type IdentityProvider = typeof identityProviders.$inferSelect;

// ─── API Environments (for promotion pipeline) ─────────────────────────────
export const apiEnvironments = pgTable("api_environments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  order: integer("order").default(0),
  clusterId: integer("clusterId"),
  gitBranch: varchar("gitBranch", { length: 128 }),
  gitFolder: varchar("gitFolder", { length: 512 }),
  argoAppName: varchar("argoAppName", { length: 255 }),
  autoPromote: boolean("autoPromote").default(false),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("environments_tenant_idx").on(t.tenantId),
]);

export type ApiEnvironment = typeof apiEnvironments.$inferSelect;

// ─── Alert Rules ────────────────────────────────────────────────────────────
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: alertTypeEnum("type").notNull(),
  condition: jsonb("condition"),
  threshold: numeric("threshold", { precision: 10, scale: 2 }),
  duration: varchar("duration", { length: 32 }),
  severity: alertSeverityEnum("severity").default("warning").notNull(),
  channels: jsonb("channels"),
  enabled: boolean("enabled").default(true),
  lastTriggeredAt: timestamp("lastTriggeredAt", { withTimezone: true }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("alerts_tenant_idx").on(t.tenantId),
]);

export type AlertRule = typeof alertRules.$inferSelect;

// ─── Event-Native Entrypoints ───────────────────────────────────────────────
export const eventEntrypoints = pgTable("event_entrypoints", {
  id: serial("id").primaryKey(),
  apiId: integer("apiId").notNull(),
  tenantId: integer("tenantId").notNull(),
  type: entrypointTypeEnum("type").notNull(),
  configuration: jsonb("configuration"),
  topicPattern: varchar("topicPattern", { length: 512 }),
  brokerUrl: text("brokerUrl"),
  authMethod: entrypointAuthEnum("authMethod").default("none"),
  status: entrypointStatusEnum("status").default("inactive").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("entrypoints_api_idx").on(t.apiId),
  index("entrypoints_tenant_idx").on(t.tenantId),
]);

export type EventEntrypoint = typeof eventEntrypoints.$inferSelect;

// ─── Policy Chains (ordered policy execution) ───────────────────────────────
export const policyChains = pgTable("policy_chains", {
  id: serial("id").primaryKey(),
  apiId: integer("apiId").notNull(),
  tenantId: integer("tenantId").notNull(),
  phase: chainPhaseEnum("phase").notNull(),
  policyId: integer("policyId").notNull(),
  order: integer("order").notNull(),
  condition: text("condition"),
  enabled: boolean("enabled").default(true),
  configuration: jsonb("configuration"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("chains_api_idx").on(t.apiId),
  index("chains_tenant_idx").on(t.tenantId),
]);

export type PolicyChain = typeof policyChains.$inferSelect;

// ─── Kafka Reporter Configuration ────────────────────────────────────────────
export const kafkaReporterConfigs = pgTable("kafka_reporter_configs", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull().unique(),
  brokers: text("brokers").notNull().default("localhost:9092"),
  enabled: boolean("enabled").default(false),
  reporters: jsonb("reporters").default([]),
  topicMappings: jsonb("topicMappings").default([]),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type KafkaReporterConfig = typeof kafkaReporterConfigs.$inferSelect;

// ─── DPDP Compliance ─────────────────────────────────────────────────────────

export const dpdpRequestActionEnum = pgEnum("dpdp_request_action", ["access", "correct", "erase", "restrict", "portability", "object", "nomination"]);
export const dpdpRequestStatusEnum = pgEnum("dpdp_request_status", ["pending", "in_progress", "completed", "rejected", "overdue"]);

export const dpdpRequests = pgTable("dpdp_requests", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  userId: integer("userId"),
  action: dpdpRequestActionEnum("action").notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  notes: text("notes"),
  status: dpdpRequestStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("dueDate", { withTimezone: true }).notNull(),
  completedAt: timestamp("completedAt", { withTimezone: true }),
  response: text("response"),
  assignedTo: varchar("assignedTo", { length: 255 }),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("dpdp_requests_tenant_idx").on(t.tenantId),
  index("dpdp_requests_status_idx").on(t.tenantId, t.status),
  index("dpdp_requests_due_idx").on(t.dueDate),
]);

export type DpdpRequest = typeof dpdpRequests.$inferSelect;

export const consentStatusEnum = pgEnum("consent_status", ["granted", "revoked", "expired"]);

export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  apiId: integer("apiId"),
  dataPrincipalId: varchar("dataPrincipalId", { length: 512 }).notNull(),
  purpose: varchar("purpose", { length: 512 }).notNull(),
  status: consentStatusEnum("status").default("granted").notNull(),
  grantedAt: timestamp("grantedAt", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revokedAt", { withTimezone: true }),
  expiresAt: timestamp("expiresAt", { withTimezone: true }),
  consentText: text("consentText"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("consent_tenant_idx").on(t.tenantId),
  index("consent_principal_idx").on(t.tenantId, t.dataPrincipalId),
  index("consent_api_idx").on(t.apiId),
]);

export type ConsentRecord = typeof consentRecords.$inferSelect;

export const legalBasisEnum = pgEnum("legal_basis", ["consent", "contract", "legal_obligation", "legitimate_interest", "vital_interest", "public_task"]);

export const dataProcessingActivities = pgTable("data_processing_activities", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenantId").notNull(),
  name: varchar("name", { length: 512 }).notNull(),
  purpose: text("purpose").notNull(),
  dataCategories: jsonb("dataCategories").default([]),
  dataSources: jsonb("dataSources").default([]),
  recipients: jsonb("recipients").default([]),
  thirdPartyTransfers: jsonb("thirdPartyTransfers").default([]),
  retentionPeriodDays: integer("retentionPeriodDays"),
  legalBasis: legalBasisEnum("legalBasis").notNull(),
  dpdpActSection: varchar("dpdpActSection", { length: 64 }),
  apiIds: jsonb("apiIds").default([]),
  riskLevel: varchar("riskLevel", { length: 32 }).default("low"),
  dpiaConducted: boolean("dpiaConducted").default(false),
  dpiaDate: timestamp("dpiaDate", { withTimezone: true }),
  active: boolean("active").default(true),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index("processing_tenant_idx").on(t.tenantId),
]);

export type DataProcessingActivity = typeof dataProcessingActivities.$inferSelect;
