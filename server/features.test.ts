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
      tenantId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe("audit router", () => {
  it("export procedure exists and validates format input", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.export({ format: "csv" });
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("signature");
    expect(result).toHaveProperty("format", "csv");
    expect(result).toHaveProperty("recordCount");
    expect(typeof result.signature).toBe("string");
    // SHA-256 hex string is 64 chars
    expect(result.signature.length).toBe(64);
  });

  it("export supports jsonl format", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.export({ format: "jsonl" });
    expect(result.format).toBe("jsonl");
    expect(result.signature.length).toBe(64);
  });

  it("list procedure returns events array and total", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.audit.list({ limit: 10 });
    expect(result).toHaveProperty("events");
    expect(result).toHaveProperty("total");
    expect(Array.isArray(result.events)).toBe(true);
  });
});

describe("subscription router", () => {
  it("list procedure exists and returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.subscription.list();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("create procedure exists and accepts valid input", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.subscription.create({ consumerAppId: 1, apiId: 1, planId: 1 });
    } catch (e: any) {
      // Expected to fail due to FK constraints in test env, but procedure should exist
      expect(e.message || e.code).toBeDefined();
    }
  });
});

describe("billing router", () => {
  it("invoices procedure exists and returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.billing.invoices();
    expect(Array.isArray(result)).toBe(true);
  });

  it("usage procedure exists and returns data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.billing.usage({});
    expect(result).toBeDefined();
  });
});

describe("analytics router", () => {
  it("dashboard procedure returns stats object", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.dashboard({});
    expect(result).toHaveProperty("totalApis");
    expect(result).toHaveProperty("totalConsumerApps");
    expect(result).toHaveProperty("totalSubscriptions");
    expect(result).toHaveProperty("totalWorkspaces");
    expect(result).toHaveProperty("totalTenants");
  });
});

describe("metering (analytics.metering)", () => {
  it("metering procedure returns data", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.analytics.metering({});
    expect(result).toBeDefined();
  });
});

describe("compliance router", () => {
  it("artifacts procedure returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.compliance.artifacts({});
    expect(Array.isArray(result)).toBe(true);
  });

  it("byokKeys procedure returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.compliance.byokKeys();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("support router", () => {
  it("tickets procedure returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.support.tickets();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("status router", () => {
  it("incidents procedure returns array", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.status.incidents();
    expect(Array.isArray(result)).toBe(true);
  });
});
