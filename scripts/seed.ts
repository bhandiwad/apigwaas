/**
 * Production seed: 3 tenants × multiple workspaces × 10 APIs
 * Run: DATABASE_URL=... npx tsx scripts/seed.ts
 *
 * Idempotent — skips existing tenants/APIs by slug/name match.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

const TENANTS = [
  {
    name: "HDFC Bank API Platform",
    tier: "enterprise" as const,
    slug: "hdfc-bank-api-platform",
    contactEmail: "api-platform@hdfc.example.com",
    region: "mumbai",
    gstin: "27AAACH0997C1ZP",
    limits: { maxWorkspaces: 10, maxApis: 200, maxConsumerApps: 10000, includedCallsPerMonth: 100000000, dataTransferLimitGb: 1000 },
    workspaces: ["Retail Banking", "Corporate Banking", "Payments"],
  },
  {
    name: "Zepto Logistics API",
    tier: "business" as const,
    slug: "zepto-logistics-api",
    contactEmail: "platform@zepto.example.com",
    region: "bengaluru",
    limits: { maxWorkspaces: 3, maxApis: 25, maxConsumerApps: 500, includedCallsPerMonth: 10000000, dataTransferLimitGb: 100 },
    workspaces: ["Order Management", "Inventory"],
  },
  {
    name: "MoovingOn SaaS Platform",
    tier: "starter" as const,
    slug: "moovingon-saas-platform",
    contactEmail: "tech@moovingon.example.com",
    region: "hyderabad",
    limits: { maxWorkspaces: 1, maxApis: 5, maxConsumerApps: 50, includedCallsPerMonth: 1000000, dataTransferLimitGb: 10 },
    workspaces: ["Core"],
  },
];

const APIS_PER_WORKSPACE: Record<string, Omit<typeof schema.apis.$inferInsert, "tenantId" | "workspaceId" | "id" | "createdAt" | "updatedAt">[]> = {
  "Retail Banking": [
    { name: "Account Balance API", version: "v2", protocol: "rest", backendUrl: "https://core.hdfc.internal/accounts/v2", status: "published", contextPath: "/retail/accounts/v2", description: "Real-time account balance and statement" },
    { name: "UPI Payments API", version: "v3", protocol: "rest", backendUrl: "https://payments.hdfc.internal/upi/v3", status: "published", contextPath: "/retail/upi/v3", description: "UPI push/pull payment initiation and status" },
    { name: "Loan Eligibility API", version: "v1", protocol: "rest", backendUrl: "https://credit.hdfc.internal/eligibility/v1", status: "published", contextPath: "/retail/loans/v1", description: "CIBIL-integrated pre-approved loan check" },
  ],
  "Corporate Banking": [
    { name: "Bulk Payment API", version: "v2", protocol: "rest", backendUrl: "https://corp.hdfc.internal/bulk/v2", status: "published", contextPath: "/corp/bulk/v2", description: "NEFT/RTGS/IMPS bulk disbursement for corporates" },
    { name: "Trade Finance API", version: "v1", protocol: "rest", backendUrl: "https://trade.hdfc.internal/lc/v1", status: "draft" as const, contextPath: "/corp/trade/v1", description: "Letter of credit and bank guarantee management" },
  ],
  "Payments": [
    { name: "FX Rate API", version: "v1", protocol: "rest", backendUrl: "https://fx.hdfc.internal/rates/v1", status: "published", contextPath: "/payments/fx/v1", description: "Live forex rates — 40+ currencies" },
  ],
  "Order Management": [
    { name: "Order Status API", version: "v2", protocol: "rest", backendUrl: "https://api.zepto.internal/orders/v2", status: "published", contextPath: "/orders/v2", description: "Real-time order lifecycle tracking" },
    { name: "Slot Availability API", version: "v1", protocol: "rest", backendUrl: "https://api.zepto.internal/slots/v1", status: "published", contextPath: "/slots/v1", description: "10-minute delivery slot availability" },
  ],
  "Inventory": [
    { name: "SKU Search API", version: "v1", protocol: "rest", backendUrl: "https://inventory.zepto.internal/search/v1", status: "published", contextPath: "/inventory/search/v1", description: "Product catalog full-text search" },
  ],
  "Core": [
    { name: "Tenant Onboarding API", version: "v1", protocol: "rest", backendUrl: "https://core.moovingon.internal/onboard/v1", status: "published", contextPath: "/onboard/v1", description: "SaaS tenant provisioning and setup" },
  ],
};

async function upsertTenant(data: (typeof TENANTS)[0]) {
  const existing = await db.select().from(schema.tenants).where(eq(schema.tenants.slug, data.slug)).limit(1);
  if (existing.length > 0) {
    console.log(`  Tenant exists: ${data.name} (id=${existing[0].id})`);
    return existing[0].id;
  }
  const [row] = await db.insert(schema.tenants).values({
    name: data.name, slug: data.slug, tier: data.tier, status: "active",
    contactEmail: data.contactEmail, region: data.region, gstin: data.gstin,
    ...data.limits,
  }).returning({ id: schema.tenants.id });
  console.log(`  Created tenant: ${data.name} (id=${row.id})`);
  return row.id;
}

async function upsertWorkspace(tenantId: number, name: string) {
  const existing = await db.select().from(schema.workspaces)
    .where(and(eq(schema.workspaces.tenantId, tenantId), eq(schema.workspaces.name, name))).limit(1);
  if (existing.length > 0) return existing[0].id;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + nanoid(4);
  const [row] = await db.insert(schema.workspaces).values({ tenantId, name, slug, status: "active" }).returning({ id: schema.workspaces.id });
  console.log(`    Workspace: ${name} (id=${row.id})`);
  return row.id;
}

async function upsertApi(tenantId: number, workspaceId: number, data: Omit<typeof schema.apis.$inferInsert, "tenantId" | "workspaceId" | "id" | "createdAt" | "updatedAt">) {
  const existing = await db.select().from(schema.apis)
    .where(and(eq(schema.apis.tenantId, tenantId), eq(schema.apis.name, data.name!))).limit(1);
  if (existing.length > 0) {
    console.log(`      API exists: ${data.name}`);
    return existing[0].id;
  }
  const [row] = await db.insert(schema.apis).values({ ...data, tenantId, workspaceId }).returning({ id: schema.apis.id });
  console.log(`      API: ${data.name} (id=${row.id})`);

  // Create default FREE plan
  await db.insert(schema.plans).values({
    apiId: row.id, tenantId, name: "Free", status: "active",
    rateLimit: 100, rateLimitPeriod: "minute",
    quotaLimit: 10000, quotaPeriod: "month",
    autoApprove: true,
  });

  return row.id;
}

async function seedAdminUser() {
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, "admin@cloudinfinit.io")).limit(1);
  if (existing.length > 0) {
    console.log(`  Admin user exists (id=${existing[0].id})`);
    return existing[0].id;
  }
  const passwordHash = await bcrypt.hash("CloudInfinit@2026!", 12);
  const [row] = await db.insert(schema.users).values({
    email: "admin@cloudinfinit.io", name: "Platform Admin",
    role: "admin", passwordHash,
  }).returning({ id: schema.users.id });
  console.log(`  Admin created: admin@cloudinfinit.io / CloudInfinit@2026! (id=${row.id})`);
  return row.id;
}

async function seedMeteringEvents(tenantId: number, apiIds: number[]) {
  const count = await db.select({ c: schema.meteringEvents.id })
    .from(schema.meteringEvents).where(eq(schema.meteringEvents.tenantId, tenantId)).limit(1);
  if (count.length > 0) {
    console.log(`    Metering events exist, skipping`);
    return;
  }

  const statuses = [200, 200, 200, 200, 201, 400, 404, 500];
  const methods = ["GET", "GET", "GET", "POST", "PUT"];
  const events = [];

  for (let day = 29; day >= 0; day--) {
    const date = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
    for (const apiId of apiIds) {
      const callsToday = Math.floor(100 + Math.random() * 900);
      for (let i = 0; i < callsToday; i++) {
        events.push({
          tenantId,
          apiId,
          method: methods[Math.floor(Math.random() * methods.length)],
          statusCode: statuses[Math.floor(Math.random() * statuses.length)],
          requestBytes: Math.floor(200 + Math.random() * 2000),
          responseBytes: Math.floor(500 + Math.random() * 8000),
          latencyMs: Math.floor(5 + Math.random() * 195),
          pipeline: "customer_facing" as const,
          createdAt: new Date(date.getTime() + Math.random() * 86400000),
        });
      }
    }
  }

  // Insert in batches of 500
  for (let i = 0; i < events.length; i += 500) {
    await db.insert(schema.meteringEvents).values(events.slice(i, i + 500) as any[]);
  }
  console.log(`    Seeded ${events.length} metering events over 30 days`);
}

async function main() {
  console.log("CloudInfinit API Gateway — Seed Script");
  console.log("=======================================\n");

  console.log("Users:");
  await seedAdminUser();

  for (const tenantDef of TENANTS) {
    console.log(`\nTenant: ${tenantDef.name}`);
    const tenantId = await upsertTenant(tenantDef);
    const allApiIds: number[] = [];

    for (const wsName of tenantDef.workspaces) {
      const workspaceId = await upsertWorkspace(tenantId, wsName);
      const wsApis = APIS_PER_WORKSPACE[wsName] ?? [];
      for (const apiDef of wsApis) {
        const apiId = await upsertApi(tenantId, workspaceId, apiDef);
        allApiIds.push(apiId);
      }
    }

    await seedMeteringEvents(tenantId, allApiIds);
  }

  console.log("\n✓ Seed complete");
  await sql.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
