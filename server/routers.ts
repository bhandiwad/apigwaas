import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, tenantProcedure, adminProcedure, tenantAdminProcedure, tenantWriteProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { logger } from "./_core/logger";
import { validateBackendUrl, validateContextPath } from "./_core/validation";
import { z } from "zod";
import * as db from "./db";
import * as graviteeSync from "./graviteeSync";
import * as gravitee from "./gravitee";
import { nanoid } from "nanoid";
import crypto from "crypto";

// Resolves the effective tenantId for cross-tenant platform admin access.
// Platform admins can pass an explicit tenantId in input to manage any tenant.
function resolveEffectiveTenantId(userRole: string, ctxTenantId: number, inputTenantId?: number): number {
  return (userRole === "admin" && inputTenantId) ? inputTenantId : ctxTenantId;
}

// Actor attribution for audit events — spread into createAuditEvent so every
// logged action records who performed it instead of defaulting to "System".
function actor(ctx: { user: { id: number; name?: string | null; email?: string | null } }) {
  return { actorId: ctx.user.id, actorName: ctx.user.name || ctx.user.email || undefined };
}

// Extract Gravitee's real error message from an axios failure instead of the
// opaque "Request failed with status code 4xx" that axios surfaces by default.
function graviteeErrorMessage(err: any, fallback: string): string {
  const g = err?.response?.data;
  const detail = g?.message || g?.error
    || (Array.isArray(g?.errors) && g.errors.length ? g.errors.map((e: any) => e.message || e).join("; ") : null);
  return detail ? `${fallback}: ${detail}` : fallback;
}

// ─── Tenant Router ───────────────────────────────────────────────────────────
const tenantRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "admin") return db.getTenants();
    if (ctx.user.tenantId) {
      const t = await db.getTenantById(ctx.user.tenantId);
      return t ? [t] : [];
    }
    return [];
  }),
  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getTenantById(input.id);
  }),
  // Uses protectedProcedure (not tenantProcedure) — user may not have a tenant yet
  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    tier: z.enum(["starter", "business", "enterprise", "sovereign"]),
    gstin: z.string().optional(),
    pan: z.string().optional(),
    region: z.string().default("mumbai"),
    contactEmail: z.preprocess(v => v === "" ? undefined : v, z.string().email().optional()),
    contactPhone: z.string().optional(),
    address: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64) + "-" + nanoid(6);
    const tierLimits = {
      starter: { maxWorkspaces: 1, maxApis: 5, maxConsumerApps: 50, includedCallsPerMonth: 1000000, dataTransferLimitGb: 10 },
      business: { maxWorkspaces: 3, maxApis: 25, maxConsumerApps: 500, includedCallsPerMonth: 10000000, dataTransferLimitGb: 100 },
      enterprise: { maxWorkspaces: 10, maxApis: 200, maxConsumerApps: 10000, includedCallsPerMonth: 100000000, dataTransferLimitGb: 1000 },
      sovereign: { maxWorkspaces: 999, maxApis: 9999, maxConsumerApps: 99999, includedCallsPerMonth: 999999999, dataTransferLimitGb: 9999 },
    };
    const limits = tierLimits[input.tier];
    const id = await db.createTenant({ ...input, slug, status: "active", ...limits });
    // Link this user to the new tenant if they don't already belong to one
    if (!ctx.user.tenantId) {
      await db.updateUser(ctx.user.id, { tenantId: id });
    }
    await db.createAuditEvent({ action: "tenant.created", actionType: "create", targetType: "tenant", targetId: String(id), targetName: input.name, actorId: ctx.user.id, actorName: ctx.user.name || undefined, tenantId: id });
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

  // ─── Member management ─────────────────────────────────────────────────────
  members: tenantAdminProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    return db.getTenantMembers(tid);
  }),

  removeMember: tenantAdminProcedure.input(z.object({ userId: z.number(), tenantId: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove yourself." });
    await db.removeUserFromTenant(input.userId, tid);
    await db.createAuditEvent({ action: "member.removed", actionType: "delete", targetType: "user", targetId: String(input.userId), tenantId: tid, actorId: ctx.user.id });
    return { success: true };
  }),

  changeMemberRole: tenantAdminProcedure.input(z.object({
    userId: z.number(),
    tenantRole: z.enum(["owner", "admin", "developer", "viewer"]),
    tenantId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot change your own role." });
    if ((input.tenantRole === "owner" || input.tenantRole === "admin") && ctx.user.tenantRole !== "owner" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the tenant owner can assign admin roles." });
    }
    await db.updateUserTenantRole(input.userId, tid, input.tenantRole);
    await db.createAuditEvent({ action: "member.role_changed", actionType: "update", targetType: "user", targetId: String(input.userId), tenantId: tid, actorId: ctx.user.id });
    return { success: true };
  }),

  // ─── Invite management ─────────────────────────────────────────────────────
  invite: tenantAdminProcedure.input(z.object({
    email: z.string().email(),
    tenantRole: z.enum(["admin", "developer", "viewer"]),
    tenantId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    const token = nanoid(40);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await db.createInviteToken({
      tenantId: tid,
      email: input.email.toLowerCase(),
      tenantRole: input.tenantRole,
      token,
      expiresAt,
      invitedByUserId: ctx.user.id,
    });
    const tenant = await db.getTenantById(tid);
    const baseUrl = process.env.APP_URL ?? "http://localhost:3005";
    const inviteUrl = `${baseUrl}/accept-invite?token=${token}`;
    const { sendInviteEmail } = await import("./_core/email");
    await sendInviteEmail(input.email, tenant?.name ?? "CloudInfinit", inviteUrl, input.tenantRole).catch(() => {});
    await db.createAuditEvent({ action: "member.invited", actionType: "create", targetType: "user", targetName: input.email, tenantId: tid, actorId: ctx.user.id });
    return { success: true, inviteUrl };
  }),

  pendingInvites: tenantAdminProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    return db.getPendingInvites(tid);
  }),

  revokeInvite: tenantAdminProcedure.input(z.object({ id: z.number(), tenantId: z.number().optional() })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    await db.revokeInvite(input.id, tid);
    return { success: true };
  }),

  // ─── Self-registration settings ────────────────────────────────────────────
  updateSettings: tenantAdminProcedure.input(z.object({
    allowSelfRegistration: z.boolean().optional(),
    selfRegDefaultRole: z.enum(["developer", "viewer"]).optional(),
    allowedEmailDomains: z.array(z.string()).optional(),
    tenantId: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.tenantId, input.tenantId);
    if (ctx.user.tenantRole !== "owner" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only the tenant owner can change registration settings." });
    }
    const { tenantId: _tid, ...settings } = input;
    await db.updateTenantSettings(tid, settings);
    await db.createAuditEvent({ action: "tenant.settings_updated", actionType: "update", targetType: "tenant", targetId: String(tid), tenantId: tid, actorId: ctx.user.id });
    return { success: true };
  }),

  // ─── Quota ─────────────────────────────────────────────────────────────────
  quotaUsage: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ ctx, input }) => {
    let tid: number;
    if (ctx.user.role === "admin" && input.tenantId) {
      tid = input.tenantId;
    } else if (ctx.user.tenantId) {
      tid = ctx.user.tenantId;
    } else {
      throw new TRPCError({ code: "FORBIDDEN", message: "No tenant associated with your account." });
    }
    const [ws, ap, ca] = await Promise.all([
      db.checkQuota(tid, "workspaces"),
      db.checkQuota(tid, "apis"),
      db.checkQuota(tid, "consumerApps"),
    ]);
    return { workspaces: ws, apis: ap, consumerApps: ca };
  }),
});

// ─── Workspace Router ────────────────────────────────────────────────────────
const workspaceRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.getWorkspacesByTenant(ctx.tenantId);
  }),
  listByTenant: protectedProcedure.input(z.object({ tenantId: z.number() })).query(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, input.tenantId);
    return db.getWorkspacesByTenant(tid);
  }),
  create: tenantWriteProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const quota = await db.checkQuota(ctx.tenantId, "workspaces");
    if (!quota.allowed) throw new TRPCError({ code: "FORBIDDEN", message: `Workspace limit reached (${quota.current}/${quota.limit} on your plan). Upgrade to add more.` });
    const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);
    const id = await db.createWorkspace({ ...input, tenantId: ctx.tenantId, slug });
    await db.createAuditEvent({ action: "workspace.created", actionType: "create", targetType: "workspace", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id, slug };
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    status: z.enum(["active", "archived", "deleted"]).optional(),
    description: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateWorkspace(id, data);
    return { success: true };
  }),
  archive: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.archiveWorkspace(input.id);
    await db.createAuditEvent({ action: "workspace.archived", actionType: "delete", targetType: "workspace", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── API Management Router ───────────────────────────────────────────────────
const apiRouter = router({
  // Public endpoint for developer portal — returns all published APIs across all tenants
  portalList: publicProcedure.query(async () => {
    return db.getPublishedApis();
  }),
  list: tenantProcedure.input(z.object({ workspaceId: z.number().optional() })).query(async ({ ctx, input }) => {
    return graviteeSync.listApisHybrid(ctx.tenantId, input.workspaceId);
  }),
  getById: tenantProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    return db.getApiById(input.id);
  }),
  create: tenantWriteProcedure.input(z.object({
    workspaceId: z.number(),
    name: z.string().min(1),
    version: z.string().default("1.0.0"),
    protocol: z.enum(["rest", "graphql", "grpc", "websocket", "kafka", "mqtt"]).default("rest"),
    backendUrl: z.string().optional(),
    contextPath: z.string().optional(),
    description: z.string().optional(),
    openApiSpec: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const quota = await db.checkQuota(ctx.tenantId, "apis");
    if (!quota.allowed) throw new TRPCError({ code: "FORBIDDEN", message: `API limit reached (${quota.current}/${quota.limit} on your plan). Upgrade to add more.` });
    const hasAccess = await db.userHasWorkspaceAccess(ctx.user.id, input.workspaceId, ctx.tenantId);
    if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this workspace" });
    if (input.backendUrl) validateBackendUrl(input.backendUrl, "backendUrl");
    if (input.contextPath) validateContextPath(input.contextPath);
    const result = await graviteeSync.createApiHybrid({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "api.created", actionType: "create", targetType: "api", targetId: String(result.id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    version: z.string().optional(),
    status: z.enum(["draft", "published", "deprecated", "retired"]).optional(),
    backendUrl: z.string().optional(),
    contextPath: z.string().optional(),
    description: z.string().optional(),
    openApiSpec: z.any().optional(),
    tags: z.array(z.string()).optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;

    // Publishing must succeed on the gateway BEFORE we mark it published locally,
    // otherwise the UI shows "published" for an API that isn't actually deployed.
    if (data.status === "published") {
      try {
        await graviteeSync.publishApiHybrid(id);
      } catch (err) {
        throw new TRPCError({ code: "BAD_REQUEST", message: graviteeErrorMessage(err, "Failed to publish API to the gateway") });
      }
    }

    await db.updateApi(id, data);
    await db.createAuditEvent({ action: "api.updated", actionType: "update", targetType: "api", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const api = await db.getApiById(input.id);
    if (!api || (api as any).tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND", message: "API not found" });
    // Remove from Gravitee first so the context-path is freed and no orphan API is left behind.
    try {
      await graviteeSync.deleteApiHybrid(input.id);
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: graviteeErrorMessage(err, "Failed to delete API from the gateway") });
    }
    await db.deleteApi(input.id);
    await db.createAuditEvent({ action: "api.deleted", actionType: "delete", targetType: "api", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  saveFlows: tenantProcedure.input(z.object({
    apiId: z.number(),
    flows: z.array(z.object({
      phase: z.enum(["request", "response"]),
      type: z.string(),
      config: z.record(z.string(), z.any()),
    })),
  })).mutation(async ({ ctx, input }) => {
    const api = await db.getApiById(input.apiId);
    if (!api || (api as any).tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND", message: "API not found" });
    const result = await graviteeSync.saveApiFlowsHybrid(input.apiId, input.flows);
    await db.createAuditEvent({ action: "api.flows.updated", actionType: "update", targetType: "api", targetId: String(input.apiId), tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
  // Proxy test — forwards a GET request to the API's actual backendUrl + path
  // so testing works even without a local Gravitee gateway running
  proxyTest: protectedProcedure.input(z.object({
    apiId: z.number(),
    path: z.string().default("/"),
    queryString: z.string().optional(),
    method: z.string().default("GET"),
  })).mutation(async ({ ctx, input }) => {
    const api = await db.getApiById(input.apiId);
    if (!api) throw new TRPCError({ code: "NOT_FOUND", message: "API not found" });
    // Allow admin cross-tenant access; tenant users can only test their own APIs
    if (ctx.user.role !== "admin" && (api as any).tenantId !== ctx.user.tenantId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
    }
    const backendUrl: string = (api as any).backendUrl || "";
    if (!backendUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "No backend URL configured for this API" });
    const pathPart = input.path.startsWith("/") ? input.path : `/${input.path}`;
    const qs = input.queryString ? `?${input.queryString}` : "";
    const url = `${backendUrl.replace(/\/$/, "")}${pathPart}${qs}`;
    const start = Date.now();
    try {
      const res = await fetch(url, {
        method: input.method,
        headers: { "Accept": "application/json", "User-Agent": "SifyAPIGateway/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const latencyMs = Date.now() - start;
      const body = await res.text();
      const apiTenantId = (api as any).tenantId;
      // Record this call as a metering event
      await db.createMeteringEvent({
        tenantId: apiTenantId,
        apiId: input.apiId,
        method: input.method,
        statusCode: res.status,
        latencyMs,
        requestBytes: url.length,
        responseBytes: body.length,
        pipeline: "customer_facing",
        endpoint: pathPart || null,
      });
      await db.upsertTodayUsageRecord(apiTenantId, input.apiId, res.status >= 400);
      return {
        status: res.status,
        statusText: res.statusText,
        latencyMs,
        headers: Object.fromEntries(res.headers.entries()),
        body: body.slice(0, 4000),
        url,
      };
    } catch (err: any) {
      return { status: 0, statusText: "Connection failed", latencyMs: Date.now() - start, headers: {}, body: err.message, url };
    }
  }),
});

// ─── Plans Router ────────────────────────────────────────────────────────────
const planRouter = router({
  // Public endpoint for developer portal — returns all active plans
  portalList: publicProcedure.query(async () => {
    return db.getAllActivePlans();
  }),
  list: tenantProcedure.input(z.object({ apiId: z.number() })).query(async ({ input }) => {
    return db.getPlansByApi(input.apiId);
  }),
  create: tenantProcedure.input(z.object({
    apiId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
    rateLimit: z.number().default(100),
    rateLimitPeriod: z.enum(["second", "minute", "hour", "day"]).default("minute"),
    quotaLimit: z.number().default(10000),
    quotaPeriod: z.enum(["day", "week", "month"]).default("month"),
    pricePerCall: z.string().optional(),
    monthlyFee: z.string().optional(),
    autoApprove: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    const result = await graviteeSync.createPlanHybrid({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "plan.created", actionType: "create", targetType: "plan", targetId: String(result.id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    status: z.enum(["active", "closed", "deprecated"]).optional(),
    rateLimit: z.number().optional(),
    quotaLimit: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.updatePlan(id, data);
    const action = data.status === "active" ? "plan.activated" : data.status === "closed" ? "plan.deactivated" : "plan.updated";
    await db.createAuditEvent({ action, actionType: "update", targetType: "plan", targetId: String(id), targetName: data.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deletePlan(input.id);
    await db.createAuditEvent({ action: "plan.deleted", actionType: "delete", targetType: "plan", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── Consumer Apps Router ────────────────────────────────────────────────────
const consumerAppRouter = router({
  list: tenantProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(100) }).optional()).query(async ({ ctx, input }) => {
    return db.getConsumerAppsByTenant(ctx.tenantId, input ?? {});
  }),
  create: tenantWriteProcedure.input(z.object({
    workspaceId: z.number(),
    name: z.string().min(1),
    description: z.string().optional(),
    ownerEmail: z.string().email().optional(),
  })).mutation(async ({ ctx, input }) => {
    const quota = await db.checkQuota(ctx.tenantId, "consumerApps");
    if (!quota.allowed) throw new TRPCError({ code: "FORBIDDEN", message: `Consumer app limit reached (${quota.current}/${quota.limit} on your plan). Upgrade to add more.` });
    const clientId = `ci_${nanoid(24)}`;
    const clientSecret = nanoid(48);
    const clientSecretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
    const id = await db.createConsumerApp({ ...input, tenantId: ctx.tenantId, clientId, clientSecretHash });
    await db.createAuditEvent({ action: "consumer_app.created", actionType: "create", targetType: "consumer_app", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    await graviteeSync.createConsumerAppHybrid({ id: id!, name: input.name, description: input.description, clientId });
    return { id, clientId, clientSecret };
  }),
  revoke: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.revokeConsumerApp(input.id);
    await db.createAuditEvent({ action: "consumer_app.revoked", actionType: "delete", targetType: "consumer_app", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── Subscriptions Router ────────────────────────────────────────────────────
const subscriptionRouter = router({
  list: tenantProcedure.input(z.object({ page: z.number().default(1), perPage: z.number().default(100) }).optional()).query(async ({ ctx, input }) => {
    const result = await db.getSubscriptionsByTenant(ctx.tenantId, input ?? {});
    const status = await graviteeSync.getConnectionStatus();
    return { data: result.data.map((s: any) => ({ ...s, syncSource: status.mode })), total: result.total };
  }),
  create: tenantProcedure.input(z.object({
    consumerAppId: z.number(),
    planId: z.number(),
    apiId: z.number(),
  })).mutation(async ({ ctx, input }) => {
    const result = await graviteeSync.createSubscriptionHybrid({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "subscription.created", actionType: "approve", targetType: "subscription", targetId: String(result.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "approved", "rejected", "revoked", "expired"]),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateSubscription(id, data);
    return { success: true };
  }),
  revoke: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.revokeSubscription(input.id);
    await db.createAuditEvent({ action: "subscription.revoked", actionType: "delete", targetType: "subscription", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  approve: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const result = await graviteeSync.approveSubscriptionHybrid(input.id);
    await db.createAuditEvent({ action: "subscription.approved", actionType: "approve", targetType: "subscription", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true, apiKey: result.apiKey };
  }),
  reject: tenantProcedure.input(z.object({ id: z.number(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
    await graviteeSync.rejectSubscriptionHybrid(input.id, input.reason);
    await db.createAuditEvent({ action: "subscription.rejected", actionType: "reject", targetType: "subscription", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  rotateKey: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    const sub = await db.getSubscriptionById(input.id);
    if (!sub || (sub as any).tenantId !== ctx.tenantId) throw new TRPCError({ code: "NOT_FOUND", message: "Subscription not found" });
    const result = await graviteeSync.rotateSubscriptionApiKeyHybrid(input.id);
    await db.createAuditEvent({ action: "subscription.key_rotated", actionType: "update", targetType: "subscription", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { apiKey: result.apiKey };
  }),
});

// ─── Policies Router ─────────────────────────────────────────────────────────
const policyRouter = router({
  list: tenantProcedure.input(z.object({ apiId: z.number().optional() })).query(async ({ ctx, input }) => {
    if (input.apiId) return db.getPoliciesByApi(input.apiId);
    return db.getPoliciesByTenant(ctx.tenantId);
  }),
  create: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
    name: z.string().min(1),
    type: z.enum(["masking", "rate_limit", "geoip", "vault_secret", "cors", "ip_filtering", "jwt_validation", "oauth2"]),
    phase: z.enum(["request", "response", "both"]).default("both"),
    configuration: z.any(),
    enabled: z.boolean().default(true),
    priority: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createPolicy({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "policy.created", actionType: "create", targetType: "policy", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    enabled: z.boolean().optional(),
    configuration: z.any().optional(),
    priority: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.updatePolicy(id, data);
    const action = data.enabled === true ? "policy.enabled" : data.enabled === false ? "policy.disabled" : "policy.updated";
    await db.createAuditEvent({ action, actionType: "update", targetType: "policy", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deletePolicy(input.id);
    await db.createAuditEvent({ action: "policy.deleted", actionType: "delete", targetType: "policy", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  // Enforce this API's ip_filtering policies at the gateway (allow/deny by IP/CIDR).
  deployIpFiltering: tenantWriteProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ ctx, input }) => {
    let result;
    try {
      result = await graviteeSync.deployApiIpFilteringToGateway(input.apiId);
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: graviteeErrorMessage(err, "Failed to deploy IP filtering to the gateway") });
    }
    await db.createAuditEvent({ action: "ip_filtering.deployed", actionType: "update", targetType: "api", targetId: String(input.apiId), tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
});

// ─── Audit Trail Router ──────────────────────────────────────────────────────
const auditRouter = router({
  list: tenantProcedure.input(z.object({
    actorId: z.number().optional(),
    actionType: z.string().optional(),
    targetType: z.string().optional(),
    search: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().default(50),
    offset: z.number().default(0),
  })).query(async ({ ctx, input }) => {
    return db.getAuditEvents({
      ...input,
      tenantId: ctx.tenantId,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    });
  }),
  // Returns all deployment records with their full operation logs
  deploymentLogs: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
    status: z.string().optional(),
    limit: z.number().default(50),
  })).query(async ({ ctx, input }) => {
    const all = await db.getApiDeployments(ctx.tenantId, input.apiId);
    const filtered = input.status ? all.filter((d: any) => d.status === input.status) : all;
    return filtered.slice(0, input.limit);
  }),
  // Proxies Gravitee API-level gateway logs for a given API
  gatewayLogs: tenantProcedure.input(z.object({
    graviteeApiId: z.string(),
    page: z.number().default(1),
    size: z.number().default(50),
  })).query(async ({ input }) => {
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode !== "live") return { data: [], total: 0, connected: false };
    try {
      const resp = await gravitee.getApiLogs(input.graviteeApiId, { page: input.page, size: input.size });
      return { ...resp, connected: true };
    } catch {
      return { data: [], total: 0, connected: true, error: "Failed to fetch logs from Gravitee" };
    }
  }),
  export: tenantAdminProcedure.input(z.object({
    format: z.enum(["csv", "jsonl"]).default("jsonl"),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { events } = await db.getAuditEvents({
      tenantId: ctx.tenantId,
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
    await db.createAuditEvent({ action: "audit.exported", actionType: "export", targetType: "audit_log", tenantId: ctx.tenantId, ...actor(ctx) });
    return { content, signature, format: input.format, recordCount: events.length };
  }),
});

// ─── Billing Router ──────────────────────────────────────────────────────────
const billingRouter = router({
  invoices: tenantProcedure.query(async ({ ctx }) => {
    return db.getInvoicesByTenant(ctx.tenantId);
  }),
  createInvoice: tenantProcedure.input(z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
    lineItems: z.any(),
    subtotal: z.string(),
    cgst: z.string().default("0"),
    sgst: z.string().default("0"),
    igst: z.string().default("0"),
    total: z.string(),
    dueDate: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const invoiceNumber = `CI-INV-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;
    const id = await db.createInvoice({
      ...input,
      tenantId: ctx.tenantId,
      invoiceNumber,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      status: "issued",
    });
    await db.createAuditEvent({ action: "invoice.created", actionType: "create", targetType: "invoice", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { id, invoiceNumber };
  }),
  updateInvoice: tenantProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["draft", "issued", "paid", "overdue", "cancelled", "disputed"]).optional(),
    paidAt: z.string().optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateInvoice(id, { ...data, paidAt: data.paidAt ? new Date(data.paidAt) : undefined });
    return { success: true };
  }),
  usage: tenantProcedure.input(z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).query(async ({ ctx, input }) => {
    const start = input.startDate ? new Date(input.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = input.endDate ? new Date(input.endDate) : new Date();
    const [usage, metering] = await Promise.all([
      db.getUsageByTenant(ctx.tenantId, start, end),
      db.aggregateMeteringForBilling(ctx.tenantId, start, end),
    ]);
    return { usage, metering };
  }),
});

// ─── Support Router ──────────────────────────────────────────────────────────
const supportRouter = router({
  tickets: tenantProcedure.query(async ({ ctx }) => {
    return db.getSupportTicketsByTenant(ctx.tenantId);
  }),
  createTicket: tenantProcedure.input(z.object({
    subject: z.string().min(1),
    description: z.string().optional(),
    severity: z.enum(["S1", "S2", "S3", "S4"]).default("S3"),
    category: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createSupportTicket({ ...input, tenantId: ctx.tenantId, userId: ctx.user.id });
    await db.createAuditEvent({ action: "ticket.created", actionType: "create", targetType: "support_ticket", targetId: String(id), tenantId: ctx.tenantId, actorId: ctx.user.id, actorName: ctx.user.name || undefined });
    return { id };
  }),
  updateTicket: tenantProcedure.input(z.object({
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
  // artifacts are platform-wide (optionally tenant-scoped) — admin-managed
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
  byokKeys: tenantProcedure.query(async ({ ctx }) => {
    return db.getByokKeysByTenant(ctx.tenantId);
  }),
  createByokKey: tenantProcedure.input(z.object({
    name: z.string().min(1),
    provider: z.enum(["vault", "aws_kms", "azure_keyvault"]),
    keyIdentifier: z.string().min(1),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createByokKey({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "byok_key.created", actionType: "create", targetType: "byok_key", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  updateByokKey: tenantProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "rotating", "revoked"]).optional(),
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db.updateByokKey(id, data);
    return { success: true };
  }),
  submitDpdpRequest: tenantProcedure.input(z.object({
    action: z.enum(["access", "correct", "erase", "restrict", "portability", "object", "nomination"]),
    subject: z.string().min(1),
    notes: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const actionLabels: Record<string, string> = {
      access: "Right to Access", correct: "Right to Correction", erase: "Right to Erasure",
      restrict: "Right to Restrict Processing", portability: "Right to Data Portability",
      object: "Right to Object", nomination: "Nomination",
    };
    const [requestId] = await Promise.all([
      db.createDpdpRequest({
        tenantId: ctx.tenantId,
        userId: ctx.user.id,
        action: input.action,
        subject: input.subject,
        notes: input.notes,
      }),
      db.createAuditEvent({
        action: `dpdp.${input.action}`,
        actionType: "create",
        targetType: "data_principal",
        targetName: input.subject,
        actorName: "data_principal",
        tenantId: ctx.tenantId,
      }),
    ]);
    // Fire in-app notification to the submitting user (DPO awareness)
    await db.createNotification({
      tenantId: ctx.tenantId,
      userId: ctx.user.id,
      type: "security",
      title: `DPDP Request: ${actionLabels[input.action]}`,
      message: `A ${actionLabels[input.action]} request for "${input.subject}" has been submitted. 30-day SLA clock has started.`,
      actionUrl: "/compliance",
    });
    return { success: true, requestId };
  }),
  dpdpRequests: tenantProcedure.query(async ({ ctx }) => {
    return db.getDpdpRequests(ctx.tenantId);
  }),
  updateDpdpRequest: tenantProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["pending", "in_progress", "completed", "rejected", "overdue"]).optional(),
    response: z.string().optional(),
    assignedTo: z.string().optional(),
    completedAt: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, completedAt, ...rest } = input;
    await db.updateDpdpRequest(id, {
      ...rest,
      completedAt: completedAt ? new Date(completedAt) : undefined,
    });
    await db.createAuditEvent({ action: "dpdp.request.updated", actionType: "update", targetType: "dpdp_request", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  // Consent records
  consentList: tenantProcedure.input(z.object({
    dataPrincipalId: z.string().optional(),
  })).query(async ({ ctx, input }) => {
    return db.getConsentRecords(ctx.tenantId, input.dataPrincipalId);
  }),
  grantConsent: tenantProcedure.input(z.object({
    dataPrincipalId: z.string().min(1),
    purpose: z.string().min(1),
    expiresAt: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createConsentRecord({
      tenantId: ctx.tenantId,
      dataPrincipalId: input.dataPrincipalId,
      purpose: input.purpose,
      status: "granted",
      grantedAt: new Date(),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    await db.createAuditEvent({ action: "consent.granted", actionType: "create", targetType: "consent_record", targetId: String(id), targetName: input.purpose, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  revokeConsent: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.revokeConsentRecord(input.id);
    await db.createAuditEvent({ action: "consent.revoked", actionType: "update", targetType: "consent_record", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  // Article 19 processing register
  processingActivities: tenantProcedure.query(async ({ ctx }) => {
    return db.getDataProcessingActivities(ctx.tenantId);
  }),
  createProcessingActivity: tenantProcedure.input(z.object({
    name: z.string().min(1),
    purpose: z.string().min(1),
    dataCategories: z.array(z.string()).optional(),
    recipients: z.array(z.string()).optional(),
    retentionPeriodDays: z.number().int().positive().optional(),
    legalBasis: z.enum(["consent", "contract", "legal_obligation", "vital_interests", "public_task", "legitimate_interests"]).optional(),
    dpdpActSection: z.string().optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
    dpiaConducted: z.boolean().optional(),
    dpiaDate: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createDataProcessingActivity({
      tenantId: ctx.tenantId,
      name: input.name,
      purpose: input.purpose,
      dataCategories: input.dataCategories,
      recipients: input.recipients,
      retentionPeriodDays: input.retentionPeriodDays,
      legalBasis: (input.legalBasis as any) ?? "consent",
      dpdpActSection: input.dpdpActSection,
      riskLevel: (input.riskLevel as any) ?? "low",
      dpiaConducted: input.dpiaConducted ?? false,
      dpiaDate: input.dpiaDate ? new Date(input.dpiaDate) : undefined,
    });
    await db.createAuditEvent({ action: "processing_activity.created", actionType: "create", targetType: "processing_activity", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  updateProcessingActivity: tenantProcedure.input(z.object({
    id: z.number(),
    name: z.string().optional(),
    purpose: z.string().optional(),
    dataCategories: z.array(z.string()).optional(),
    recipients: z.array(z.string()).optional(),
    retentionPeriodDays: z.number().int().positive().optional(),
    legalBasis: z.enum(["consent", "contract", "legal_obligation", "vital_interests", "public_task", "legitimate_interests"]).optional(),
    dpdpActSection: z.string().optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
    dpiaConducted: z.boolean().optional(),
    dpiaDate: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, dpiaDate, ...rest } = input;
    await db.updateDataProcessingActivity(id, {
      ...rest,
      legalBasis: rest.legalBasis as any,
      riskLevel: rest.riskLevel as any,
      dpiaDate: dpiaDate ? new Date(dpiaDate) : undefined,
    });
    return { success: true };
  }),
});

// ─── RBAC Router ─────────────────────────────────────────────────────────────
const rbacRouter = router({
  roles: tenantProcedure.query(async ({ ctx }) => {
    return db.getRolesByTenant(ctx.tenantId);
  }),
  createRole: tenantProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    scope: z.enum(["platform", "workspace", "api", "application"]).default("workspace"),
    permissions: z.any(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createRole({ ...input, tenantId: ctx.tenantId });
    return { id };
  }),
  assignments: protectedProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
    return db.getRoleAssignments(input.userId);
  }),
  assignRole: adminProcedure.input(z.object({
    userId: z.number(),
    roleId: z.number(),
    tenantId: z.number().optional(),
    workspaceId: z.number().optional(),
  })).mutation(async ({ input }) => {
    const id = await db.assignRole(input);
    return { id };
  }),
  tenantAssignments: tenantProcedure.query(async ({ ctx }) => {
    return db.getRoleAssignmentsByTenant(ctx.tenantId);
  }),
  removeAssignment: adminProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.removeRoleAssignment(input.id);
    return { success: true };
  }),
  deleteRole: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteRole(input.id);
    await db.createAuditEvent({ action: "role.deleted", actionType: "delete", targetType: "role", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── Analytics Router ────────────────────────────────────────────────────────
const analyticsRouter = router({
  dashboard: protectedProcedure.input(z.object({ tenantId: z.number().optional() })).query(async ({ ctx, input }) => {
    // Platform admins with no explicit tenantId get platform-wide stats (tenantId=null)
    const tid = ctx.user.role === "admin" && !input.tenantId ? null : resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, input.tenantId);
    return db.getDashboardStats(tid ?? 0);
  }),
  usage: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })).query(async ({ ctx, input }) => {
    // Platform admins with no explicit tenantId see all tenants' usage
    const tid: number | null = ctx.user.role === "admin" && !input.tenantId
      ? null
      : resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, input.tenantId);
    return db.getUsageByTenant(tid, input.startDate ? new Date(input.startDate) : undefined, input.endDate ? new Date(input.endDate) : undefined);
  }),
  metering: protectedProcedure.input(z.object({
    tenantId: z.number().optional(),
    pipeline: z.enum(["customer_facing", "sify_internal"]).optional(),
  })).query(async ({ ctx, input }) => {
    const tid: number | null = ctx.user.role === "admin" && !input.tenantId
      ? null
      : resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, input.tenantId);
    return db.getMeteringStats(tid, input.pipeline);
  }),
  // Record a single API call (from Try It or gateway) into metering + usage_records
  recordCall: protectedProcedure.input(z.object({
    apiId: z.number(),
    statusCode: z.number().default(200),
    latencyMs: z.number().default(45),
    method: z.string().default("GET"),
    endpoint: z.string().optional(),
  })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, undefined);
    await db.createMeteringEvent({
      tenantId: tid,
      apiId: input.apiId,
      method: input.method,
      statusCode: input.statusCode,
      latencyMs: input.latencyMs,
      requestBytes: Math.floor(Math.random() * 500) + 100,
      responseBytes: Math.floor(Math.random() * 2000) + 200,
      pipeline: "customer_facing",
      endpoint: input.endpoint || null,
    });
    // Also upsert a usage_record for today so the analytics chart updates
    await db.upsertTodayUsageRecord(tid, input.apiId, input.statusCode >= 400);
    return { success: true };
  }),
  // Generate simulated traffic burst for demo purposes
  simulateTraffic: protectedProcedure.input(z.object({
    apiId: z.number().optional(),
    count: z.number().default(50),
  })).mutation(async ({ ctx, input }) => {
    const tid = resolveEffectiveTenantId(ctx.user.role, ctx.user.tenantId ?? 0, undefined);
    // Scope simulated traffic to the caller's own published APIs so the metrics
    // they see actually move for the APIs they created (not cross-tenant seed data).
    const publishedApis = await db.getPublishedApisByTenant(tid);
    const targetApis = input.apiId
      ? publishedApis.filter((a: any) => a.id === input.apiId)
      : publishedApis.slice(0, 5);
    if (!targetApis.length) return { inserted: 0 };

    const methods = ["GET", "POST", "GET", "GET", "PUT"];
    const statuses = [200, 200, 200, 200, 201, 400, 500];
    let inserted = 0;

    for (let i = 0; i < input.count; i++) {
      const api = targetApis[i % targetApis.length];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const method = methods[Math.floor(Math.random() * methods.length)];
      await db.createMeteringEvent({
        tenantId: (api as any).tenantId || tid,
        apiId: (api as any).id,
        method,
        statusCode: status,
        latencyMs: Math.floor(Math.random() * 200) + 10,
        requestBytes: Math.floor(Math.random() * 1024) + 128,
        responseBytes: Math.floor(Math.random() * 4096) + 256,
        pipeline: "customer_facing",
        endpoint: null,
      });
      await db.upsertTodayUsageRecord((api as any).tenantId || tid, (api as any).id, status >= 400);
      inserted++;
    }
    return { inserted };
  }),
  // Live Gravitee platform analytics — not tenant-scoped
  graviteeMetrics: protectedProcedure.input(z.object({
    from: z.number().optional(),
    to: z.number().optional(),
  })).query(async ({ input }) => {
    const now = Date.now();
    const from = input.from || now - 24 * 60 * 60 * 1000;
    const to = input.to || now;
    return graviteeSync.getPlatformAnalyticsHybrid(from, to);
  }),
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
        return localClusters.map((c: any) => {
          const matchingInstances = instances.filter(i => {
            const tagMatch = (i.tags || []).some((t: string) => (c.shardingTags || []).includes(t));
            const tenantMatch = !!i.tenant && i.tenant === c.region;
            // An untagged gateway reports to the DEFAULT environment; attribute it to DEFAULT-env clusters.
            const defaultMatch = (!i.tags || i.tags.length === 0) && (c.graviteeEnvId || "DEFAULT") === "DEFAULT";
            return tagMatch || tenantMatch || defaultMatch;
          });
          const started = matchingInstances.filter(i => i.state === "STARTED");
          // Health reflects nodes actually serving traffic; stale stopped instances don't count.
          const liveStatus = started.length > 0 ? "healthy" : "offline";
          return {
            ...c,
            // Derive health from the live gateway, not the static DB columns.
            status: liveStatus,
            nodeCount: started.length,
            stoppedNodeCount: matchingInstances.length - started.length,
            gatewayVersion: (started[0] || matchingInstances[0])?.version ?? null,
            // We don't collect per-node CPU/RPS from the gateway yet — don't show fabricated numbers.
            cpuUsagePercent: null,
            memoryUsagePercent: null,
            requestsPerSecond: null,
            liveNodeCount: matchingInstances.length,
            liveInstances: matchingInstances.slice(0, 5),
            syncSource: "gravitee" as const,
          };
        });
      } catch { /* fallback */ }
    }
    // Gravitee unreachable: registry rows only, health unknown (don't imply live health).
    return localClusters.map((c: any) => ({ ...c, status: "unknown", syncSource: "local" as const }));
  }),
  createCluster: protectedProcedure.input(z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    region: z.string().min(1),
    tier: z.enum(["shared", "dedicated", "sovereign"]).default("shared"),
    maxNodes: z.number().default(10),
    shardingTags: z.array(z.string()).optional(),
    graviteeVersion: z.string().optional(),
    graviteeEnvId: z.string().default("DEFAULT"),
    graviteeOrgId: z.string().default("DEFAULT"),
    managementUrl: z.string().optional(),
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
  deployments: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
    clusterId: z.number().optional(),
  })).query(async ({ ctx, input }) => {
    const localDeployments = await db.getApiDeployments(ctx.tenantId, input.apiId, input.clusterId);
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode === "live") {
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
  deploy: tenantWriteProcedure.input(z.object({
    apiId: z.number(),
    // clusterIds: specific cluster IDs, or "all" to deploy to every registered cluster
    clusterIds: z.union([z.array(z.number()), z.literal("all")]),
    version: z.string(),
    strategy: z.enum(["rolling", "blue_green", "canary"]).default("rolling"),
    configuration: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const allClusters = await db.getGatewayClusters();
    const targetIds = input.clusterIds === "all"
      ? allClusters.map((c: any) => c.id)
      : input.clusterIds;

    if (targetIds.length === 0) throw new Error("No clusters selected for deployment");

    const results = await Promise.all(
      targetIds.map(clusterId =>
        graviteeSync.deployApiHybrid({ ...input, clusterId, tenantId: ctx.tenantId })
      )
    );
    await db.createAuditEvent({ action: "api.deployed", actionType: "deploy", targetType: "api", targetId: String(input.apiId), tenantId: ctx.tenantId, ...actor(ctx) });
    return results;
  }),
  undeploy: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await graviteeSync.undeployApiHybrid(input.id);
    return { success: true };
  }),
  instances: protectedProcedure.query(async () => {
    return graviteeSync.getGatewayInstancesHybrid();
  }),
  connectionStatus: protectedProcedure.query(async () => {
    return graviteeSync.getConnectionStatus();
  }),
  startApi: tenantProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ ctx, input }) => {
    const api = await db.getApiById(input.apiId);
    if (!api || (api as any).tenantId !== ctx.tenantId) throw new Error("API not found");
    return graviteeSync.startApiHybrid(input.apiId);
  }),
  stopApi: tenantProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ ctx, input }) => {
    const api = await db.getApiById(input.apiId);
    if (!api || (api as any).tenantId !== ctx.tenantId) throw new Error("API not found");
    return graviteeSync.stopApiHybrid(input.apiId);
  }),
});

// ─── Developer Portal Router ────────────────────────────────────────────────
const devPortalRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    const status = await graviteeSync.getConnectionStatus();
    if (status.mode === "live") {
      try {
        const { apis } = await graviteeSync.getPortalApisHybrid();
        const localPortals = await db.getDeveloperPortals(ctx.tenantId);
        return localPortals.map((p: any) => ({ ...p, portalApiCount: apis.length, syncSource: "gravitee" }));
      } catch { /* fallback */ }
    }
    const portals = await db.getDeveloperPortals(ctx.tenantId);
    return portals.map((p: any) => ({ ...p, syncSource: "local" }));
  }),
  create: tenantProcedure.input(z.object({
    name: z.string().min(1),
    customDomain: z.string().optional(),
    description: z.string().optional(),
    enableSignup: z.boolean().default(true),
    enableAutoApprove: z.boolean().default(false),
    theme: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createDeveloperPortal({ ...input, tenantId: ctx.tenantId, status: "draft" });
    await db.createAuditEvent({ action: "developer_portal.created", actionType: "create", targetType: "developer_portal", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
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
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.updateDeveloperPortal(id, data);
    // When activating the portal or updating published APIs, sync to Gravitee Portal
    if (data.status === "active" || data.publishedApis) {
      const graviteeModule = await import("./gravitee");
      const connectionStatus = await graviteeSync.getConnectionStatus();
      if (connectionStatus.mode === "live" && data.publishedApis) {
        for (const apiId of data.publishedApis) {
          const localApi = await db.getApiById(apiId);
          const graviteeApiId = (localApi as any)?.graviteeApiId;
          if (graviteeApiId) {
            graviteeModule.updateApi(graviteeApiId, { visibility: "PUBLIC" })
              .catch((e: any) => logger.warn({ err: e }, "[DevPortal] Failed to set API visibility:"));
          }
        }
      }
    }
    return { success: true };
  }),
});

// ─── Data Masking Router (F-01) ─────────────────────────────────────────────
const maskingRouter = router({
  rules: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
  })).query(async ({ ctx, input }) => {
    return db.getMaskingRules(ctx.tenantId, input.apiId);
  }),
  createRule: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
    name: z.string().min(1),
    jsonPath: z.string().min(1),
    action: z.enum(["full_replace", "partial", "hash_sha256", "redact"]),
    replacement: z.string().optional(),
    showLastN: z.number().optional(),
    category: z.enum(["pan_card", "aadhaar", "credit_card", "email", "phone", "iban", "ifsc", "custom"]).default("custom"),
    phase: z.enum(["request", "response", "both"]).default("both"),
    priority: z.number().default(0),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createMaskingRule({ ...input, tenantId: ctx.tenantId });
    await db.createAuditEvent({ action: "masking_rule.created", actionType: "create", targetType: "masking_rule", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  updateRule: tenantProcedure.input(z.object({
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
  deleteRule: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db.deleteMaskingRule(input.id);
    return { success: true };
  }),
  // Compile this API's response masking rules into a gateway policy and redeploy.
  deployToGateway: tenantWriteProcedure.input(z.object({ apiId: z.number() })).mutation(async ({ ctx, input }) => {
    let result;
    try {
      result = await graviteeSync.deployApiMaskingToGateway(input.apiId);
    } catch (err) {
      throw new TRPCError({ code: "BAD_REQUEST", message: graviteeErrorMessage(err, "Failed to deploy masking to the gateway") });
    }
    await db.createAuditEvent({ action: "masking.deployed", actionType: "update", targetType: "api", targetId: String(input.apiId), tenantId: ctx.tenantId, ...actor(ctx) });
    return result;
  }),
});

// ─── DCR Router (F-06) ──────────────────────────────────────────────────────
const dcrRouter = router({
  clients: tenantProcedure.query(async ({ ctx }) => {
    return db.getDcrClients(ctx.tenantId);
  }),
  register: tenantProcedure.input(z.object({
    clientName: z.string().min(1),
    redirectUris: z.array(z.string()).optional(),
    grantTypes: z.array(z.string()).default(["client_credentials"]),
    responseTypes: z.array(z.string()).optional(),
    tokenEndpointAuthMethod: z.string().default("client_secret_basic"),
    scope: z.string().optional(),
    autoSubscribePlan: z.number().optional(),
  })).mutation(async ({ ctx, input }) => {
    const clientId = `dcr_${nanoid(24)}`;
    const clientSecret = nanoid(48);
    const clientSecretHash = crypto.createHash("sha256").update(clientSecret).digest("hex");
    const registrationAccessToken = nanoid(64);
    const id = await db.createDcrClient({ ...input, tenantId: ctx.tenantId, clientId, clientSecretHash, registrationAccessToken });
    await db.createAuditEvent({ action: "dcr_client.registered", actionType: "create", targetType: "dcr_client", targetId: String(id), targetName: input.clientName, tenantId: ctx.tenantId, ...actor(ctx) });
    const status = await graviteeSync.getConnectionStatus();
    let graviteeAppId: string | undefined;
    if (status.mode === "live") {
      try {
        const { createApplication } = await import("./gravitee");
        const app = await createApplication({
          name: input.clientName,
          description: `DCR client for tenant ${ctx.tenantId}`,
          type: "BACKEND_TO_BACKEND",
          settings: { app: { type: "simple", client_id: clientId } },
        });
        graviteeAppId = app.id;
      } catch (e) { logger.warn({ err: e }, "[GraviteeSync] DCR app registration failed:"); }
    }
    return { id, clientId, clientSecret, registrationAccessToken, graviteeAppId };
  }),
  rotateSecret: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const newSecret = nanoid(48);
    const newHash = crypto.createHash("sha256").update(newSecret).digest("hex");
    await db.updateDcrClient(input.id, { clientSecretHash: newHash, lastRotatedAt: new Date() });
    return { clientSecret: newSecret };
  }),
  updateStatus: tenantProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["active", "suspended", "revoked"]),
  })).mutation(async ({ input }) => {
    await db.updateDcrClient(input.id, { status: input.status });
    return { success: true };
  }),
});

// ─── Identity Provider Router (F-04) ────────────────────────────────────────
const idpRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.getIdentityProviders(ctx.tenantId);
  }),
  create: tenantProcedure.input(z.object({
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
  })).mutation(async ({ ctx, input }) => {
    if (input.issuerUrl) validateBackendUrl(input.issuerUrl, "issuerUrl");
    if (input.discoveryUrl) validateBackendUrl(input.discoveryUrl, "discoveryUrl");
    if (input.samlMetadataUrl) validateBackendUrl(input.samlMetadataUrl, "samlMetadataUrl");
    const id = await db.createIdentityProvider({ ...input, tenantId: ctx.tenantId, status: "inactive" });
    await db.createAuditEvent({ action: "idp.created", actionType: "create", targetType: "identity_provider", targetId: String(id), targetName: input.name, tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
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
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteIdentityProvider(input.id);
    await db.createAuditEvent({ action: "idp.deleted", actionType: "delete", targetType: "identity_provider", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── API Environments / APIOps Router (F-12) ────────────────────────────────
const envRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.getApiEnvironments(ctx.tenantId);
  }),
  create: tenantProcedure.input(z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    order: z.number().default(0),
    clusterId: z.number().optional(),
    gitBranch: z.string().optional(),
    gitFolder: z.string().optional(),
    argoAppName: z.string().optional(),
    autoPromote: z.boolean().default(false),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createApiEnvironment({ ...input, tenantId: ctx.tenantId });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
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
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteApiEnvironment(input.id);
    return { success: true };
  }),
});

// ─── Alert Rules Router (F-11) ──────────────────────────────────────────────
const alertRouter = router({
  rules: tenantProcedure.query(async ({ ctx }) => {
    return db.getAlertRules(ctx.tenantId);
  }),
  create: tenantProcedure.input(z.object({
    name: z.string().min(1),
    type: z.enum(["error_rate", "latency_p99", "quota_usage", "cert_expiry", "subscription_expiry", "custom"]),
    condition: z.any().optional(),
    threshold: z.number().optional(),
    duration: z.string().optional(),
    severity: z.enum(["info", "warning", "critical"]).default("warning"),
    channels: z.array(z.object({ type: z.string(), target: z.string() })).optional(),
    enabled: z.boolean().default(true),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createAlertRule({ ...input, tenantId: ctx.tenantId, threshold: input.threshold ? String(input.threshold) : undefined, channels: input.channels || [] });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
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
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteAlertRule(input.id);
    return { success: true };
  }),
});

// ─── Event Entrypoints Router (F-13) ────────────────────────────────────────
const eventRouter = router({
  entrypoints: tenantProcedure.input(z.object({
    apiId: z.number().optional(),
  })).query(async ({ ctx, input }) => {
    return db.getEventEntrypoints(input.apiId, ctx.tenantId);
  }),
  create: tenantProcedure.input(z.object({
    apiId: z.number(),
    type: z.enum(["kafka", "mqtt", "rabbitmq", "webhook"]),
    topicPattern: z.string().optional(),
    brokerUrl: z.string().optional(),
    authMethod: z.enum(["none", "sasl_plain", "sasl_scram", "mtls", "api_key"]).default("none"),
    configuration: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    if (input.brokerUrl) validateBackendUrl(input.brokerUrl, "brokerUrl");
    const id = await db.createEventEntrypoint({ ...input, tenantId: ctx.tenantId, status: "inactive" });
    await db.createAuditEvent({ action: "event_entrypoint.created", actionType: "create", targetType: "event_entrypoint", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
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
  delete: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deleteEventEntrypoint(input.id);
    return { success: true };
  }),
});

// ─── Policy Chains Router ───────────────────────────────────────────────────
const policyChainRouter = router({
  list: tenantProcedure.input(z.object({ apiId: z.number() })).query(async ({ input }) => {
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
  add: tenantProcedure.input(z.object({
    apiId: z.number(),
    phase: z.enum(["request", "response", "connect", "subscribe", "publish"]),
    policyId: z.number(),
    order: z.number(),
    condition: z.string().optional(),
    configuration: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const id = await db.createPolicyChain({ ...input, tenantId: ctx.tenantId });
    // Push updated flows to Gravitee (best-effort)
    const chains = await db.getPolicyChains(input.apiId);
    const localApi = await db.getApiById(input.apiId);
    const graviteeApiId = (localApi as any)?.graviteeApiId;
    if (graviteeApiId) {
      const graviteeModule = await import("./gravitee");
      graviteeModule.updateApiFlows(graviteeApiId, chains.map((c: any) => ({
        id: String(c.id),
        name: c.phase,
        phase: c.phase.toUpperCase(),
        enabled: c.enabled !== false,
        configuration: c.configuration ?? {},
      }))).catch((e: any) => logger.warn({ err: e }, "[PolicyChain] Failed to sync flows to Gravitee:"));
    }
    await db.createAuditEvent({ action: "policy.attached", actionType: "update", targetType: "api", targetId: String(input.apiId), tenantId: ctx.tenantId, ...actor(ctx) });
    return { id };
  }),
  update: tenantProcedure.input(z.object({
    id: z.number(),
    order: z.number().optional(),
    condition: z.string().optional(),
    enabled: z.boolean().optional(),
    configuration: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    await db.updatePolicyChain(id, data);
    const action = data.enabled === true ? "policy.chain_enabled" : data.enabled === false ? "policy.chain_disabled" : "policy.chain_updated";
    await db.createAuditEvent({ action, actionType: "update", targetType: "policy_chain", targetId: String(id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
  remove: tenantProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
    await db.deletePolicyChain(input.id);
    await db.createAuditEvent({ action: "policy.detached", actionType: "delete", targetType: "policy_chain", targetId: String(input.id), tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── Kafka Reporter Router ───────────────────────────────────────────────────
const kafkaReporterRouter = router({
  get: tenantProcedure.query(async ({ ctx }) => {
    return db.getKafkaReporterConfig(ctx.tenantId);
  }),
  save: tenantProcedure.input(z.object({
    brokers: z.string().optional(),
    enabled: z.boolean().optional(),
    reporters: z.any().optional(),
    topicMappings: z.any().optional(),
  })).mutation(async ({ ctx, input }) => {
    await db.upsertKafkaReporterConfig(ctx.tenantId, input);
    await db.createAuditEvent({ action: "kafka_reporter.updated", actionType: "update", targetType: "kafka_reporter", tenantId: ctx.tenantId, ...actor(ctx) });
    return { success: true };
  }),
});

// ─── Main App Router ─────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { passwordHash: _, ...safe } = ctx.user;
      return safe;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    updateMe: protectedProcedure.input(z.object({
      name: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updateUser(ctx.user.id, { name: input.name });
      const user = await db.getUserById(ctx.user.id);
      if (!user) return null;
      const { passwordHash: _, ...safe } = user;
      return safe;
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
  kafkaReporter: kafkaReporterRouter,
});

export type AppRouter = typeof appRouter;
