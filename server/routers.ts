import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as graviteeSync from "./graviteeSync";
import { nanoid } from "nanoid";
import crypto from "crypto";

// ─── Tenant Router ───────────────────────────────────────────────────────────
const tenantRouter = router({
  list: protectedProcedure.query(async () => {
    return db.getTenants();
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getTenantById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    tier: z.enum(["starter", "business", "enterprise", "sovereign"]),
    gstin: z.string().optional(),
    pan: z.string().optional(),
    region: z.string().default("mumbai"),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
  })).mutation(async ({ input }) => {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64) + "-" + nanoid(6);
    const tierLimits = {
      starter: { maxWorkspaces: 1, maxApis: 5, maxConsumerApps: 50, includedCallsPerMonth: 1000000, dataTransferLimitGb: 10 },
      business: { maxWorkspaces: 3, maxApis: 25, maxConsumerApps: 500, includedCallsPerMonth: 10000000, dataTransferLimitGb: 100 },
      enterprise: { maxWorkspaces: 10, maxApis: 200, maxConsumerApps: 10000, includedCallsPerMonth: 100000000, dataTransferLimitGb: 1000 },
      sovereign: { maxWorkspaces: 999, maxApis: 9999, maxConsumerApps: 99999, includedCallsPerMonth: 999999999, dataTransferLimitGb: 9999 },
    };
    const limits = tierLimits[input.tier];
    const id = await db.createTenant({ ...input, slug, status: "active", ...limits });
    await db.createAuditEvent({ action: "tenant.created", actionType: "create", targetType: "tenant", targetId: String(id), targetName: input.name, actorName: "system" });
    return { id, slug };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    tier: z.enum(["starter", "business", "enterprise", "sovereign"]).optional(),
    status: z.enum(["active", "provisioning", "suspended", "offboarding", "terminated"]).optional(),
    gstin: z.string().optional(),
    pan: z.string().optional(),
    kybVerified: z.boolean().optional(),
    mfaEnabled: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateTenant(id, data);
    await db.createAuditEvent({ action: "tenant.updated", actionType: "update", targetType: "tenant", targetId: String(id) });
    return { success: true };
  }),
});

// ─── Workspace Router ────────────────────────────────────────────────────────
const workspaceRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getWorkspacesByTenant(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);
    const id = await db.createWorkspace({ ...input, slug });
    await db.createAuditEvent({ action: "workspace.created", actionType: "create", targetType: "workspace", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id, slug };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    status: z.enum(["active", "archived", "deleted"]).optional(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateWorkspace(id, data);
    return { success: true };
  }),
});

// ─── API Management Router ───────────────────────────────────────────────────
const apiRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number(), workspaceId: z.number().optional() })).query(async ({ input }) => {
    return graviteeSync.listApisHybrid(input.tenantId, input.workspaceId);
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getApiById(input.id);
  }),
  create: protectedProcedure.input(z.object({
    workspaceId: z.number(),
    tenantId: z.number(),
    name: z.string().min(1),
    version: z.string().default("1.0.0"),
    protocol: z.enum(["rest", "graphql", "grpc", "websocket", "kafka", "mqtt"]).default("rest"),
    backendUrl: z.string().optional(),
    contextPath: z.string().optional(),
    description: z.string().optional(),
    openApiSpec: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const result = await graviteeSync.createApiHybrid(input);
    await db.createAuditEvent({ action: "api.created", actionType: "create", targetType: "api", targetId: String(result.id), targetName: input.name, tenantId: input.tenantId });
    return result;
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    version: z.string().optional(),
    status: z.enum(["draft", "published", "deprecated", "retired"]).optional(),
    backendUrl: z.string().optional(),
    contextPath: z.string().optional(),
    description: z.string().optional(),
    openApiSpec: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateApi(id, data);
    await db.createAuditEvent({ action: "api.updated", actionType: "update", targetType: "api", targetId: String(id) });
    return { success: true };
  }),
});

// ─── Plans Router ────────────────────────────────────────────────────────────
const planRouter = router({
  list: protectedProcedure.input(z.object({ apiId: z.number() })).query(async ({ input }) => {
    return db.getPlansByApi(input.apiId);
  }),
  create: protectedProcedure.input(z.object({
    apiId: z.number(),
    tenantId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
    rateLimit: z.number().default(100),
    rateLimitPeriod: z.enum(["second", "minute", "hour", "day"]).default("minute"),
    quotaLimit: z.number().default(10000),
    quotaPeriod: z.enum(["day", "week", "month"]).default("month"),
    pricePerCall: z.string().optional(),
    monthlyFee: z.string().optional(),
    autoApprove: z.boolean().default(true),
  })).mutation(async ({ input }) => {
    const result = await graviteeSync.createPlanHybrid(input);
    await db.createAuditEvent({ action: "plan.created", actionType: "create", targetType: "plan", targetId: String(result.id), targetName: input.name, tenantId: input.tenantId });
    return result;
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    status: z.enum(["active", "closed", "deprecated"]).optional(),
    rateLimit: z.number().optional(),
    quotaLimit: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updatePlan(id, data);
    return { success: true };
  }),
});

// ─── Consumer Apps Router ────────────────────────────────────────────────────
const consumerAppRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getConsumerAppsByTenant(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number(),
    workspaceId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
    ownerEmail: z.string().email().optional(),
  })).mutation(async ({ input }) => {
    const clientId = `ci_${nanoid(24)}`;
    const clientSecret = nanoid(48);
    const clientSecretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
    const id = await db.createConsumerApp({ ...input, clientId, clientSecretHash });
    await db.createAuditEvent({ action: "consumer_app.created", actionType: "create", targetType: "consumer_app", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id, clientId, clientSecret };
  }),
});

// ─── Subscriptions Router ────────────────────────────────────────────────────
const subscriptionRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    const subs = await db.getSubscriptionsByTenant(input.tenantId);
    const status = await graviteeSync.getConnectionStatus();
    return subs.map((s: any) => ({ ...s, syncSource: status.mode }));
  }),
  create: protectedProcedure.input(z.object({
    consumerAppId: z.number(),
    planId: z.number(),
    apiId: z.number(),
    tenantId: z.number(),
  })).mutation(async ({ input }) => {
    const result = await graviteeSync.createSubscriptionHybrid(input);
    await db.createAuditEvent({ action: "subscription.created", actionType: "approve", targetType: "subscription", targetId: String(result.id), tenantId: input.tenantId });
    return result;
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "approved", "rejected", "revoked", "expired"]),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateSubscription(id, data);
    return { success: true };
  }),
});

// ─── Policies Router ─────────────────────────────────────────────────────────
const policyRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number(), apiId: z.number().optional() })).query(async ({ input }) => {
    if (input.apiId) return db.getPoliciesByApi(input.apiId);
    return db.getPoliciesByTenant(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    apiId: z.number().optional(),
    tenantId: z.number(),
    name: z.string().min(1),
    type: z.enum(["masking", "rate_limit", "geoip", "vault_secret", "cors", "ip_filtering", "jwt_validation", "oauth2"]),
    phase: z.enum(["request", "response", "both"]).default("both"),
    configuration: z.any(),
    enabled: z.boolean().default(true),
    priority: z.number().default(0),
  })).mutation(async ({ input }) => {
    const id = await db.createPolicy(input);
    await db.createAuditEvent({ action: "policy.created", actionType: "create", targetType: "policy", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    enabled: z.boolean().optional(),
    configuration: z.any().optional(),
    priority: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updatePolicy(id, data);
    return { success: true };
  }),
});

// ─── Audit Trail Router ──────────────────────────────────────────────────────
const auditRouter = router({
  list: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    actorId: z.number().optional(),
    actionType: z.string().optional(),
    targetType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().default(50),
    offset: z.number().default(0),
  })).query(async ({ input }) => {
    return db.getAuditEvents({
      ...input,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
  }),
  export: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    format: z.enum(["csv", "jsonl"]).default("jsonl"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { events } = await db.getAuditEvents({
      tenantId: input.tenantId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      limit: 10000,
    });
    let content: string;
    if (input.format === "csv") {
      const headers = "id,tenantId,actorName,action,actionType,targetType,targetId,createdAt\n";
      content = headers + events.map(e => `${e.id},${e.tenantId},${e.actorName},${e.action},${e.actionType},${e.targetType},${e.targetId},${e.createdAt}`).join("\n");
    } else {
      content = events.map(e => JSON.stringify(e)).join("\n");
    }
    const signature = crypto.createHash("sha256").update(content).digest("hex");
    await db.createAuditEvent({ action: "audit.exported", actionType: "export", targetType: "audit_log", actorName: "system" });
    return { content, signature, format: input.format, recordCount: events.length };
  }),
});

// ─── Billing Router ──────────────────────────────────────────────────────────
const billingRouter = router({
  invoices: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getInvoicesByTenant(input.tenantId);
  }),
  createInvoice: protectedProcedure.input(z.object({
    tenantId: z.number(),
    periodStart: z.string(),
    periodEnd: z.string(),
    lineItems: z.any(),
    subtotal: z.string(),
    cgst: z.string().default("0"),
    sgst: z.string().default("0"),
    igst: z.string().default("0"),
    total: z.string(),
    dueDate: z.string().optional(),
  })).mutation(async ({ input }) => {
    const invoiceNumber = `CI-INV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const id = await db.createInvoice({
      ...input,
      invoiceNumber,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      status: "issued",
    });
    await db.createAuditEvent({ action: "invoice.created", actionType: "create", targetType: "invoice", targetId: String(id), tenantId: input.tenantId });
    return { id, invoiceNumber };
  }),
  updateInvoice: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "issued", "paid", "overdue", "cancelled", "disputed"]).optional(),
    paidAt: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateInvoice(id, { ...data, paidAt: data.paidAt ? new Date(data.paidAt) : undefined });
    return { success: true };
  }),
  usage: protectedProcedure.input(z.object({
    tenantId: z.number(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).query(async ({ input }) => {
    return db.getUsageByTenant(input.tenantId, input.startDate ? new Date(input.startDate) : undefined, input.endDate ? new Date(input.endDate) : undefined);
  }),
});

// ─── Support Router ──────────────────────────────────────────────────────────
const supportRouter = router({
  tickets: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getSupportTicketsByTenant(input.tenantId);
  }),
  createTicket: protectedProcedure.input(z.object({
    tenantId: z.number(),
    subject: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(["S1", "S2", "S3", "S4"]).default("S3"),
    category: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createSupportTicket({ ...input, userId: ctx.user.id });
    await db.createAuditEvent({ action: "ticket.created", actionType: "create", targetType: "support_ticket", targetId: String(id), tenantId: input.tenantId, actorId: ctx.user.id, actorName: ctx.user.name || undefined });
    return { id };
  }),
  updateTicket: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["open", "in_progress", "waiting_customer", "resolved", "closed"]).optional(),
    assignee: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateSupportTicket(id, data);
    return { success: true };
  }),
});

// ─── Incidents / Status Router ───────────────────────────────────────────────
const statusRouter = router({
  incidents: publicProcedure.query(async () => {
    return db.getIncidents();
  }),
  createIncident: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(["minor", "major", "critical"]).default("minor"),
    affectedServices: z.array(z.string()).optional(),
    affectedRegions: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createIncident(input);
    return { id };
  }),
  updateIncident: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["investigating", "identified", "monitoring", "resolved"]).optional(),
    resolvedAt: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateIncident(id, { ...data, resolvedAt: data.resolvedAt ? new Date(data.resolvedAt) : undefined });
    return { success: true };
  }),
});

// ─── Compliance Router ───────────────────────────────────────────────────────
const complianceRouter = router({
  artifacts: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ input }) => {
    return db.getComplianceArtifacts(input.tenantId);
  }),
  createArtifact: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    name: z.string().min(1),
    type: z.enum(["soc2", "iso27001", "rbi_cscrf", "dpdp", "pentest", "sub_processor", "sla_report"]),
    version: z.string().optional(),
    fileUrl: z.string().optional(),
    validFrom: z.string().optional(),
    validUntil: z.string().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createComplianceArtifact({
      ...input,
      validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
      validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
    });
    return { id };
  }),
  byokKeys: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getByokKeysByTenant(input.tenantId);
  }),
  createByokKey: protectedProcedure.input(z.object({
    tenantId: z.number(),
    name: z.string().min(1),
    provider: z.enum(["vault", "aws_kms", "azure_keyvault"]),
    keyIdentifier: z.string().min(1),
  })).mutation(async ({ input }) => {
    const id = await db.createByokKey(input);
    await db.createAuditEvent({ action: "byok_key.created", actionType: "create", targetType: "byok_key", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
  }),
  updateByokKey: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "rotating", "revoked"]).optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateByokKey(id, data);
    return { success: true };
  }),
});

// ─── RBAC Router ─────────────────────────────────────────────────────────────
const rbacRouter = router({
  roles: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getRolesByTenant(input.tenantId);
  }),
  createRole: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    name: z.string().min(1),
    description: z.string().optional(),
    scope: z.enum(["platform", "workspace", "api", "application"]).default("workspace"),
    permissions: z.any(),
  })).mutation(async ({ input }) => {
    const id = await db.createRole(input);
    return { id };
  }),
  assignments: protectedProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    return db.getRoleAssignments(input.userId);
  }),
  assignRole: protectedProcedure.input(z.object({
    userId: z.number(),
    roleId: z.number(),
    tenantId: z.number().optional(),
    workspaceId: z.number().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.assignRole(input);
    return { id };
  }),
});

// ─── Analytics Router ────────────────────────────────────────────────────────
const analyticsRouter = router({
  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ input }) => {
    return db.getDashboardStats(input.tenantId);
  }),
  usage: protectedProcedure.input(z.object({
    tenantId: z.number(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).query(async ({ input }) => {
    return db.getUsageByTenant(input.tenantId, input.startDate ? new Date(input.startDate) : undefined, input.endDate ? new Date(input.endDate) : undefined);
  }),
  metering: protectedProcedure.input(z.object({
    tenantId: z.number(),
    pipeline: z.enum(["customer_facing", "sify_internal"]).optional(),
  })).query(async ({ input }) => {
    return db.getMeteringStats(input.tenantId, input.pipeline);
  }),
  // Live Gravitee platform analytics
  graviteeMetrics: protectedProcedure.input(z.object({
    from: z.number().optional(),
    to: z.number().optional(),
  })).query(async ({ input }) => {
    const now = Date.now();
    const from = input.from || now - 24 * 60 * 60 * 1000; // last 24h
    const to = input.to || now;
    return graviteeSync.getPlatformAnalyticsHybrid(from, to);
  }),
  // Per-API Gravitee analytics
  apiMetrics: protectedProcedure.input(z.object({
    apiId: z.number(),
    from: z.number().optional(),
    to: z.number().optional(),
  })).query(async ({ input }) => {
    const now = Date.now();
    const from = input.from || now - 24 * 60 * 60 * 1000;
    const to = input.to || now;
    return graviteeSync.getApiAnalyticsHybrid(input.apiId, from, to);
  }),
  // Available policies from Gravitee
  availablePolicies: protectedProcedure.query(async () => {
    return graviteeSync.getAvailablePoliciesHybrid();
  }),
});

// ─── Notifications Router ────────────────────────────────────────────────────
const notificationRouter = router({
  list: protectedProcedure.input(z.object({ unreadOnly: z.boolean().default(false) })).query(async ({ ctx, input }) => {
    return db.getNotificationsByUser(ctx.user.id, input.unreadOnly);
  }),
  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.markNotificationRead(input.id);
    return { success: true };
  }),
});

// ─── Gateway Cluster Router ─────────────────────────────────────────────────
const gatewayRouter = router({
  clusters: protectedProcedure.query(async () => {
    const status = await graviteeSync.getConnectionStatus();
    const localClusters = await db.getGatewayClusters();
    if (status.mode === "live") {
      try {
        const { instances } = await graviteeSync.getGatewayInstancesHybrid();
        // Enrich local clusters with live instance data
        return localClusters.map((c: any) => {
          const matchingInstances = instances.filter(i => 
            (i.tags || []).some((t: string) => (c.shardingTags || []).includes(t)) || i.tenant === c.region
          );
          return {
            ...c,
            liveNodeCount: matchingInstances.length,
            liveInstances: matchingInstances.slice(0, 5),
            syncSource: "gravitee" as const,
          };
        });
      } catch { /* fallback */ }
    }
    return localClusters.map((c: any) => ({ ...c, syncSource: "local" as const }));
  }),
  createCluster: protectedProcedure.input(z.object({
    name: z.string().min(1),
    region: z.string().min(1),
    tier: z.enum(["shared", "dedicated", "sovereign"]).default("shared"),
    maxNodes: z.number().default(10),
    shardingTags: z.array(z.string()).optional(),
    graviteeVersion: z.string().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createGatewayCluster({ ...input, shardingTags: input.shardingTags || [], status: "provisioning" });
    await db.createAuditEvent({ action: "gateway_cluster.created", actionType: "create", targetType: "gateway_cluster", targetId: String(id), targetName: input.name });
    return { id };
  }),
  updateCluster: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["healthy", "degraded", "offline", "provisioning"]).optional(),
    nodeCount: z.number().optional(),
    cpuUsagePercent: z.number().optional(),
    memoryUsagePercent: z.number().optional(),
    requestsPerSecond: z.number().optional(),
    shardingTags: z.array(z.string()).optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateGatewayCluster(id, data);
    return { success: true };
  }),
  deployments: protectedProcedure.input(z.object({
    apiId: z.number().optional(),
    clusterId: z.number().optional(),
  })).query(async ({ input }) => {
    const localDeployments = await db.getApiDeployments(input.apiId, input.clusterId);
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode === "live") {
      // Enrich with live Gravitee state for each deployed API
      const enriched = await Promise.all(localDeployments.map(async (dep: any) => {
        try {
          const localApi = await db.getApiById(dep.apiId);
          const graviteeApiId = (localApi as any)?.graviteeApiId;
          if (graviteeApiId) {
            return { ...dep, graviteeState: "STARTED", syncSource: "gravitee" };
          }
        } catch { /* ignore */ }
        return { ...dep, syncSource: "local" };
      }));
      return enriched;
    }
    return localDeployments.map((d: any) => ({ ...d, syncSource: "local" }));
  }),
  deploy: protectedProcedure.input(z.object({
    apiId: z.number(),
    clusterId: z.number(),
    tenantId: z.number(),
    version: z.string(),
    strategy: z.enum(["rolling", "blue_green", "canary"]).default("rolling"),
    configuration: z.any().optional(),
  })).mutation(async ({ input }) => {
    const result = await graviteeSync.deployApiHybrid(input);
    await db.createAuditEvent({ action: "api.deployed", actionType: "deploy", targetType: "api", targetId: String(input.apiId), tenantId: input.tenantId });
    return result;
  }),
  undeploy: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await graviteeSync.undeployApiHybrid(input.id);
    return { success: true };
  }),
  // Live gateway instances from Gravitee
  instances: protectedProcedure.query(async () => {
    return graviteeSync.getGatewayInstancesHybrid();
  }),
  // Connection status check
  connectionStatus: protectedProcedure.query(async () => {
    return graviteeSync.getConnectionStatus();
  }),
  // Start/Stop API on gateway
  startApi: protectedProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ input }) => {
    return graviteeSync.startApiHybrid(input.apiId);
  }),
  stopApi: protectedProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ input }) => {
    return graviteeSync.stopApiHybrid(input.apiId);
  }),
});

// ─── Developer Portal Router ────────────────────────────────────────────────
const devPortalRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ input }) => {
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode === "live") {
      try {
        const { apis } = await graviteeSync.getPortalApisHybrid();
        const localPortals = await db.getDeveloperPortals(input.tenantId);
        return localPortals.map((p: any) => ({ ...p, portalApiCount: apis.length, syncSource: "gravitee" }));
      } catch { /* fallback */ }
    }
    const portals = await db.getDeveloperPortals(input.tenantId);
    return portals.map((p: any) => ({ ...p, syncSource: "local" }));
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number(),
    name: z.string().min(1),
    customDomain: z.string().optional(),
    description: z.string().optional(),
    enableSignup: z.boolean().default(true),
    enableAutoApprove: z.boolean().default(false),
    theme: z.any().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createDeveloperPortal({ ...input, status: "draft" });
    await db.createAuditEvent({ action: "developer_portal.created", actionType: "create", targetType: "developer_portal", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    customDomain: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(["active", "draft", "disabled"]).optional(),
    enableSignup: z.boolean().optional(),
    enableAutoApprove: z.boolean().optional(),
    theme: z.any().optional(),
    publishedApis: z.array(z.number()).optional(),
    customCss: z.string().optional(),
    logoUrl: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateDeveloperPortal(id, data);
    return { success: true };
  }),
});

// ─── Data Masking Router (F-01) ─────────────────────────────────────────────
const maskingRouter = router({
  rules: protectedProcedure.input(z.object({
    tenantId: z.number(),
    apiId: z.number().optional(),
  })).query(async ({ input }) => {
    return db.getMaskingRules(input.tenantId, input.apiId);
  }),
  createRule: protectedProcedure.input(z.object({
    tenantId: z.number(),
    apiId: z.number().optional(),
    name: z.string().min(1),
    jsonPath: z.string().min(1),
    action: z.enum(["full_replace", "partial", "hash_sha256", "redact"]),
    replacement: z.string().optional(),
    showLastN: z.number().optional(),
    category: z.enum(["pan_card", "aadhaar", "credit_card", "email", "phone", "iban", "ifsc", "custom"]).default("custom"),
    phase: z.enum(["request", "response", "both"]).default("both"),
    priority: z.number().default(0),
  })).mutation(async ({ input }) => {
    const id = await db.createMaskingRule(input);
    await db.createAuditEvent({ action: "masking_rule.created", actionType: "create", targetType: "masking_rule", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
  }),
  updateRule: protectedProcedure.input(z.object({
    id: z.number(),
    enabled: z.boolean().optional(),
    jsonPath: z.string().optional(),
    action: z.enum(["full_replace", "partial", "hash_sha256", "redact"]).optional(),
    replacement: z.string().optional(),
    showLastN: z.number().optional(),
    priority: z.number().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateMaskingRule(id, data);
    return { success: true };
  }),
  deleteRule: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteMaskingRule(input.id);
    return { success: true };
  }),
});

// ─── DCR Router (F-06) ──────────────────────────────────────────────────────
const dcrRouter = router({
  clients: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getDcrClients(input.tenantId);
  }),
  register: protectedProcedure.input(z.object({
    tenantId: z.number(),
    clientName: z.string().min(1),
    redirectUris: z.array(z.string()).optional(),
    grantTypes: z.array(z.string()).default(["client_credentials"]),
    responseTypes: z.array(z.string()).optional(),
    tokenEndpointAuthMethod: z.string().default("client_secret_basic"),
    scope: z.string().optional(),
    autoSubscribePlan: z.number().optional(),
  })).mutation(async ({ input }) => {
    const clientId = `dcr_${nanoid(24)}`;
    const clientSecret = nanoid(48);
    const clientSecretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
    const registrationAccessToken = nanoid(64);
    const id = await db.createDcrClient({ ...input, clientId, clientSecretHash, registrationAccessToken });
    await db.createAuditEvent({ action: "dcr_client.registered", actionType: "create", targetType: "dcr_client", targetId: String(id), targetName: input.clientName, tenantId: input.tenantId });
    // Sync to Gravitee if connected (register as application)
    const status = await graviteeSync.getConnectionStatus();
    let graviteeAppId: string | undefined;
    if (status.mode === "live") {
      try {
        const { createApplication } = await import("./gravitee");
        const app = await createApplication({
          name: input.clientName,
          description: `DCR client for tenant ${input.tenantId}`,
          type: "BACKEND_TO_BACKEND",
          settings: { app: { type: "simple", client_id: clientId } },
        });
        graviteeAppId = app.id;
      } catch (e) { console.warn("[GraviteeSync] DCR app registration failed:", e); }
    }
    return { id, clientId, clientSecret, registrationAccessToken, graviteeAppId };
  }),
  rotateSecret: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const newSecret = nanoid(48);
    const newHash = crypto.createHash("sha256").update(newSecret).digest("hex");
    await db.updateDcrClient(input.id, { clientSecretHash: newHash, lastRotatedAt: new Date() });
    return { clientSecret: newSecret };
  }),
  updateStatus: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "suspended", "revoked"]),
  })).mutation(async ({ input }) => {
    await db.updateDcrClient(input.id, { status: input.status });
    return { success: true };
  }),
});

// ─── Identity Provider Router (F-04) ────────────────────────────────────────
const idpRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getIdentityProviders(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number(),
    name: z.string().min(1),
    type: z.enum(["oidc", "saml", "ldap"]),
    issuerUrl: z.string().optional(),
    clientId: z.string().optional(),
    clientSecretRef: z.string().optional(),
    discoveryUrl: z.string().optional(),
    samlMetadataUrl: z.string().optional(),
    groupClaimMapping: z.any().optional(),
    roleClaimMapping: z.any().optional(),
    jitProvisioning: z.boolean().default(true),
    scimEnabled: z.boolean().default(false),
    scimEndpoint: z.string().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createIdentityProvider({ ...input, status: "inactive" });
    await db.createAuditEvent({ action: "idp.created", actionType: "create", targetType: "identity_provider", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "inactive", "testing"]).optional(),
    groupClaimMapping: z.any().optional(),
    roleClaimMapping: z.any().optional(),
    jitProvisioning: z.boolean().optional(),
    scimEnabled: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateIdentityProvider(id, data);
    return { success: true };
  }),
});

// ─── API Environments / APIOps Router (F-12) ────────────────────────────────
const envRouter = router({
  list: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ input }) => {
    return db.getApiEnvironments(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number(),
    name: z.string().min(1),
    slug: z.string().min(1),
    order: z.number().default(0),
    clusterId: z.number().optional(),
    gitBranch: z.string().optional(),
    gitFolder: z.string().optional(),
    argoAppName: z.string().optional(),
    autoPromote: z.boolean().default(false),
  })).mutation(async ({ input }) => {
    const id = await db.createApiEnvironment(input);
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    clusterId: z.number().optional(),
    gitBranch: z.string().optional(),
    gitFolder: z.string().optional(),
    argoAppName: z.string().optional(),
    autoPromote: z.boolean().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateApiEnvironment(id, data);
    return { success: true };
  }),
});

// ─── Alert Rules Router (F-11) ──────────────────────────────────────────────
const alertRouter = router({
  rules: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ input }) => {
    return db.getAlertRules(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    name: z.string().min(1),
    type: z.enum(["error_rate", "latency_p99", "quota_usage", "cert_expiry", "subscription_expiry", "custom"]),
    condition: z.any().optional(),
    threshold: z.number().optional(),
    duration: z.string().optional(),
    severity: z.enum(["info", "warning", "critical"]).default("warning"),
    channels: z.array(z.object({ type: z.string(), target: z.string() })).optional(),
    enabled: z.boolean().default(true),
  })).mutation(async ({ input }) => {
    const id = await db.createAlertRule({ ...input, threshold: input.threshold ? String(input.threshold) : undefined, channels: input.channels || [] });
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    enabled: z.boolean().optional(),
    threshold: z.number().optional(),
    severity: z.enum(["info", "warning", "critical"]).optional(),
    channels: z.array(z.object({ type: z.string(), target: z.string() })).optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateAlertRule(id, { ...data, threshold: data.threshold ? String(data.threshold) : undefined });
    return { success: true };
  }),
});

// ─── Event Entrypoints Router (F-13) ────────────────────────────────────────
const eventRouter = router({
  entrypoints: protectedProcedure.input(z.object({
    apiId: z.number().optional(),
    tenantId: z.number().optional(),
  })).query(async ({ input }) => {
    return db.getEventEntrypoints(input.apiId, input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    apiId: z.number(),
    tenantId: z.number(),
    type: z.enum(["kafka", "mqtt", "rabbitmq", "webhook"]),
    topicPattern: z.string().optional(),
    brokerUrl: z.string().optional(),
    authMethod: z.enum(["none", "sasl_plain", "sasl_scram", "mtls", "api_key"]).default("none"),
    configuration: z.any().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createEventEntrypoint({ ...input, status: "inactive" });
    await db.createAuditEvent({ action: "event_entrypoint.created", actionType: "create", targetType: "event_entrypoint", targetId: String(id), tenantId: input.tenantId });
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "inactive", "error"]).optional(),
    topicPattern: z.string().optional(),
    brokerUrl: z.string().optional(),
    authMethod: z.enum(["none", "sasl_plain", "sasl_scram", "mtls", "api_key"]).optional(),
    configuration: z.any().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateEventEntrypoint(id, data);
    return { success: true };
  }),
});

// ─── Policy Chains Router ───────────────────────────────────────────────────
const policyChainRouter = router({
  list: protectedProcedure.input(z.object({ apiId: z.number() })).query(async ({ input }) => {
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode === "live") {
      try {
        const { flows, source } = await graviteeSync.syncApiFlowsHybrid(input.apiId);
        if (source === "gravitee") {
          return flows.map((f: any) => ({ ...f, syncSource: "gravitee" }));
        }
      } catch { /* fallback */ }
    }
    const chains = await db.getPolicyChains(input.apiId);
    return chains.map((c: any) => ({ ...c, syncSource: "local" }));
  }),
  add: protectedProcedure.input(z.object({
    apiId: z.number(),
    tenantId: z.number(),
    phase: z.enum(["request", "response", "connect", "subscribe", "publish"]),
    policyId: z.number(),
    order: z.number(),
    condition: z.string().optional(),
    configuration: z.any().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.createPolicyChain(input);
    return { id };
  }),
  update: protectedProcedure.input(z.object({
    id: z.number(),
    order: z.number().optional(),
    condition: z.string().optional(),
    enabled: z.boolean().optional(),
    configuration: z.any().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updatePolicyChain(id, data);
    return { success: true };
  }),
  remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deletePolicyChain(input.id);
    return { success: true };
  }),
});

// ─── Main App Router ─────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  tenant: tenantRouter,
  workspace: workspaceRouter,
  api: apiRouter,
  plan: planRouter,
  consumerApp: consumerAppRouter,
  subscription: subscriptionRouter,
  policy: policyRouter,
  audit: auditRouter,
  billing: billingRouter,
  support: supportRouter,
  status: statusRouter,
  compliance: complianceRouter,
  rbac: rbacRouter,
  analytics: analyticsRouter,
  notification: notificationRouter,
  gateway: gatewayRouter,
  devPortal: devPortalRouter,
  masking: maskingRouter,
  dcr: dcrRouter,
  idp: idpRouter,
  env: envRouter,
  alert: alertRouter,
  event: eventRouter,
  policyChain: policyChainRouter,
});

export type AppRouter = typeof appRouter;
