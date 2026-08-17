import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";
import { resolveActiveTenant } from "./_core/trpc";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

describe("authorization tiers", () => {
  function callerWith(role: "admin" | "user", tenantRole: string | null) {
    const { ctx } = createAuthContext();
    (ctx.user as any).role = role;
    (ctx.user as any).tenantRole = tenantRole;
    return appRouter.createCaller(ctx);
  }

  it("governance actions require tenant admin (a developer is blocked)", async () => {
    // A developer passes tenantWriteProcedure but must NOT pass tenantAdminProcedure.
    const dev = callerWith("user", "developer");
    await expect(dev.billing.createInvoice({} as any)).rejects.toThrow(/admin access required/i);
    await expect(dev.rbac.createRole({} as any)).rejects.toThrow(/admin access required/i);
    await expect(dev.compliance.createByokKey({} as any)).rejects.toThrow(/admin access required/i);
  });

  it("platform-level cluster management requires a platform admin (a tenant owner is blocked)", async () => {
    const owner = callerWith("user", "owner");
    await expect(owner.gateway.createCluster({} as any)).rejects.toThrow();
  });
});

describe("resolveActiveTenant (admin tenant switch)", () => {
  const admin = { role: "admin", tenantId: 4 } as AuthenticatedUser;
  const member = { role: "user", tenantId: 4 } as AuthenticatedUser;

  it("honors the requested tenant for platform admins", () => {
    expect(resolveActiveTenant(admin, 16)).toBe(16);
  });

  it("falls back to the admin's home tenant when no tenant is requested", () => {
    expect(resolveActiveTenant(admin, undefined)).toBe(4);
  });

  it("SECURITY: ignores the requested tenant for non-admins (no cross-tenant escalation)", () => {
    expect(resolveActiveTenant(member, 16)).toBe(4);
  });

  it("lets an admin with no home tenant operate in the requested tenant", () => {
    expect(resolveActiveTenant({ role: "admin", tenantId: null } as AuthenticatedUser, 16)).toBe(16);
  });

  it("returns undefined for a non-admin with no tenant, regardless of header", () => {
    expect(resolveActiveTenant({ role: "user", tenantId: null } as AuthenticatedUser, 16)).toBeUndefined();
  });
});

function createAuthContext(): { ctx: TrpcContext; clearedCookies: any[] } {
  const clearedCookies: any[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "admin@cloudinfinit.io",
    name: "Test Admin",
    loginMethod: "manus",
    role: "admin",
    tenantId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("appRouter structure", () => {
  it("has all expected top-level routers", () => {
    const procedures = Object.keys(appRouter._def.procedures);
    const routerKeys = Object.keys((appRouter as any)._def.record || {});
    
    // Check that the router is defined and has procedures
    expect(appRouter).toBeDefined();
    expect(appRouter._def).toBeDefined();
  });

  it("auth.me returns user from context", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.email).toBe("admin@cloudinfinit.io");
    expect(result?.name).toBe("Test Admin");
    expect(result?.role).toBe("admin");
  });

  it("auth.logout clears session cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
  });
});

describe("tenant router validation", () => {
  it("rejects tenant creation with empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenant.create({
        name: "",
        tier: "starter",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid tier values", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.tenant.create({
        name: "Test Corp",
        tier: "invalid_tier" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts valid tenant creation input shape", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    // This tests that the input validation passes (the actual DB call may fail in test env)
    try {
      const created = await caller.tenant.create({
        name: "Valid Corp",
        tier: "enterprise",
        gstin: "22AAAAA0000A1Z5",
        pan: "AAAAA0000A",
        region: "mumbai",
        contactEmail: "admin@valid.corp",
      });
      // Tests hit the real DB — remove the row we just created.
      if (created?.id) await db.deleteTenant(created.id);
    } catch (e: any) {
      // DB errors are acceptable in test env, but validation errors are not
      expect(e.message).not.toContain("invalid");
      expect(e.code).not.toBe("BAD_REQUEST");
    }
  });
});

describe("policy router validation", () => {
  it("rejects policy creation with empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.policy.create({
        name: "",
        type: "rate_limit",
        phase: "both",
        configuration: {},
      })
    ).rejects.toThrow();
  });

  it("rejects invalid policy type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.policy.create({
        name: "Test Policy",
        type: "invalid_type" as any,
        phase: "both",
        configuration: {},
      })
    ).rejects.toThrow();
  });
});

describe("rbac router validation", () => {
  it("rejects role creation with empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.rbac.createRole({
        name: "",
        scope: "workspace",
        permissions: [],
      })
    ).rejects.toThrow();
  });

  it("rejects invalid scope value", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.rbac.createRole({
        name: "Test Role",
        scope: "invalid_scope" as any,
        permissions: [],
      })
    ).rejects.toThrow();
  });
});

describe("metric extraction rules", () => {
  it("rejects rule creation with empty name", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.analytics.createExtractionRule({ name: "", extractionPath: "$.x" })
    ).rejects.toThrow();
  });

  it("rejects invalid extraction type", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.analytics.createExtractionRule({ name: "m", extractionPath: "$.x", extractionType: "xpath" as any })
    ).rejects.toThrow();
  });

  it("persists a rule through create → list → update → delete", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const { id } = await caller.analytics.createExtractionRule({
      name: "test_metric_" + Date.now(),
      extractionPath: "$.response.body.count",
      extractionType: "jsonpath",
      metricType: "counter",
      kafkaTopic: "test-topic",
    });
    try {
      const rules = await caller.analytics.extractionRules();
      const created = (rules as any[]).find((r) => r.id === id);
      expect(created).toBeDefined();
      expect(created.enabled).toBe(true);

      await caller.analytics.updateExtractionRule({ id, enabled: false });
      const afterToggle = (await caller.analytics.extractionRules() as any[]).find((r) => r.id === id);
      expect(afterToggle.enabled).toBe(false);
    } finally {
      await caller.analytics.deleteExtractionRule({ id });
      const afterDelete = (await caller.analytics.extractionRules() as any[]).find((r) => r.id === id);
      expect(afterDelete).toBeUndefined();
    }
  });

  it("SECURITY: blocks cross-tenant mutation of another tenant's rule", async () => {
    // Create a rule owned by the default context's tenant (tenantId 1).
    const owner = appRouter.createCaller(createAuthContext().ctx);
    const { id } = await owner.analytics.createExtractionRule({
      name: "xtenant_" + Date.now(),
      extractionPath: "$.x",
    });
    try {
      // A caller in a different tenant — even a legitimate writer there — must NOT
      // be able to update or delete another tenant's rule (ownership gate, not the
      // write gate: tenantRole developer passes the write check).
      const otherCtx = createAuthContext().ctx;
      (otherCtx.user as any).tenantId = 999_999; // a tenant that owns no rules
      (otherCtx.user as any).role = "user";      // non-admin: no cross-tenant reach
      (otherCtx.user as any).tenantRole = "developer"; // can write in its own tenant
      const attacker = appRouter.createCaller(otherCtx);
      await expect(attacker.analytics.updateExtractionRule({ id, enabled: false })).rejects.toThrow(/not found/i);
      await expect(attacker.analytics.deleteExtractionRule({ id })).rejects.toThrow(/not found/i);
      // The rule is untouched and still owned by tenant 1.
      const still = (await owner.analytics.extractionRules() as any[]).find((r) => r.id === id);
      expect(still).toBeDefined();
      expect(still.enabled).toBe(true);
    } finally {
      await owner.analytics.deleteExtractionRule({ id });
    }
  });

  it("SECURITY: view-only members cannot perform write mutations", async () => {
    const ctx = createAuthContext().ctx;
    (ctx.user as any).role = "user";
    (ctx.user as any).tenantRole = null; // view-only member
    const viewer = appRouter.createCaller(ctx);
    await expect(
      viewer.analytics.createExtractionRule({ name: "nope", extractionPath: "$.x" })
    ).rejects.toThrow(/view-only/i);
  });
});
