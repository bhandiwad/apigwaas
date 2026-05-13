import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, boolean, decimal } from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  tenantId: int("tenantId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Tenants ─────────────────────────────────────────────────────────────────
export const tenants = mysqlTable("tenants", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  tier: mysqlEnum("tier", ["starter", "business", "enterprise", "sovereign"]).default("starter").notNull(),
  status: mysqlEnum("status", ["active", "provisioning", "suspended", "offboarding", "terminated"]).default("provisioning").notNull(),
  gstin: varchar("gstin", { length: 20 }),
  pan: varchar("pan", { length: 12 }),
  region: varchar("region", { length: 64 }).default("mumbai"),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 20 }),
  address: text("address"),
  kybVerified: boolean("kybVerified").default(false),
  mfaEnabled: boolean("mfaEnabled").default(false),
  maxWorkspaces: int("maxWorkspaces").default(1),
  maxApis: int("maxApis").default(5),
  maxConsumerApps: int("maxConsumerApps").default(50),
  includedCallsPerMonth: bigint("includedCallsPerMonth", { mode: "number" }).default(1000000),
  dataTransferLimitGb: int("dataTransferLimitGb").default(10),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;

// ─── Workspaces ──────────────────────────────────────────────────────────────
export const workspaces = mysqlTable("workspaces", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 128 }).notNull(),
  status: mysqlEnum("status", ["active", "archived", "deleted"]).default("active").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Workspace = typeof workspaces.$inferSelect;

// ─── APIs ────────────────────────────────────────────────────────────────────
export const apis = mysqlTable("apis", {
  id: int("id").autoincrement().primaryKey(),
  workspaceId: int("workspaceId").notNull(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  version: varchar("version", { length: 32 }).default("1.0.0"),
  status: mysqlEnum("status", ["draft", "published", "deprecated", "retired"]).default("draft").notNull(),
  protocol: mysqlEnum("protocol", ["rest", "graphql", "grpc", "websocket", "kafka", "mqtt"]).default("rest").notNull(),
  backendUrl: text("backendUrl"),
  contextPath: varchar("contextPath", { length: 512 }),
  openApiSpec: json("openApiSpec"),
  description: text("description"),
  tags: json("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Api = typeof apis.$inferSelect;

// ─── Plans ───────────────────────────────────────────────────────────────────
export const plans = mysqlTable("plans", {
  id: int("id").autoincrement().primaryKey(),
  apiId: int("apiId").notNull(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  rateLimit: int("rateLimit").default(100),
  rateLimitPeriod: mysqlEnum("rateLimitPeriod", ["second", "minute", "hour", "day"]).default("minute"),
  quotaLimit: bigint("quotaLimit", { mode: "number" }).default(10000),
  quotaPeriod: mysqlEnum("quotaPeriod", ["day", "week", "month"]).default("month"),
  pricePerCall: decimal("pricePerCall", { precision: 10, scale: 6 }),
  monthlyFee: decimal("monthlyFee", { precision: 10, scale: 2 }),
  status: mysqlEnum("status", ["active", "closed", "deprecated"]).default("active").notNull(),
  autoApprove: boolean("autoApprove").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;

// ─── Consumer Applications ───────────────────────────────────────────────────
export const consumerApps = mysqlTable("consumer_apps", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  workspaceId: int("workspaceId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  clientId: varchar("clientId", { length: 128 }).notNull().unique(),
  clientSecretHash: varchar("clientSecretHash", { length: 512 }),
  status: mysqlEnum("status", ["active", "suspended", "revoked"]).default("active").notNull(),
  ownerEmail: varchar("ownerEmail", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ConsumerApp = typeof consumerApps.$inferSelect;

// ─── Subscriptions ───────────────────────────────────────────────────────────
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  consumerAppId: int("consumerAppId").notNull(),
  planId: int("planId").notNull(),
  apiId: int("apiId").notNull(),
  tenantId: int("tenantId").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "revoked", "expired"]).default("pending").notNull(),
  approvedAt: timestamp("approvedAt"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// ─── Policies ────────────────────────────────────────────────────────────────
export const policies = mysqlTable("policies", {
  id: int("id").autoincrement().primaryKey(),
  apiId: int("apiId"),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["masking", "rate_limit", "geoip", "vault_secret", "cors", "ip_filtering", "jwt_validation", "oauth2"]).notNull(),
  phase: mysqlEnum("phase", ["request", "response", "both"]).default("both").notNull(),
  configuration: json("configuration"),
  enabled: boolean("enabled").default(true),
  priority: int("priority").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Policy = typeof policies.$inferSelect;

// ─── Audit Events ────────────────────────────────────────────────────────────
export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  actorId: int("actorId"),
  actorName: varchar("actorName", { length: 255 }),
  actorEmail: varchar("actorEmail", { length: 320 }),
  action: varchar("action", { length: 128 }).notNull(),
  actionType: mysqlEnum("actionType", ["create", "read", "update", "delete", "login", "logout", "approve", "reject", "deploy", "export"]).notNull(),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 128 }),
  targetName: varchar("targetName", { length: 255 }),
  beforeState: json("beforeState"),
  afterState: json("afterState"),
  sourceIp: varchar("sourceIp", { length: 45 }),
  userAgent: text("userAgent"),
  correlationId: varchar("correlationId", { length: 128 }),
  metadata: json("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull().unique(),
  periodStart: timestamp("periodStart").notNull(),
  periodEnd: timestamp("periodEnd").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  cgst: decimal("cgst", { precision: 12, scale: 2 }).default("0"),
  sgst: decimal("sgst", { precision: 12, scale: 2 }).default("0"),
  igst: decimal("igst", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["draft", "issued", "paid", "overdue", "cancelled", "disputed"]).default("draft").notNull(),
  dueDate: timestamp("dueDate"),
  paidAt: timestamp("paidAt"),
  lineItems: json("lineItems"),
  paymentMethod: varchar("paymentMethod", { length: 64 }),
  serviceCredits: decimal("serviceCredits", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;

// ─── Usage Records ───────────────────────────────────────────────────────────
export const usageRecords = mysqlTable("usage_records", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  workspaceId: int("workspaceId"),
  apiId: int("apiId"),
  date: timestamp("date").notNull(),
  apiCalls: bigint("apiCalls", { mode: "number" }).default(0),
  dataInBytes: bigint("dataInBytes", { mode: "number" }).default(0),
  dataOutBytes: bigint("dataOutBytes", { mode: "number" }).default(0),
  errorCount: int("errorCount").default(0),
  avgLatencyMs: int("avgLatencyMs").default(0),
  p99LatencyMs: int("p99LatencyMs").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UsageRecord = typeof usageRecords.$inferSelect;

// ─── Support Tickets ─────────────────────────────────────────────────────────
export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  userId: int("userId").notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["S1", "S2", "S3", "S4"]).default("S3").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "waiting_customer", "resolved", "closed"]).default("open").notNull(),
  category: varchar("category", { length: 128 }),
  assignee: varchar("assignee", { length: 255 }),
  slaResponseDue: timestamp("slaResponseDue"),
  slaResolutionDue: timestamp("slaResolutionDue"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;

// ─── Incidents (Status Page) ─────────────────────────────────────────────────
export const incidents = mysqlTable("incidents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 512 }).notNull(),
  description: text("description"),
  severity: mysqlEnum("severity", ["minor", "major", "critical"]).default("minor").notNull(),
  status: mysqlEnum("status", ["investigating", "identified", "monitoring", "resolved"]).default("investigating").notNull(),
  affectedServices: json("affectedServices"),
  affectedRegions: json("affectedRegions"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;

// ─── Compliance Artifacts ────────────────────────────────────────────────────
export const complianceArtifacts = mysqlTable("compliance_artifacts", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["soc2", "iso27001", "rbi_cscrf", "dpdp", "pentest", "sub_processor", "sla_report"]).notNull(),
  version: varchar("version", { length: 32 }),
  fileUrl: text("fileUrl"),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  status: mysqlEnum("status", ["current", "expired", "draft"]).default("current").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ComplianceArtifact = typeof complianceArtifacts.$inferSelect;

// ─── Roles ───────────────────────────────────────────────────────────────────
export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description"),
  scope: mysqlEnum("scope", ["platform", "workspace", "api", "application"]).default("workspace").notNull(),
  permissions: json("permissions"),
  isSystem: boolean("isSystem").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Role = typeof roles.$inferSelect;

// ─── Role Assignments ────────────────────────────────────────────────────────
export const roleAssignments = mysqlTable("role_assignments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  roleId: int("roleId").notNull(),
  tenantId: int("tenantId"),
  workspaceId: int("workspaceId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RoleAssignment = typeof roleAssignments.$inferSelect;

// ─── BYOK Keys ───────────────────────────────────────────────────────────────
export const byokKeys = mysqlTable("byok_keys", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  provider: mysqlEnum("provider", ["vault", "aws_kms", "azure_keyvault"]).notNull(),
  keyIdentifier: varchar("keyIdentifier", { length: 512 }).notNull(),
  status: mysqlEnum("status", ["active", "rotating", "revoked"]).default("active").notNull(),
  lastRotatedAt: timestamp("lastRotatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ByokKey = typeof byokKeys.$inferSelect;

// ─── Notifications ───────────────────────────────────────────────────────────
export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  userId: int("userId"),
  type: mysqlEnum("type", ["incident", "maintenance", "usage_threshold", "invoice", "security", "system"]).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  message: text("message"),
  read: boolean("read").default(false),
  actionUrl: text("actionUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Notification = typeof notifications.$inferSelect;

// ─── Metering Events (for analytics) ────────────────────────────────────────
export const meteringEvents = mysqlTable("metering_events", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  apiId: int("apiId"),
  consumerAppId: int("consumerAppId"),
  subscriptionId: int("subscriptionId"),
  planId: int("planId"),
  endpoint: varchar("endpoint", { length: 512 }),
  method: varchar("method", { length: 10 }),
  statusCode: int("statusCode"),
  requestBytes: int("requestBytes").default(0),
  responseBytes: int("responseBytes").default(0),
  latencyMs: int("latencyMs").default(0),
  pipeline: mysqlEnum("pipeline", ["customer_facing", "sify_internal"]).default("customer_facing").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeteringEvent = typeof meteringEvents.$inferSelect;

// ─── Gateway Clusters ───────────────────────────────────────────────────────
export const gatewayClusters = mysqlTable("gateway_clusters", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  region: varchar("region", { length: 64 }).notNull(),
  tier: mysqlEnum("tier", ["shared", "dedicated", "sovereign"]).default("shared").notNull(),
  status: mysqlEnum("status", ["healthy", "degraded", "offline", "provisioning"]).default("provisioning").notNull(),
  nodeCount: int("nodeCount").default(0),
  maxNodes: int("maxNodes").default(10),
  cpuUsagePercent: int("cpuUsagePercent").default(0),
  memoryUsagePercent: int("memoryUsagePercent").default(0),
  requestsPerSecond: int("requestsPerSecond").default(0),
  shardingTags: json("shardingTags"),
  graviteeVersion: varchar("graviteeVersion", { length: 32 }),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GatewayCluster = typeof gatewayClusters.$inferSelect;

// ─── API Deployments ────────────────────────────────────────────────────────
export const apiDeployments = mysqlTable("api_deployments", {
  id: int("id").autoincrement().primaryKey(),
  apiId: int("apiId").notNull(),
  clusterId: int("clusterId").notNull(),
  tenantId: int("tenantId").notNull(),
  version: varchar("version", { length: 32 }).notNull(),
  status: mysqlEnum("status", ["pending", "deploying", "deployed", "failed", "undeploying", "undeployed"]).default("pending").notNull(),
  strategy: mysqlEnum("strategy", ["rolling", "blue_green", "canary"]).default("rolling").notNull(),
  syncStatus: mysqlEnum("syncStatus", ["synced", "out_of_sync", "syncing", "error"]).default("out_of_sync").notNull(),
  deployedAt: timestamp("deployedAt"),
  lastSyncAt: timestamp("lastSyncAt"),
  configuration: json("configuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiDeployment = typeof apiDeployments.$inferSelect;

// ─── Developer Portal Config ────────────────────────────────────────────────
export const developerPortals = mysqlTable("developer_portals", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  customDomain: varchar("customDomain", { length: 512 }),
  theme: json("theme"),
  logoUrl: text("logoUrl"),
  description: text("description"),
  status: mysqlEnum("status", ["active", "draft", "disabled"]).default("draft").notNull(),
  enableSignup: boolean("enableSignup").default(true),
  enableAutoApprove: boolean("enableAutoApprove").default(false),
  publishedApis: json("publishedApis"),
  customCss: text("customCss"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DeveloperPortal = typeof developerPortals.$inferSelect;

// ─── Data Masking Rules ─────────────────────────────────────────────────────
export const maskingRules = mysqlTable("masking_rules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  apiId: int("apiId"),
  name: varchar("name", { length: 255 }).notNull(),
  jsonPath: varchar("jsonPath", { length: 512 }).notNull(),
  action: mysqlEnum("action", ["full_replace", "partial", "hash_sha256", "redact"]).notNull(),
  replacement: varchar("replacement", { length: 255 }),
  showLastN: int("showLastN"),
  category: mysqlEnum("category", ["pan_card", "aadhaar", "credit_card", "email", "phone", "iban", "ifsc", "custom"]).default("custom").notNull(),
  phase: mysqlEnum("phase", ["request", "response", "both"]).default("both").notNull(),
  enabled: boolean("enabled").default(true),
  priority: int("priority").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MaskingRule = typeof maskingRules.$inferSelect;

// ─── DCR (Dynamic Client Registration) ─────────────────────────────────────
export const dcrClients = mysqlTable("dcr_clients", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  clientId: varchar("clientId", { length: 128 }).notNull().unique(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientSecretHash: varchar("clientSecretHash", { length: 512 }),
  redirectUris: json("redirectUris"),
  grantTypes: json("grantTypes"),
  responseTypes: json("responseTypes"),
  tokenEndpointAuthMethod: varchar("tokenEndpointAuthMethod", { length: 64 }).default("client_secret_basic"),
  scope: text("scope"),
  autoSubscribePlan: int("autoSubscribePlan"),
  status: mysqlEnum("status", ["active", "suspended", "revoked"]).default("active").notNull(),
  registrationAccessToken: varchar("registrationAccessToken", { length: 512 }),
  lastRotatedAt: timestamp("lastRotatedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DcrClient = typeof dcrClients.$inferSelect;

// ─── Identity Providers (OIDC/SAML) ────────────────────────────────────────
export const identityProviders = mysqlTable("identity_providers", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["oidc", "saml", "ldap"]).notNull(),
  issuerUrl: text("issuerUrl"),
  clientId: varchar("clientId", { length: 255 }),
  clientSecretRef: varchar("clientSecretRef", { length: 255 }),
  discoveryUrl: text("discoveryUrl"),
  samlMetadataUrl: text("samlMetadataUrl"),
  groupClaimMapping: json("groupClaimMapping"),
  roleClaimMapping: json("roleClaimMapping"),
  jitProvisioning: boolean("jitProvisioning").default(true),
  scimEnabled: boolean("scimEnabled").default(false),
  scimEndpoint: text("scimEndpoint"),
  status: mysqlEnum("status", ["active", "inactive", "testing"]).default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IdentityProvider = typeof identityProviders.$inferSelect;

// ─── API Environments (for promotion pipeline) ─────────────────────────────
export const apiEnvironments = mysqlTable("api_environments", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId").notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull(),
  order: int("order").default(0),
  clusterId: int("clusterId"),
  gitBranch: varchar("gitBranch", { length: 128 }),
  gitFolder: varchar("gitFolder", { length: 512 }),
  argoAppName: varchar("argoAppName", { length: 255 }),
  autoPromote: boolean("autoPromote").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiEnvironment = typeof apiEnvironments.$inferSelect;

// ─── Alert Rules ────────────────────────────────────────────────────────────
export const alertRules = mysqlTable("alert_rules", {
  id: int("id").autoincrement().primaryKey(),
  tenantId: int("tenantId"),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["error_rate", "latency_p99", "quota_usage", "cert_expiry", "subscription_expiry", "custom"]).notNull(),
  condition: json("condition"),
  threshold: decimal("threshold", { precision: 10, scale: 2 }),
  duration: varchar("duration", { length: 32 }),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).default("warning").notNull(),
  channels: json("channels"),
  enabled: boolean("enabled").default(true),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertRule = typeof alertRules.$inferSelect;

// ─── Event-Native Entrypoints ───────────────────────────────────────────────
export const eventEntrypoints = mysqlTable("event_entrypoints", {
  id: int("id").autoincrement().primaryKey(),
  apiId: int("apiId").notNull(),
  tenantId: int("tenantId").notNull(),
  type: mysqlEnum("type", ["kafka", "mqtt", "rabbitmq", "webhook"]).notNull(),
  configuration: json("configuration"),
  topicPattern: varchar("topicPattern", { length: 512 }),
  brokerUrl: text("brokerUrl"),
  authMethod: mysqlEnum("authMethod", ["none", "sasl_plain", "sasl_scram", "mtls", "api_key"]).default("none"),
  status: mysqlEnum("status", ["active", "inactive", "error"]).default("inactive").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EventEntrypoint = typeof eventEntrypoints.$inferSelect;

// ─── Policy Chains (ordered policy execution) ───────────────────────────────
export const policyChains = mysqlTable("policy_chains", {
  id: int("id").autoincrement().primaryKey(),
  apiId: int("apiId").notNull(),
  tenantId: int("tenantId").notNull(),
  phase: mysqlEnum("phase", ["request", "response", "connect", "subscribe", "publish"]).notNull(),
  policyId: int("policyId").notNull(),
  order: int("order").notNull(),
  condition: text("condition"),
  enabled: boolean("enabled").default(true),
  configuration: json("configuration"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PolicyChain = typeof policyChains.$inferSelect;
