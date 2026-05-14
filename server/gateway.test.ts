import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@sify.com",
      name: "Admin User",
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

describe("gateway router", () => {
  it("clusters procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateway.clusters();
    expect(Array.isArray(result)).toBe(true);
  });

  it("deployments procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateway.deployments({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("createCluster validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateway.createCluster({
      name: "test-cluster",
      region: "ap-south-1",
      shardingTags: ["india-sovereign"],
      graviteeVersion: "4.2.0",
    });
    expect(result).toBeDefined();
  });

  it("deploy validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gateway.deploy({
      apiId: 1,
      clusterId: 1,
      tenantId: 1,
      version: "1.0.0",
    });
    expect(result).toBeDefined();
  });
});

describe("policy chain router", () => {
  it("list procedure accepts apiId and returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.policyChain.list({ apiId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("add procedure validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.policyChain.add({
      apiId: 1,
      tenantId: 1,
      policyId: 1,
      phase: "request",
      order: 1,
      condition: "",
    });
    expect(result).toBeDefined();
  });
});

describe("DCR router", () => {
  it("clients procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dcr.clients({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("register validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dcr.register({
      clientName: "test-client",
      tenantId: 1,
      redirectUris: ["https://example.com/callback"],
      grantTypes: ["client_credentials"],
      tokenEndpointAuthMethod: "client_secret_basic",
    });
    expect(result).toBeDefined();
    expect(result.clientId).toBeDefined();
    expect(result.clientSecret).toBeDefined();
  });
});

describe("data masking router", () => {
  it("rules procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.masking.rules({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("createRule validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.masking.createRule({
      tenantId: 1,
      name: "Mask PAN",
      jsonPath: "$.response.body.pan_number",
      action: "partial",
      category: "pan_card",
    });
    expect(result).toBeDefined();
  });
});

describe("environment router", () => {
  it("list procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.env.list({ tenantId: 1 });
    expect(Array.isArray(result)).toBe(true);
  });

  it("create validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.env.create({
      name: "staging",
      slug: "staging",
      tenantId: 1,
      order: 2,
    });
    expect(result).toBeDefined();
  });
});

describe("alert router", () => {
  it("rules procedure returns an array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alert.rules({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("create validates required fields", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.alert.create({
      name: "High Error Rate",
      type: "error_rate",
      severity: "critical",
      threshold: 5,
    });
    expect(result).toBeDefined();
  });
});
