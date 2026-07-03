/**
 * Alert evaluation engine.
 *
 * Every 60s, evaluates enabled alert rules against real gateway metering
 * (metering_events) and fires in-app notifications when a rule's threshold is
 * breached. Each rule has a cooldown so a sustained breach doesn't spam users.
 *
 * Implemented rule types (backed by real data): error_rate, latency_p99,
 * quota_usage. cert_expiry / subscription_expiry / custom have no runtime data
 * source yet and are skipped rather than faked.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq, gte } from "drizzle-orm";
import { alertRules, meteringEvents, notifications, users } from "../drizzle/schema";
import { logger } from "./_core/logger";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL not set");
    _db = drizzle(postgres(url, { max: 2 }));
  }
  return _db;
}

const POLL_INTERVAL_MS = 60_000;
const WINDOW_MS = 15 * 60_000;   // evaluate over the last 15 min of traffic
const COOLDOWN_MS = 30 * 60_000; // don't re-fire the same rule within 30 min
const MIN_SAMPLE = 10;           // need at least N requests before rate/latency alerts

let timer: ReturnType<typeof setInterval> | null = null;

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

async function evaluateOnce() {
  const db = getDb();
  const rules = await db.select().from(alertRules).where(eq(alertRules.enabled, true));
  if (rules.length === 0) return;

  const now = Date.now();
  const windowStart = new Date(now - WINDOW_MS);

  for (const rule of rules) {
    try {
      if (rule.tenantId == null) continue;
      // Cooldown: skip rules that fired recently.
      if (rule.lastTriggeredAt && now - new Date(rule.lastTriggeredAt).getTime() < COOLDOWN_MS) continue;
      const threshold = rule.threshold != null ? Number(rule.threshold) : null;
      if (threshold == null) continue;

      const events = await db
        .select({ statusCode: meteringEvents.statusCode, latencyMs: meteringEvents.latencyMs })
        .from(meteringEvents)
        .where(and(eq(meteringEvents.tenantId, rule.tenantId), gte(meteringEvents.createdAt, windowStart)));

      let breached = false;
      let detail = "";

      if (rule.type === "error_rate") {
        if (events.length < MIN_SAMPLE) continue;
        const errors = events.filter(e => (e.statusCode ?? 0) >= 400).length;
        const rate = (errors / events.length) * 100;
        if (rate > threshold) { breached = true; detail = `error rate ${rate.toFixed(1)}% > ${threshold}% (${errors}/${events.length} reqs in 15m)`; }
      } else if (rule.type === "latency_p99") {
        if (events.length < MIN_SAMPLE) continue;
        const sorted = events.map(e => e.latencyMs ?? 0).sort((a, b) => a - b);
        const p99 = percentile(sorted, 99);
        if (p99 > threshold) { breached = true; detail = `p99 latency ${p99}ms > ${threshold}ms (${events.length} reqs in 15m)`; }
      } else if (rule.type === "quota_usage") {
        // threshold = request budget for the window
        if (events.length > threshold) { breached = true; detail = `${events.length} requests in 15m exceeds budget of ${threshold}`; }
      } else {
        // cert_expiry / subscription_expiry / custom — no runtime data source yet.
        continue;
      }

      if (!breached) continue;

      await db.update(alertRules).set({ lastTriggeredAt: new Date(), updatedAt: new Date() }).where(eq(alertRules.id, rule.id));

      const tenantUsers = await db.select({ id: users.id }).from(users).where(eq(users.tenantId, rule.tenantId));
      const notifType = rule.type === "quota_usage" ? "usage_threshold" : "incident";
      for (const u of tenantUsers) {
        await db.insert(notifications).values({
          tenantId: rule.tenantId,
          userId: u.id,
          type: notifType,
          title: `Alert: ${rule.name}`,
          message: `${String(rule.severity).toUpperCase()} — ${detail}`,
          actionUrl: "/alerts",
        });
      }
      logger.info({ rule: rule.name, tenantId: rule.tenantId, detail }, "[AlertEvaluator] alert fired");
    } catch (err: any) {
      logger.warn({ err: err?.message, ruleId: rule.id }, "[AlertEvaluator] rule eval error");
    }
  }
}

export function startAlertEvaluator() {
  if (timer) return;
  evaluateOnce().catch(() => {});
  timer = setInterval(() => evaluateOnce().catch(() => {}), POLL_INTERVAL_MS);
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "[AlertEvaluator] started");
}

export function stopAlertEvaluator() {
  if (timer) { clearInterval(timer); timer = null; }
}
