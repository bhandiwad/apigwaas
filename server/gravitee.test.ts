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
      tenantId: 1,
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

  it("gateway.connectionStatus returns a mode and connected state", async () => {
    const status = await caller.gateway.connectionStatus();
    expect(status).toBeDefined();
    expect(["live", "local"]).toContain(status.mode);
    expect(typeof status.connected).toBe("boolean");
  });

  it("gateway.instances returns instances array with a source", async () => {
    const result = await caller.gateway.instances();
    expect(result).toBeDefined();
    expect(["gravitee", "local"]).toContain(result.source);
    expect(Array.isArray(result.instances)).toBe(true);
  });

  it("analytics.graviteeMetrics returns totalCalls as a number", async () => {
    const result = await caller.analytics.graviteeMetrics({});
    expect(result).toBeDefined();
    expect(["gravitee", "local"]).toContain(result.source);
    expect(typeof result.totalCalls).toBe("number");
  });

  it("analytics.availablePolicies returns policies with a source", async () => {
    const result = await caller.analytics.availablePolicies();
    expect(result).toBeDefined();
    expect(["gravitee", "local"]).toContain(result.source);
  });

  it("api.list returns apis with syncStatus field", async () => {
    const result = await caller.api.list({});
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("syncStatus");
    }
  });
});
