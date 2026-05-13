import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
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
    if (input.workspaceId) return db.getApisByWorkspace(input.workspaceId);
    return db.getApisByTenant(input.tenantId);
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
    const id = await db.createApi(input);
    await db.createAuditEvent({ action: "api.created", actionType: "create", targetType: "api", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
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
    const id = await db.createPlan(input);
    await db.createAuditEvent({ action: "plan.created", actionType: "create", targetType: "plan", targetId: String(id), targetName: input.name, tenantId: input.tenantId });
    return { id };
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
    return db.getSubscriptionsByTenant(input.tenantId);
  }),
  create: protectedProcedure.input(z.object({
    consumerAppId: z.number(),
    planId: z.number(),
    apiId: z.number(),
    tenantId: z.number(),
  })).mutation(async ({ input }) => {
    const id = await db.createSubscription({ ...input, status: "approved", approvedAt: new Date() });
    await db.createAuditEvent({ action: "subscription.created", actionType: "approve", targetType: "subscription", targetId: String(id), tenantId: input.tenantId });
    return { id };
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
});

export type AppRouter = typeof appRouter;
