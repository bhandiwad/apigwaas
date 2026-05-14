import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@cloudinfinit.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("Gravitee integration - hybrid mode", () => {
  const caller = appRouter.createCaller(createAdminContext());

  it("gateway.connectionStatus returns local mode when Gravitee is not reachable", async () => {
    const status = await caller.gateway.connectionStatus();
    expect(status).toBeDefined();
    expect(status.mode).toBe("local");
    expect(status.connected).toBe(false);
  });

  it("gateway.instances returns data from local source when Gravitee is unavailable", async () => {
    const result = await caller.gateway.instances();
    expect(result).toBeDefined();
    expect(result.source).toBe("local");
    expect(Array.isArray(result.instances)).toBe(true);
  });

  it("analytics.graviteeMetrics returns local source when Gravitee is unavailable", async () => {
    const result = await caller.analytics.graviteeMetrics({});
    expect(result).toBeDefined();
    expect(result.source).toBe("local");
    expect(typeof result.totalCalls).toBe("number");
  });

  it("analytics.availablePolicies returns local source when Gravitee is unavailable", async () => {
    const result = await caller.analytics.availablePolicies();
    expect(result).toBeDefined();
    expect(result.source).toBe("local");
  });

  it("api.list returns apis with syncStatus when in local mode", async () => {
    const result = await caller.api.list({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
    // Each API should have a syncStatus field
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("syncStatus");
    }
  });
});
