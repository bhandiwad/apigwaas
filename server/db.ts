import { eq, and, desc, sql, gte, lte, like, or, count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tenants, workspaces, apis, plans, consumerApps, subscriptions, policies, auditEvents, invoices, usageRecords, supportTickets, incidents, complianceArtifacts, roles, roleAssignments, byokKeys, notifications, meteringEvents } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Tenants ─────────────────────────────────────────────────────────────────
export async function createTenant(data: typeof tenants.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tenants).values(data);
  return result[0].insertId;
}

export async function getTenants(filters?: { status?: string; tier?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(tenants).orderBy(desc(tenants.createdAt));
  return query;
}

export async function getTenantById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] || null;
}

export async function updateTenant(id: number, data: Partial<typeof tenants.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(tenants).set(data).where(eq(tenants.id, id));
}

// ─── Workspaces ──────────────────────────────────────────────────────────────
export async function createWorkspace(data: typeof workspaces.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(workspaces).values(data);
  return result[0].insertId;
}

export async function getWorkspacesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workspaces).where(eq(workspaces.tenantId, tenantId)).orderBy(desc(workspaces.createdAt));
}

export async function updateWorkspace(id: number, data: Partial<typeof workspaces.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(workspaces).set(data).where(eq(workspaces.id, id));
}

// ─── APIs ────────────────────────────────────────────────────────────────────
export async function createApi(data: typeof apis.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(apis).values(data);
  return result[0].insertId;
}

export async function getApisByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apis).where(eq(apis.tenantId, tenantId)).orderBy(desc(apis.createdAt));
}

export async function getApisByWorkspace(workspaceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(apis).where(eq(apis.workspaceId, workspaceId)).orderBy(desc(apis.createdAt));
}

export async function getApiById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(apis).where(eq(apis.id, id)).limit(1);
  return result[0] || null;
}

export async function updateApi(id: number, data: Partial<typeof apis.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(apis).set(data).where(eq(apis.id, id));
}

// ─── Plans ───────────────────────────────────────────────────────────────────
export async function createPlan(data: typeof plans.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(plans).values(data);
  return result[0].insertId;
}

export async function getPlansByApi(apiId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(plans).where(eq(plans.apiId, apiId));
}

export async function updatePlan(id: number, data: Partial<typeof plans.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(plans).set(data).where(eq(plans.id, id));
}

// ─── Consumer Apps ───────────────────────────────────────────────────────────
export async function createConsumerApp(data: typeof consumerApps.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(consumerApps).values(data);
  return result[0].insertId;
}

export async function getConsumerAppsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(consumerApps).where(eq(consumerApps.tenantId, tenantId)).orderBy(desc(consumerApps.createdAt));
}

// ─── Subscriptions ───────────────────────────────────────────────────────────
export async function createSubscription(data: typeof subscriptions.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(subscriptions).values(data);
  return result[0].insertId;
}

export async function getSubscriptionsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).orderBy(desc(subscriptions.createdAt));
}

export async function updateSubscription(id: number, data: Partial<typeof subscriptions.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
}

// ─── Policies ────────────────────────────────────────────────────────────────
export async function createPolicy(data: typeof policies.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(policies).values(data);
  return result[0].insertId;
}

export async function getPoliciesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(policies).where(eq(policies.tenantId, tenantId)).orderBy(desc(policies.createdAt));
}

export async function getPoliciesByApi(apiId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(policies).where(eq(policies.apiId, apiId)).orderBy(policies.priority);
}

export async function updatePolicy(id: number, data: Partial<typeof policies.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(policies).set(data).where(eq(policies.id, id));
}

// ─── Audit Events ────────────────────────────────────────────────────────────
export async function createAuditEvent(data: typeof auditEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(auditEvents).values(data);
  return result[0].insertId;
}

export async function getAuditEvents(filters: { tenantId?: number; actorId?: number; actionType?: string; targetType?: string; startDate?: Date; endDate?: Date; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) return { events: [], total: 0 };
  const conditions = [];
  if (filters.tenantId) conditions.push(eq(auditEvents.tenantId, filters.tenantId));
  if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
  if (filters.startDate) conditions.push(gte(auditEvents.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(auditEvents.createdAt, filters.endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const events = await db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.createdAt)).limit(filters.limit || 50).offset(filters.offset || 0);
  const totalResult = await db.select({ count: count() }).from(auditEvents).where(where);
  return { events, total: totalResult[0]?.count || 0 };
}

// ─── Invoices ────────────────────────────────────────────────────────────────
export async function createInvoice(data: typeof invoices.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(invoices).values(data);
  return result[0].insertId;
}

export async function getInvoicesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt));
}

export async function updateInvoice(id: number, data: Partial<typeof invoices.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(invoices).set(data).where(eq(invoices.id, id));
}

// ─── Usage Records ───────────────────────────────────────────────────────────
export async function createUsageRecord(data: typeof usageRecords.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(usageRecords).values(data);
  return result[0].insertId;
}

export async function getUsageByTenant(tenantId: number, startDate?: Date, endDate?: Date) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(usageRecords.tenantId, tenantId)];
  if (startDate) conditions.push(gte(usageRecords.date, startDate));
  if (endDate) conditions.push(lte(usageRecords.date, endDate));
  return db.select().from(usageRecords).where(and(...conditions)).orderBy(desc(usageRecords.date));
}

// ─── Support Tickets ─────────────────────────────────────────────────────────
export async function createSupportTicket(data: typeof supportTickets.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(supportTickets).values(data);
  return result[0].insertId;
}

export async function getSupportTicketsByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supportTickets).where(eq(supportTickets.tenantId, tenantId)).orderBy(desc(supportTickets.createdAt));
}

export async function updateSupportTicket(id: number, data: Partial<typeof supportTickets.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(supportTickets).set(data).where(eq(supportTickets.id, id));
}

// ─── Incidents ───────────────────────────────────────────────────────────────
export async function createIncident(data: typeof incidents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(incidents).values(data);
  return result[0].insertId;
}

export async function getIncidents() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(incidents).orderBy(desc(incidents.createdAt));
}

export async function updateIncident(id: number, data: Partial<typeof incidents.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(incidents).set(data).where(eq(incidents.id, id));
}

// ─── Compliance Artifacts ────────────────────────────────────────────────────
export async function getComplianceArtifacts(tenantId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (tenantId) {
    return db.select().from(complianceArtifacts).where(or(eq(complianceArtifacts.tenantId, tenantId), sql`${complianceArtifacts.tenantId} IS NULL`)).orderBy(desc(complianceArtifacts.createdAt));
  }
  return db.select().from(complianceArtifacts).orderBy(desc(complianceArtifacts.createdAt));
}

export async function createComplianceArtifact(data: typeof complianceArtifacts.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(complianceArtifacts).values(data);
  return result[0].insertId;
}

// ─── Roles ───────────────────────────────────────────────────────────────────
export async function createRole(data: typeof roles.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(roles).values(data);
  return result[0].insertId;
}

export async function getRolesByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roles).where(or(eq(roles.tenantId, tenantId), sql`${roles.tenantId} IS NULL`));
}

export async function assignRole(data: typeof roleAssignments.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(roleAssignments).values(data);
  return result[0].insertId;
}

export async function getRoleAssignments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId));
}

// ─── BYOK Keys ───────────────────────────────────────────────────────────────
export async function createByokKey(data: typeof byokKeys.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(byokKeys).values(data);
  return result[0].insertId;
}

export async function getByokKeysByTenant(tenantId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(byokKeys).where(eq(byokKeys.tenantId, tenantId));
}

export async function updateByokKey(id: number, data: Partial<typeof byokKeys.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(byokKeys).set(data).where(eq(byokKeys.id, id));
}

// ─── Notifications ───────────────────────────────────────────────────────────
export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(notifications).values(data);
  return result[0].insertId;
}

export async function getNotificationsByUser(userId: number, unreadOnly?: boolean) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.read, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

// ─── Metering Events ─────────────────────────────────────────────────────────
export async function createMeteringEvent(data: typeof meteringEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(meteringEvents).values(data);
  return result[0].insertId;
}

export async function getMeteringStats(tenantId: number, pipeline?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(meteringEvents.tenantId, tenantId)];
  if (pipeline) conditions.push(eq(meteringEvents.pipeline, pipeline as any));
  return db.select().from(meteringEvents).where(and(...conditions)).orderBy(desc(meteringEvents.createdAt)).limit(1000);
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export async function getDashboardStats(tenantId?: number) {
  const db = await getDb();
  if (!db) return { totalApis: 0, totalConsumerApps: 0, totalSubscriptions: 0, totalWorkspaces: 0, totalTenants: 0 };
  
  if (tenantId) {
    const [apiCount] = await db.select({ count: count() }).from(apis).where(eq(apis.tenantId, tenantId));
    const [appCount] = await db.select({ count: count() }).from(consumerApps).where(eq(consumerApps.tenantId, tenantId));
    const [subCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    const [wsCount] = await db.select({ count: count() }).from(workspaces).where(eq(workspaces.tenantId, tenantId));
    return { totalApis: apiCount?.count || 0, totalConsumerApps: appCount?.count || 0, totalSubscriptions: subCount?.count || 0, totalWorkspaces: wsCount?.count || 0, totalTenants: 1 };
  }
  
  const [tenantCount] = await db.select({ count: count() }).from(tenants);
  const [apiCount] = await db.select({ count: count() }).from(apis);
  const [appCount] = await db.select({ count: count() }).from(consumerApps);
  const [subCount] = await db.select({ count: count() }).from(subscriptions);
  const [wsCount] = await db.select({ count: count() }).from(workspaces);
  return { totalApis: apiCount?.count || 0, totalConsumerApps: appCount?.count || 0, totalSubscriptions: subCount?.count || 0, totalWorkspaces: wsCount?.count || 0, totalTenants: tenantCount?.count || 0 };
}
