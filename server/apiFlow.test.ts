import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import type { TrpcContext } from "./_core/context";

// Admin context (tenantId 1). Admin may pass an explicit tenantId to
// tenant-scoped procedures, which we use for checkContextPath.
function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1, openId: "admin-user", email: "admin@sify.com", name: "Admin User",
      loginMethod: "manus", role: "admin", tenantId: 1,
      createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  } as TrpcContext;
}

// A real workspace so the apis.workspaceId FK is satisfied for fixtures.
async function anyWorkspaceId(): Promise<{ workspaceId: number; tenantId: number } | null> {
  for (const tid of [1, 4, 16]) {
    const ws = await db.getWorkspacesByTenant(tid);
    if (ws.length > 0) return { workspaceId: (ws[0] as any).id, tenantId: tid };
  }
  return null;
}

describe("api status transitions", () => {
  it("deprecate then retire persist and write precise audit actions", async () => {
    const ws = await anyWorkspaceId();
    if (!ws) return; // no seed workspace — skip
    const caller = appRouter.createCaller(createAdminContext());
    const apiId = await db.createApi({
      tenantId: 1, workspaceId: ws.workspaceId,
      name: "test-transition-" + Date.now(), version: "1.0.0", protocol: "rest",
    } as any);
    expect(apiId).toBeTruthy();
    try {
      // Deprecate/retire don't touch Gravitee (only "published" does).
      await caller.api.update({ id: apiId!, status: "deprecated" });
      expect((await db.getApiById(apiId!) as any).status).toBe("deprecated");

      await caller.api.update({ id: apiId!, status: "retired" });
      expect((await db.getApiById(apiId!) as any).status).toBe("retired");

      const { events } = await db.getAuditEvents({ tenantId: 1, limit: 100 });
      const actions = events.filter((e: any) => e.targetId === String(apiId)).map((e: any) => e.action);
      expect(actions).toContain("api.deprecated");
      expect(actions).toContain("api.retired");
    } finally {
      await db.deleteApi(apiId!);
    }
  });
});

describe("api.checkContextPath", () => {
  it("flags a taken path and allows a free one", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const ws = await anyWorkspaceId();
    if (!ws) return;
    const apiId = await db.createApi({
      tenantId: ws.tenantId, workspaceId: ws.workspaceId,
      name: "test-ctx-" + Date.now(), version: "1.0.0", protocol: "rest",
      contextPath: "/test-ctx-" + Date.now(),
    } as any);
    try {
      const created = await db.getApiById(apiId!) as any;
      const conflict = await caller.api.checkContextPath({ contextPath: created.contextPath, tenantId: ws.tenantId });
      expect(conflict.available).toBe(false);
      expect(conflict.conflictName).toBe(created.name);

      const free = await caller.api.checkContextPath({ contextPath: "/free-" + Date.now(), tenantId: ws.tenantId });
      expect(free.available).toBe(true);
    } finally {
      await db.deleteApi(apiId!);
    }
  });

  it("rejects the root path", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const res = await caller.api.checkContextPath({ contextPath: "/" });
    expect(res.available).toBe(false);
  });
});

describe("wizard flow: create API then attach a plan", () => {
  it("a plan created for an API appears in that API's plan list", async () => {
    const ws = await anyWorkspaceId();
    if (!ws) return;
    const caller = appRouter.createCaller(createAdminContext());
    // Local-only API (no graviteeApiId) so plan.create stays local.
    const apiId = await db.createApi({
      tenantId: 1, workspaceId: ws.workspaceId,
      name: "test-wizard-" + Date.now(), version: "1.0.0", protocol: "rest",
    } as any);
    try {
      const plan = await caller.plan.create({
        apiId: apiId!, name: "Gold", rateLimit: 100, rateLimitPeriod: "minute",
        quotaLimit: 10000, quotaPeriod: "month", autoApprove: true,
      });
      expect(plan.id).toBeTruthy();
      const plans = await caller.plan.list({ apiId: apiId! });
      expect(plans.some((p: any) => p.id === plan.id && p.name === "Gold")).toBe(true);
    } finally {
      const plans = await db.getPlansByApi(apiId!);
      for (const p of plans) await db.deletePlan((p as any).id);
      await db.deleteApi(apiId!);
    }
  });
});
