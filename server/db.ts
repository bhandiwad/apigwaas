import { eq, and, desc, sql, gte, lte, gt, or, count, isNull } from "drizzle-orm";
import { encryptNullable, decryptNullable } from "./_core/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  users, tenants, workspaces, apis, plans, consumerApps, subscriptions,
  policies, auditEvents, invoices, usageRecords, supportTickets, incidents,
  complianceArtifacts, roles, roleAssignments, byokKeys, notifications,
  meteringEvents, metricExtractionRules, gatewayClusters, apiDeployments, developerPortals,
  maskingRules, dcrClients, identityProviders, apiEnvironments, alertRules,
  eventEntrypoints, policyChains, kafkaReporterConfigs,
  dpdpRequests, consentRecords, dataProcessingActivities,
  inviteTokens,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is not set");
    _db = drizzle(postgres(url, {
      max: parseInt(process.env.DB_POOL_MAX ?? "20"),
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 1800,
    }));
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function createUser(data: { email: string; name?: string | null; passwordHash?: string | null; role?: "user" | "admin" }) {
  const db = getDb();
  const result = await db.insert(users).values({
    email: data.email,
    name: data.name ?? null,
    passwordHash: data.passwordHash ?? null,
    role: data.role ?? "user",
    lastSignedIn: new Date(),
  }).returning({ id: users.id });
  return result[0]?.id ?? null;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateUserLastSignedIn(id: number) {
  const db = getDb();
  await db.update(users).set({ lastSignedIn: new Date(), updatedAt: new Date() }).where(eq(users.id, id));
}

export async function updateUser(id: number, data: Partial<typeof users.$inferInsert>) {
  const db = getDb();
  await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function setResetToken(email: string, token: string, expiresAt: Date) {
  const db = getDb();
  await db.update(users).set({ resetToken: token, resetTokenExpiresAt: expiresAt, updatedAt: new Date() }).where(eq(users.email, email));
}

export async function getUserByResetToken(token: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.resetToken, token)).limit(1);
  return result[0] ?? null;
}

export async function clearResetToken(id: number) {
  const db = getDb();
  await db.update(users).set({ resetToken: null, resetTokenExpiresAt: null, updatedAt: new Date() }).where(eq(users.id, id));
}

// ─── Tenants ─────────────────────────────────────────────────────────────────
export async function createTenant(data: typeof tenants.$inferInsert) {
  const db = getDb();
  const result = await db.insert(tenants).values(data).returning({ id: tenants.id });
  return result[0]?.id ?? null;
}

export async function deleteTenant(id: number) {
  const db = getDb();
  await db.delete(tenants).where(eq(tenants.id, id));
}

export async function getTenants(filters?: { status?: string; tier?: string }) {
  const db = getDb();
  return db.select().from(tenants).orderBy(desc(tenants.createdAt));
}

export async function getTenantById(id: number) {
  const db = getDb();
  const result = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getTenantBySlug(slug: string) {
  const db = getDb();
  const result = await db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1);
  return result[0] ?? null;
}

export async function updateTenant(id: number, data: Partial<typeof tenants.$inferInsert>) {
  const db = getDb();
  await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id));
}

// ─── Workspaces ──────────────────────────────────────────────────────────────
export async function createWorkspace(data: typeof workspaces.$inferInsert) {
  const db = getDb();
  const result = await db.insert(workspaces).values(data).returning({ id: workspaces.id });
  return result[0]?.id ?? null;
}

export async function getWorkspacesByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(workspaces).where(eq(workspaces.tenantId, tenantId)).orderBy(desc(workspaces.createdAt));
}

export async function updateWorkspace(id: number, data: Partial<typeof workspaces.$inferInsert>) {
  const db = getDb();
  await db.update(workspaces).set({ ...data, updatedAt: new Date() }).where(eq(workspaces.id, id));
}

// ─── APIs ────────────────────────────────────────────────────────────────────
export async function createApi(data: typeof apis.$inferInsert) {
  const db = getDb();
  const result = await db.insert(apis).values(data).returning({ id: apis.id });
  return result[0]?.id ?? null;
}

export async function getApisByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(apis).where(eq(apis.tenantId, tenantId)).orderBy(desc(apis.createdAt));
}

export async function getApisByWorkspace(workspaceId: number) {
  const db = getDb();
  return db.select().from(apis).where(eq(apis.workspaceId, workspaceId)).orderBy(desc(apis.createdAt));
}

export async function getPublishedApis() {
  const db = getDb();
  return db.select().from(apis).where(eq(apis.status, "published")).orderBy(apis.name);
}

export async function getPublishedApisByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(apis)
    .where(and(eq(apis.status, "published"), eq(apis.tenantId, tenantId)))
    .orderBy(apis.name);
}

export async function getApiById(id: number) {
  const db = getDb();
  const result = await db.select().from(apis).where(eq(apis.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateApi(id: number, data: Partial<typeof apis.$inferInsert>) {
  const db = getDb();
  await db.update(apis).set({ ...data, updatedAt: new Date() }).where(eq(apis.id, id));
}

// ─── Plans ───────────────────────────────────────────────────────────────────
export async function createPlan(data: typeof plans.$inferInsert) {
  const db = getDb();
  const result = await db.insert(plans).values(data).returning({ id: plans.id });
  return result[0]?.id ?? null;
}

export async function getAllActivePlans() {
  const db = getDb();
  return db.select().from(plans).where(eq(plans.status, "active")).orderBy(plans.apiId);
}

export async function getPlansByApi(apiId: number) {
  const db = getDb();
  return db.select().from(plans).where(eq(plans.apiId, apiId));
}

export async function updatePlan(id: number, data: Partial<typeof plans.$inferInsert>) {
  const db = getDb();
  await db.update(plans).set({ ...data, updatedAt: new Date() }).where(eq(plans.id, id));
}

// ─── Consumer Apps ───────────────────────────────────────────────────────────
export async function createConsumerApp(data: typeof consumerApps.$inferInsert) {
  const db = getDb();
  const result = await db.insert(consumerApps).values(data).returning({ id: consumerApps.id });
  return result[0]?.id ?? null;
}

export async function getConsumerAppsByTenant(tenantId: number, opts?: { page?: number; perPage?: number }) {
  const db = getDb();
  const perPage = opts?.perPage ?? 100;
  const offset = ((opts?.page ?? 1) - 1) * perPage;
  const [rows, totalResult] = await Promise.all([
    db.select().from(consumerApps).where(eq(consumerApps.tenantId, tenantId)).orderBy(desc(consumerApps.createdAt)).limit(perPage).offset(offset),
    db.select({ count: count() }).from(consumerApps).where(eq(consumerApps.tenantId, tenantId)),
  ]);
  return { data: rows, total: Number(totalResult[0]?.count ?? 0) };
}

export async function getConsumerAppById(id: number) {
  const db = getDb();
  const result = await db.select().from(consumerApps).where(eq(consumerApps.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateConsumerApp(id: number, data: Partial<typeof consumerApps.$inferInsert>) {
  const db = getDb();
  await db.update(consumerApps).set({ ...data, updatedAt: new Date() }).where(eq(consumerApps.id, id));
}

// ─── Subscriptions ───────────────────────────────────────────────────────────
export async function createSubscription(data: typeof subscriptions.$inferInsert) {
  const db = getDb();
  const encrypted = { ...data, apiKey: encryptNullable(data.apiKey as string | null) };
  const result = await db.insert(subscriptions).values(encrypted).returning({ id: subscriptions.id });
  return result[0]?.id ?? null;
}

function decryptSubscription<T extends { apiKey?: string | null }>(row: T): T {
  return { ...row, apiKey: decryptNullable(row.apiKey) };
}

export async function getSubscriptionsByTenant(tenantId: number, opts?: { page?: number; perPage?: number }) {
  const db = getDb();
  const perPage = opts?.perPage ?? 100;
  const offset = ((opts?.page ?? 1) - 1) * perPage;
  const [rows, totalResult] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).orderBy(desc(subscriptions.createdAt)).limit(perPage).offset(offset),
    db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId)),
  ]);
  return { data: rows.map(decryptSubscription), total: Number(totalResult[0]?.count ?? 0) };
}

export async function updateSubscription(id: number, data: Partial<typeof subscriptions.$inferInsert>) {
  const db = getDb();
  const encrypted = data.apiKey !== undefined ? { ...data, apiKey: encryptNullable(data.apiKey as string | null) } : data;
  await db.update(subscriptions).set({ ...encrypted, updatedAt: new Date() }).where(eq(subscriptions.id, id));
}

export async function getSubscriptionById(id: number) {
  const db = getDb();
  const result = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return result[0] ? decryptSubscription(result[0]) : null;
}

// ─── Policies ────────────────────────────────────────────────────────────────
export async function createPolicy(data: typeof policies.$inferInsert) {
  const db = getDb();
  const result = await db.insert(policies).values(data).returning({ id: policies.id });
  return result[0]?.id ?? null;
}

export async function getPoliciesByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(policies).where(eq(policies.tenantId, tenantId)).orderBy(desc(policies.createdAt));
}

export async function getPoliciesByApi(apiId: number) {
  const db = getDb();
  return db.select().from(policies).where(eq(policies.apiId, apiId)).orderBy(policies.priority);
}

export async function updatePolicy(id: number, data: Partial<typeof policies.$inferInsert>) {
  const db = getDb();
  await db.update(policies).set({ ...data, updatedAt: new Date() }).where(eq(policies.id, id));
}

// ─── Audit Events ────────────────────────────────────────────────────────────
export async function createAuditEvent(data: typeof auditEvents.$inferInsert) {
  const db = getDb();
  const result = await db.insert(auditEvents).values(data).returning({ id: auditEvents.id });
  return result[0]?.id ?? null;
}

export async function getAuditEvents(filters: {
  tenantId?: number; actorId?: number; actionType?: string; targetType?: string;
  startDate?: Date; endDate?: Date; limit?: number; offset?: number;
}) {
  const db = getDb();
  const conditions = [];
  if (filters.tenantId) conditions.push(eq(auditEvents.tenantId, filters.tenantId));
  if (filters.actorId) conditions.push(eq(auditEvents.actorId, filters.actorId));
  if (filters.startDate) conditions.push(gte(auditEvents.createdAt, filters.startDate));
  if (filters.endDate) conditions.push(lte(auditEvents.createdAt, filters.endDate));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const events = await db.select().from(auditEvents).where(where).orderBy(desc(auditEvents.createdAt)).limit(filters.limit ?? 50).offset(filters.offset ?? 0);
  const totalResult = await db.select({ count: count() }).from(auditEvents).where(where);
  return { events, total: Number(totalResult[0]?.count ?? 0) };
}

// ─── Invoices ────────────────────────────────────────────────────────────────
export async function createInvoice(data: typeof invoices.$inferInsert) {
  const db = getDb();
  const result = await db.insert(invoices).values(data).returning({ id: invoices.id });
  return result[0]?.id ?? null;
}

export async function getInvoicesByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(invoices).where(eq(invoices.tenantId, tenantId)).orderBy(desc(invoices.createdAt));
}

export async function updateInvoice(id: number, data: Partial<typeof invoices.$inferInsert>) {
  const db = getDb();
  await db.update(invoices).set({ ...data, updatedAt: new Date() }).where(eq(invoices.id, id));
}

// ─── Usage Records ───────────────────────────────────────────────────────────
export async function createUsageRecord(data: typeof usageRecords.$inferInsert) {
  const db = getDb();
  const result = await db.insert(usageRecords).values(data).returning({ id: usageRecords.id });
  return result[0]?.id ?? null;
}

export async function getUsageByTenant(tenantId: number | null, startDate?: Date, endDate?: Date) {
  const db = getDb();
  const conditions = [];
  if (tenantId !== null) conditions.push(eq(usageRecords.tenantId, tenantId));
  if (startDate) conditions.push(gte(usageRecords.date, startDate));
  if (endDate) conditions.push(lte(usageRecords.date, endDate));
  const base = db
    .select({
      id: usageRecords.id,
      tenantId: usageRecords.tenantId,
      apiId: usageRecords.apiId,
      apiName: apis.name,
      date: usageRecords.date,
      apiCalls: usageRecords.apiCalls,
      errorCount: usageRecords.errorCount,
      avgLatencyMs: usageRecords.avgLatencyMs,
      p99LatencyMs: usageRecords.p99LatencyMs,
      dataInBytes: usageRecords.dataInBytes,
      dataOutBytes: usageRecords.dataOutBytes,
    })
    .from(usageRecords)
    .leftJoin(apis, eq(usageRecords.apiId, apis.id));
  return conditions.length > 0
    ? base.where(and(...conditions)).orderBy(desc(usageRecords.date))
    : base.orderBy(desc(usageRecords.date));
}

// ─── Support Tickets ─────────────────────────────────────────────────────────
export async function createSupportTicket(data: typeof supportTickets.$inferInsert) {
  const db = getDb();
  const result = await db.insert(supportTickets).values(data).returning({ id: supportTickets.id });
  return result[0]?.id ?? null;
}

export async function getSupportTicketsByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(supportTickets).where(eq(supportTickets.tenantId, tenantId)).orderBy(desc(supportTickets.createdAt));
}

export async function updateSupportTicket(id: number, data: Partial<typeof supportTickets.$inferInsert>) {
  const db = getDb();
  await db.update(supportTickets).set({ ...data, updatedAt: new Date() }).where(eq(supportTickets.id, id));
}

// ─── Incidents ───────────────────────────────────────────────────────────────
export async function createIncident(data: typeof incidents.$inferInsert) {
  const db = getDb();
  const result = await db.insert(incidents).values(data).returning({ id: incidents.id });
  return result[0]?.id ?? null;
}

export async function getIncidents() {
  const db = getDb();
  return db.select().from(incidents).orderBy(desc(incidents.createdAt));
}

export async function updateIncident(id: number, data: Partial<typeof incidents.$inferInsert>) {
  const db = getDb();
  await db.update(incidents).set({ ...data, updatedAt: new Date() }).where(eq(incidents.id, id));
}

// ─── Compliance Artifacts ────────────────────────────────────────────────────
export async function getComplianceArtifacts(tenantId?: number) {
  const db = getDb();
  if (tenantId) {
    return db.select().from(complianceArtifacts).where(
      or(eq(complianceArtifacts.tenantId, tenantId), sql`${complianceArtifacts.tenantId} IS NULL`)
    ).orderBy(desc(complianceArtifacts.createdAt));
  }
  return db.select().from(complianceArtifacts).orderBy(desc(complianceArtifacts.createdAt));
}

export async function createComplianceArtifact(data: typeof complianceArtifacts.$inferInsert) {
  const db = getDb();
  const result = await db.insert(complianceArtifacts).values(data).returning({ id: complianceArtifacts.id });
  return result[0]?.id ?? null;
}

// ─── Roles ───────────────────────────────────────────────────────────────────
export async function createRole(data: typeof roles.$inferInsert) {
  const db = getDb();
  const result = await db.insert(roles).values(data).returning({ id: roles.id });
  return result[0]?.id ?? null;
}

export async function getRolesByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(roles).where(or(eq(roles.tenantId, tenantId), sql`${roles.tenantId} IS NULL`));
}

export async function assignRole(data: typeof roleAssignments.$inferInsert) {
  const db = getDb();
  const result = await db.insert(roleAssignments).values(data).returning({ id: roleAssignments.id });
  return result[0]?.id ?? null;
}

export async function getRoleAssignments(userId: number) {
  const db = getDb();
  return db.select().from(roleAssignments).where(eq(roleAssignments.userId, userId));
}

export async function getRoleAssignmentsByTenant(tenantId: number) {
  const db = getDb();
  return db.select({
    id: roleAssignments.id,
    userId: roleAssignments.userId,
    roleId: roleAssignments.roleId,
    tenantId: roleAssignments.tenantId,
    workspaceId: roleAssignments.workspaceId,
    createdAt: roleAssignments.createdAt,
    userEmail: users.email,
    userName: users.name,
    roleName: roles.name,
    roleScope: roles.scope,
  })
    .from(roleAssignments)
    .leftJoin(users, eq(roleAssignments.userId, users.id))
    .leftJoin(roles, eq(roleAssignments.roleId, roles.id))
    .where(eq(roleAssignments.tenantId, tenantId))
    .orderBy(desc(roleAssignments.createdAt));
}

export async function removeRoleAssignment(id: number) {
  const db = getDb();
  await db.delete(roleAssignments).where(eq(roleAssignments.id, id));
}

// ─── BYOK Keys ───────────────────────────────────────────────────────────────
export async function createByokKey(data: typeof byokKeys.$inferInsert) {
  const db = getDb();
  const result = await db.insert(byokKeys).values(data).returning({ id: byokKeys.id });
  return result[0]?.id ?? null;
}

export async function getByokKeysByTenant(tenantId: number) {
  const db = getDb();
  return db.select().from(byokKeys).where(eq(byokKeys.tenantId, tenantId));
}

export async function updateByokKey(id: number, data: Partial<typeof byokKeys.$inferInsert>) {
  const db = getDb();
  await db.update(byokKeys).set({ ...data, updatedAt: new Date() }).where(eq(byokKeys.id, id));
}

// ─── Notifications ───────────────────────────────────────────────────────────
export async function createNotification(data: typeof notifications.$inferInsert) {
  const db = getDb();
  const result = await db.insert(notifications).values(data).returning({ id: notifications.id });
  return result[0]?.id ?? null;
}

export async function getNotificationsByUser(userId: number, unreadOnly?: boolean) {
  const db = getDb();
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.read, false));
  return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: number) {
  const db = getDb();
  await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
}

// ─── Metering Events ─────────────────────────────────────────────────────────
export async function createMeteringEvent(data: typeof meteringEvents.$inferInsert) {
  const db = getDb();
  const result = await db.insert(meteringEvents).values(data).returning({ id: meteringEvents.id });
  return result[0]?.id ?? null;
}

export async function upsertTodayUsageRecord(tenantId: number, apiId: number, isError: boolean) {
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const existing = await db.select().from(usageRecords)
    .where(and(eq(usageRecords.tenantId, tenantId), eq(usageRecords.apiId, apiId), gte(usageRecords.date, today)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(usageRecords).set({
      apiCalls: sql`${usageRecords.apiCalls} + 1`,
      errorCount: isError ? sql`${usageRecords.errorCount} + 1` : usageRecords.errorCount,
    }).where(eq(usageRecords.id, existing[0].id));
  } else {
    await db.insert(usageRecords).values({
      tenantId,
      apiId,
      date: new Date(),
      apiCalls: 1,
      errorCount: isError ? 1 : 0,
      avgLatencyMs: 45,
      p99LatencyMs: 120,
      dataInBytes: 256,
      dataOutBytes: 1024,
    });
  }
}

export async function getMeteringStats(tenantId: number | null, pipeline?: string) {
  const db = getDb();
  const conditions: any[] = [];
  if (tenantId !== null) conditions.push(eq(meteringEvents.tenantId, tenantId));
  if (pipeline) conditions.push(eq(meteringEvents.pipeline, pipeline as "customer_facing" | "sify_internal"));
  const q = db.select().from(meteringEvents).orderBy(desc(meteringEvents.createdAt)).limit(1000);
  return conditions.length > 0 ? q.where(and(...conditions)) : q;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
export async function getDashboardStats(tenantId?: number) {
  const db = getDb();
  if (tenantId) {
    const [apiCount] = await db.select({ count: count() }).from(apis).where(eq(apis.tenantId, tenantId));
    const [appCount] = await db.select({ count: count() }).from(consumerApps).where(eq(consumerApps.tenantId, tenantId));
    const [subCount] = await db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    const [wsCount] = await db.select({ count: count() }).from(workspaces).where(eq(workspaces.tenantId, tenantId));
    return { totalApis: Number(apiCount?.count ?? 0), totalConsumerApps: Number(appCount?.count ?? 0), totalSubscriptions: Number(subCount?.count ?? 0), totalWorkspaces: Number(wsCount?.count ?? 0), totalTenants: 1 };
  }
  const [tenantCount] = await db.select({ count: count() }).from(tenants);
  const [apiCount] = await db.select({ count: count() }).from(apis);
  const [appCount] = await db.select({ count: count() }).from(consumerApps);
  const [subCount] = await db.select({ count: count() }).from(subscriptions);
  const [wsCount] = await db.select({ count: count() }).from(workspaces);
  return { totalApis: Number(apiCount?.count ?? 0), totalConsumerApps: Number(appCount?.count ?? 0), totalSubscriptions: Number(subCount?.count ?? 0), totalWorkspaces: Number(wsCount?.count ?? 0), totalTenants: Number(tenantCount?.count ?? 0) };
}

// ─── Gateway Clusters ───────────────────────────────────────────────────────
export async function getGatewayClusters() {
  const db = getDb();
  return db.select().from(gatewayClusters).orderBy(desc(gatewayClusters.createdAt));
}

export async function createGatewayCluster(data: typeof gatewayClusters.$inferInsert) {
  const db = getDb();
  const result = await db.insert(gatewayClusters).values(data).returning({ id: gatewayClusters.id });
  return result[0]?.id ?? null;
}

export async function updateGatewayCluster(id: number, data: Partial<typeof gatewayClusters.$inferInsert>) {
  const db = getDb();
  await db.update(gatewayClusters).set({ ...data, updatedAt: new Date() }).where(eq(gatewayClusters.id, id));
}

export async function deleteGatewayCluster(id: number) {
  const db = getDb();
  await db.delete(gatewayClusters).where(eq(gatewayClusters.id, id));
}

// ─── API Deployments ────────────────────────────────────────────────────────
export async function getApiDeployments(tenantId: number, apiId?: number, clusterId?: number) {
  const db = getDb();
  const conditions: ReturnType<typeof eq>[] = [eq(apiDeployments.tenantId, tenantId)];
  if (apiId) conditions.push(eq(apiDeployments.apiId, apiId));
  if (clusterId) conditions.push(eq(apiDeployments.clusterId, clusterId));
  return db.select().from(apiDeployments).where(and(...conditions)).orderBy(desc(apiDeployments.createdAt));
}

export async function createApiDeployment(data: typeof apiDeployments.$inferInsert) {
  const db = getDb();
  const result = await db.insert(apiDeployments).values(data).returning({ id: apiDeployments.id });
  return result[0]?.id ?? null;
}

export async function getApiDeploymentById(id: number) {
  const db = getDb();
  const result = await db.select().from(apiDeployments).where(eq(apiDeployments.id, id)).limit(1);
  return result[0] ?? null;
}

export async function updateApiDeployment(id: number, data: Partial<typeof apiDeployments.$inferInsert>) {
  const db = getDb();
  await db.update(apiDeployments).set({ ...data, updatedAt: new Date() }).where(eq(apiDeployments.id, id));
}

// ─── Developer Portals ──────────────────────────────────────────────────────
export async function getDeveloperPortals(tenantId?: number) {
  const db = getDb();
  if (tenantId) return db.select().from(developerPortals).where(eq(developerPortals.tenantId, tenantId));
  return db.select().from(developerPortals).orderBy(desc(developerPortals.createdAt));
}

export async function createDeveloperPortal(data: typeof developerPortals.$inferInsert) {
  const db = getDb();
  const result = await db.insert(developerPortals).values(data).returning({ id: developerPortals.id });
  return result[0]?.id ?? null;
}

export async function updateDeveloperPortal(id: number, data: Partial<typeof developerPortals.$inferInsert>) {
  const db = getDb();
  await db.update(developerPortals).set({ ...data, updatedAt: new Date() }).where(eq(developerPortals.id, id));
}

// ─── Masking Rules ──────────────────────────────────────────────────────────
export async function getMaskingRules(tenantId: number, apiId?: number) {
  const db = getDb();
  const conditions = [eq(maskingRules.tenantId, tenantId)];
  if (apiId) conditions.push(eq(maskingRules.apiId, apiId));
  return db.select().from(maskingRules).where(and(...conditions)).orderBy(maskingRules.priority);
}

export async function createMaskingRule(data: typeof maskingRules.$inferInsert) {
  const db = getDb();
  const result = await db.insert(maskingRules).values(data).returning({ id: maskingRules.id });
  return result[0]?.id ?? null;
}

export async function updateMaskingRule(id: number, data: Partial<typeof maskingRules.$inferInsert>) {
  const db = getDb();
  await db.update(maskingRules).set({ ...data, updatedAt: new Date() }).where(eq(maskingRules.id, id));
}

export async function deleteMaskingRule(id: number) {
  const db = getDb();
  await db.delete(maskingRules).where(eq(maskingRules.id, id));
}

// ─── Metric Extraction Rules ────────────────────────────────────────────────
export async function getMetricExtractionRules(tenantId: number) {
  const db = getDb();
  return db.select().from(metricExtractionRules).where(eq(metricExtractionRules.tenantId, tenantId)).orderBy(desc(metricExtractionRules.createdAt));
}

export async function createMetricExtractionRule(data: typeof metricExtractionRules.$inferInsert) {
  const db = getDb();
  const result = await db.insert(metricExtractionRules).values(data).returning({ id: metricExtractionRules.id });
  return result[0]?.id ?? null;
}

export async function updateMetricExtractionRule(id: number, data: Partial<typeof metricExtractionRules.$inferInsert>) {
  const db = getDb();
  await db.update(metricExtractionRules).set({ ...data, updatedAt: new Date() }).where(eq(metricExtractionRules.id, id));
}

export async function deleteMetricExtractionRule(id: number) {
  const db = getDb();
  await db.delete(metricExtractionRules).where(eq(metricExtractionRules.id, id));
}

// ─── DCR Clients ────────────────────────────────────────────────────────────
export async function getDcrClients(tenantId: number) {
  const db = getDb();
  return db.select().from(dcrClients).where(eq(dcrClients.tenantId, tenantId)).orderBy(desc(dcrClients.createdAt));
}

export async function createDcrClient(data: typeof dcrClients.$inferInsert) {
  const db = getDb();
  const result = await db.insert(dcrClients).values(data).returning({ id: dcrClients.id });
  return result[0]?.id ?? null;
}

export async function updateDcrClient(id: number, data: Partial<typeof dcrClients.$inferInsert>) {
  const db = getDb();
  await db.update(dcrClients).set({ ...data, updatedAt: new Date() }).where(eq(dcrClients.id, id));
}

// ─── Identity Providers ─────────────────────────────────────────────────────
export async function getIdentityProviders(tenantId: number) {
  const db = getDb();
  return db.select().from(identityProviders).where(eq(identityProviders.tenantId, tenantId)).orderBy(desc(identityProviders.createdAt));
}

export async function createIdentityProvider(data: typeof identityProviders.$inferInsert) {
  const db = getDb();
  const result = await db.insert(identityProviders).values(data).returning({ id: identityProviders.id });
  return result[0]?.id ?? null;
}

export async function updateIdentityProvider(id: number, data: Partial<typeof identityProviders.$inferInsert>) {
  const db = getDb();
  await db.update(identityProviders).set({ ...data, updatedAt: new Date() }).where(eq(identityProviders.id, id));
}

// ─── API Environments ───────────────────────────────────────────────────────
export async function getApiEnvironments(tenantId: number) {
  const db = getDb();
  return db.select().from(apiEnvironments).where(eq(apiEnvironments.tenantId, tenantId)).orderBy(apiEnvironments.order);
}

export async function createApiEnvironment(data: typeof apiEnvironments.$inferInsert) {
  const db = getDb();
  const result = await db.insert(apiEnvironments).values(data).returning({ id: apiEnvironments.id });
  return result[0]?.id ?? null;
}

export async function updateApiEnvironment(id: number, data: Partial<typeof apiEnvironments.$inferInsert>) {
  const db = getDb();
  await db.update(apiEnvironments).set({ ...data, updatedAt: new Date() }).where(eq(apiEnvironments.id, id));
}

// ─── Alert Rules ────────────────────────────────────────────────────────────
export async function getAlertRules(tenantId?: number) {
  const db = getDb();
  if (tenantId) return db.select().from(alertRules).where(eq(alertRules.tenantId, tenantId));
  return db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
}

export async function createAlertRule(data: typeof alertRules.$inferInsert) {
  const db = getDb();
  const result = await db.insert(alertRules).values(data).returning({ id: alertRules.id });
  return result[0]?.id ?? null;
}

export async function updateAlertRule(id: number, data: Partial<typeof alertRules.$inferInsert>) {
  const db = getDb();
  await db.update(alertRules).set({ ...data, updatedAt: new Date() }).where(eq(alertRules.id, id));
}

// ─── Event Entrypoints ──────────────────────────────────────────────────────
export async function getEventEntrypoints(apiId?: number, tenantId?: number) {
  const db = getDb();
  const conditions: ReturnType<typeof eq>[] = [];
  if (apiId) conditions.push(eq(eventEntrypoints.apiId, apiId));
  if (tenantId) conditions.push(eq(eventEntrypoints.tenantId, tenantId));
  if (conditions.length > 0) {
    return db.select().from(eventEntrypoints).where(and(...conditions));
  }
  return db.select().from(eventEntrypoints).orderBy(desc(eventEntrypoints.createdAt));
}

export async function createEventEntrypoint(data: typeof eventEntrypoints.$inferInsert) {
  const db = getDb();
  const result = await db.insert(eventEntrypoints).values(data).returning({ id: eventEntrypoints.id });
  return result[0]?.id ?? null;
}

export async function updateEventEntrypoint(id: number, data: Partial<typeof eventEntrypoints.$inferInsert>) {
  const db = getDb();
  await db.update(eventEntrypoints).set({ ...data, updatedAt: new Date() }).where(eq(eventEntrypoints.id, id));
}

// ─── Policy Chains ──────────────────────────────────────────────────────────
export async function getPolicyChains(apiId: number) {
  const db = getDb();
  return db.select({
    id: policyChains.id,
    apiId: policyChains.apiId,
    tenantId: policyChains.tenantId,
    phase: policyChains.phase,
    policyId: policyChains.policyId,
    order: policyChains.order,
    condition: policyChains.condition,
    enabled: policyChains.enabled,
    configuration: policyChains.configuration,
    createdAt: policyChains.createdAt,
    updatedAt: policyChains.updatedAt,
    policyName: policies.name,
    policyType: policies.type,
    policyPhase: policies.phase,
  }).from(policyChains)
    .leftJoin(policies, eq(policyChains.policyId, policies.id))
    .where(eq(policyChains.apiId, apiId))
    .orderBy(policyChains.phase, policyChains.order);
}

export async function createPolicyChain(data: typeof policyChains.$inferInsert) {
  const db = getDb();
  const result = await db.insert(policyChains).values(data).returning({ id: policyChains.id });
  return result[0]?.id ?? null;
}

export async function updatePolicyChain(id: number, data: Partial<typeof policyChains.$inferInsert>) {
  const db = getDb();
  await db.update(policyChains).set({ ...data, updatedAt: new Date() }).where(eq(policyChains.id, id));
}

export async function deletePolicyChain(id: number) {
  const db = getDb();
  await db.delete(policyChains).where(eq(policyChains.id, id));
}

// ─── Kafka Reporter Config ────────────────────────────────────────────────────
export async function getKafkaReporterConfig(tenantId: number) {
  const db = getDb();
  const result = await db.select().from(kafkaReporterConfigs).where(eq(kafkaReporterConfigs.tenantId, tenantId)).limit(1);
  return result[0] ?? null;
}

export async function upsertKafkaReporterConfig(tenantId: number, data: { brokers?: string; enabled?: boolean; reporters?: any[]; topicMappings?: any[] }) {
  const db = getDb();
  await db.insert(kafkaReporterConfigs)
    .values({ tenantId, brokers: data.brokers ?? "localhost:9092", enabled: data.enabled ?? false, reporters: data.reporters ?? [], topicMappings: data.topicMappings ?? [] })
    .onConflictDoUpdate({ target: kafkaReporterConfigs.tenantId, set: { ...data, updatedAt: new Date() } });
}

// ─── Delete / Revoke Helpers ─────────────────────────────────────────────────

export async function deleteApi(id: number) {
  const db = getDb();
  await db.update(apis).set({ status: "retired", updatedAt: new Date() }).where(eq(apis.id, id));
}

export async function deletePlan(id: number) {
  const db = getDb();
  await db.update(plans).set({ status: "closed", updatedAt: new Date() }).where(eq(plans.id, id));
}

export async function revokeConsumerApp(id: number) {
  const db = getDb();
  await db.update(consumerApps).set({ status: "revoked", updatedAt: new Date() }).where(eq(consumerApps.id, id));
}

export async function revokeSubscription(id: number) {
  const db = getDb();
  await db.update(subscriptions).set({ status: "revoked", updatedAt: new Date() }).where(eq(subscriptions.id, id));
}

export async function archiveWorkspace(id: number) {
  const db = getDb();
  await db.update(workspaces).set({ status: "archived", updatedAt: new Date() }).where(eq(workspaces.id, id));
}

export async function deletePolicy(id: number) {
  const db = getDb();
  await db.delete(policies).where(eq(policies.id, id));
}

export async function deleteRole(id: number) {
  const db = getDb();
  await db.delete(roles).where(and(eq(roles.id, id), eq(roles.isSystem, false)));
}

export async function deleteAlertRule(id: number) {
  const db = getDb();
  await db.delete(alertRules).where(eq(alertRules.id, id));
}

export async function deleteEventEntrypoint(id: number) {
  const db = getDb();
  await db.delete(eventEntrypoints).where(eq(eventEntrypoints.id, id));
}

export async function deleteIdentityProvider(id: number) {
  const db = getDb();
  await db.delete(identityProviders).where(eq(identityProviders.id, id));
}

export async function deleteApiEnvironment(id: number) {
  const db = getDb();
  await db.delete(apiEnvironments).where(eq(apiEnvironments.id, id));
}

// ─── DPDP Compliance ──────────────────────────────────────────────────────────

const DPDP_SLA_DAYS = 30;

export async function createDpdpRequest(data: { tenantId: number; userId?: number; action: string; subject: string; notes?: string }) {
  const db = getDb();
  const dueDate = new Date(Date.now() + DPDP_SLA_DAYS * 24 * 60 * 60 * 1000);
  const result = await db.insert(dpdpRequests).values({ ...data, status: "pending", dueDate } as any).returning({ id: dpdpRequests.id });
  return result[0]?.id ?? null;
}

export async function getDpdpRequests(tenantId: number) {
  const db = getDb();
  const now = new Date();
  const rows = await db.select().from(dpdpRequests).where(eq(dpdpRequests.tenantId, tenantId)).orderBy(desc(dpdpRequests.createdAt));
  // Auto-flag overdue
  return rows.map(r => ({
    ...r,
    isOverdue: r.status === "pending" || r.status === "in_progress" ? r.dueDate < now : false,
    daysRemaining: Math.ceil((r.dueDate.getTime() - now.getTime()) / 86400000),
  }));
}

export async function updateDpdpRequest(id: number, data: { status?: string; response?: string; assignedTo?: string; completedAt?: Date }) {
  const db = getDb();
  await db.update(dpdpRequests).set({ ...data, updatedAt: new Date() } as any).where(eq(dpdpRequests.id, id));
}

export async function createConsentRecord(data: typeof consentRecords.$inferInsert) {
  const db = getDb();
  const result = await db.insert(consentRecords).values(data).returning({ id: consentRecords.id });
  return result[0]?.id ?? null;
}

export async function getConsentRecords(tenantId: number, dataPrincipalId?: string) {
  const db = getDb();
  const conditions = [eq(consentRecords.tenantId, tenantId)];
  if (dataPrincipalId) conditions.push(eq(consentRecords.dataPrincipalId, dataPrincipalId));
  return db.select().from(consentRecords).where(and(...conditions)).orderBy(desc(consentRecords.grantedAt));
}

export async function revokeConsentRecord(id: number) {
  const db = getDb();
  await db.update(consentRecords).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(eq(consentRecords.id, id));
}

export async function getDataProcessingActivities(tenantId: number) {
  const db = getDb();
  return db.select().from(dataProcessingActivities).where(eq(dataProcessingActivities.tenantId, tenantId)).orderBy(desc(dataProcessingActivities.createdAt));
}

export async function createDataProcessingActivity(data: typeof dataProcessingActivities.$inferInsert) {
  const db = getDb();
  const result = await db.insert(dataProcessingActivities).values(data).returning({ id: dataProcessingActivities.id });
  return result[0]?.id ?? null;
}

export async function updateDataProcessingActivity(id: number, data: Partial<typeof dataProcessingActivities.$inferInsert>) {
  const db = getDb();
  await db.update(dataProcessingActivities).set({ ...data, updatedAt: new Date() }).where(eq(dataProcessingActivities.id, id));
}

// ─── Metering Aggregation ─────────────────────────────────────────────────────
export async function aggregateMeteringForBilling(tenantId: number, start: Date, end: Date) {
  const db = getDb();
  const rows = await db.select({
    apiId: meteringEvents.apiId,
    planId: meteringEvents.planId,
    subscriptionId: meteringEvents.subscriptionId,
    totalCalls: count(),
    totalRequestBytes: sql<number>`sum(${meteringEvents.requestBytes})`,
    totalResponseBytes: sql<number>`sum(${meteringEvents.responseBytes})`,
    avgLatencyMs: sql<number>`avg(${meteringEvents.latencyMs})`,
    errorCount: sql<number>`sum(case when ${meteringEvents.statusCode} >= 400 then 1 else 0 end)`,
  })
    .from(meteringEvents)
    .where(and(eq(meteringEvents.tenantId, tenantId), gte(meteringEvents.createdAt, start), lte(meteringEvents.createdAt, end)))
    .groupBy(meteringEvents.apiId, meteringEvents.planId, meteringEvents.subscriptionId);
  return rows;
}

// Returns true if the user has access to the workspace (tenant owner or role assignment)
export async function userHasWorkspaceAccess(userId: number, workspaceId: number, tenantId: number): Promise<boolean> {
  const db = getDb();
  // 1. Check user owns the tenant (has tenantId set) — tenant owners access all workspaces
  const user = await db.select({ tenantId: users.tenantId, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user[0]) return false;
  if (user[0].role === "admin") return true;
  if (user[0].tenantId === tenantId) {
    // Verify workspace belongs to this tenant
    const ws = await db.select({ id: workspaces.id }).from(workspaces).where(and(eq(workspaces.id, workspaceId), eq(workspaces.tenantId, tenantId))).limit(1);
    return ws.length > 0;
  }
  // 2. Check explicit role assignment for this workspace
  const assignment = await db.select({ id: roleAssignments.id }).from(roleAssignments)
    .where(and(eq(roleAssignments.userId, userId), eq(roleAssignments.workspaceId, workspaceId))).limit(1);
  return assignment.length > 0;
}

// ─── Quota ────────────────────────────────────────────────────────────────────

export async function checkQuota(
  tenantId: number,
  resource: "workspaces" | "apis" | "consumerApps",
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const db = getDb();
  const tenant = await db.select({
    maxWorkspaces: tenants.maxWorkspaces,
    maxApis: tenants.maxApis,
    maxConsumerApps: tenants.maxConsumerApps,
  }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

  if (!tenant[0]) return { allowed: false, current: 0, limit: 0 };

  let current = 0;
  let limit = 0;

  if (resource === "workspaces") {
    limit = tenant[0].maxWorkspaces ?? 1;
    const [row] = await db.select({ n: count() }).from(workspaces)
      .where(and(eq(workspaces.tenantId, tenantId), eq(workspaces.status, "active")));
    current = Number(row?.n ?? 0);
  } else if (resource === "apis") {
    limit = tenant[0].maxApis ?? 5;
    const [row] = await db.select({ n: count() }).from(apis)
      .where(and(eq(apis.tenantId, tenantId)));
    current = Number(row?.n ?? 0);
  } else if (resource === "consumerApps") {
    limit = tenant[0].maxConsumerApps ?? 50;
    const [row] = await db.select({ n: count() }).from(consumerApps)
      .where(and(eq(consumerApps.tenantId, tenantId), eq(consumerApps.status, "active")));
    current = Number(row?.n ?? 0);
  }

  return { allowed: current < limit, current, limit };
}

// ─── Tenant Members ───────────────────────────────────────────────────────────

export async function getTenantMembers(tenantId: number) {
  const db = getDb();
  return db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    tenantRole: users.tenantRole,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).where(eq(users.tenantId, tenantId)).orderBy(users.createdAt);
}

export async function updateUserTenantRole(
  userId: number,
  tenantId: number,
  tenantRole: "owner" | "admin" | "developer" | "viewer",
) {
  const db = getDb();
  await db.update(users)
    .set({ tenantRole, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
}

export async function removeUserFromTenant(userId: number, tenantId: number) {
  const db = getDb();
  await db.update(users)
    .set({ tenantId: null, tenantRole: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.tenantId, tenantId)));
}

export async function updateTenantSettings(
  tenantId: number,
  settings: {
    allowSelfRegistration?: boolean;
    selfRegDefaultRole?: string;
    allowedEmailDomains?: string[];
  },
) {
  const db = getDb();
  await db.update(tenants)
    .set({ ...settings, updatedAt: new Date() })
    .where(eq(tenants.id, tenantId));
}

// ─── Invite Tokens ────────────────────────────────────────────────────────────

export async function createInviteToken(data: {
  tenantId: number;
  email: string;
  tenantRole: "owner" | "admin" | "developer" | "viewer";
  token: string;
  expiresAt: Date;
  invitedByUserId: number;
}) {
  const db = getDb();
  const [row] = await db.insert(inviteTokens).values(data).returning({ id: inviteTokens.id });
  return row.id;
}

export async function getInviteByToken(token: string) {
  const db = getDb();
  const [row] = await db.select().from(inviteTokens).where(eq(inviteTokens.token, token)).limit(1);
  return row ?? null;
}

export async function getPendingInvites(tenantId: number) {
  const db = getDb();
  const now = new Date();
  return db.select({
    id: inviteTokens.id,
    email: inviteTokens.email,
    tenantRole: inviteTokens.tenantRole,
    expiresAt: inviteTokens.expiresAt,
    createdAt: inviteTokens.createdAt,
    invitedByUserId: inviteTokens.invitedByUserId,
  }).from(inviteTokens)
    .where(and(
      eq(inviteTokens.tenantId, tenantId),
      isNull(inviteTokens.usedAt),
      gt(inviteTokens.expiresAt, now),
    ))
    .orderBy(desc(inviteTokens.createdAt));
}

export async function revokeInvite(id: number, tenantId: number) {
  const db = getDb();
  await db.delete(inviteTokens)
    .where(and(eq(inviteTokens.id, id), eq(inviteTokens.tenantId, tenantId)));
}

export async function markInviteUsed(token: string, userId: number) {
  const db = getDb();
  await db.update(inviteTokens)
    .set({ usedAt: new Date(), usedByUserId: userId })
    .where(eq(inviteTokens.token, token));
}
