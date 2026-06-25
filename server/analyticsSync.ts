/**
 * Real-time analytics sync: Elasticsearch → usage_records
 *
 * Gravitee v4 gateway writes every request as a document to the
 * `gravitee-v4-metrics-YYYY.MM.DD` ES index. The management API's v1
 * analytics endpoint queries a legacy `gravitee-request-*` pattern and
 * returns nothing for v4. We bypass it and query ES directly.
 *
 * Every 30 s we pull the delta since the last sync, aggregate per API,
 * and upsert into `usage_records` so the Analytics page always has live data.
 */

import axios from "axios";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { usageRecords, apis } from "../drizzle/schema";
import { isNotNull } from "drizzle-orm";
import { ENV } from "./_core/env";
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

const POLL_INTERVAL_MS = 30_000;
const ES_INDEX = "gravitee-v4-metrics-*";

let timer: ReturnType<typeof setInterval> | null = null;
// Start from process startup so we don't miss the first window.
let lastSyncedAt = new Date(Date.now() - POLL_INTERVAL_MS);

// ─── Gravitee API-id → {localApiId, tenantId} lookup ────────────────────────

type ApiLookup = Map<string, { id: number; tenantId: number }>;

async function buildApiLookup(): Promise<ApiLookup> {
  const db = getDb();
  const rows = await db
    .select({ id: apis.id, tenantId: apis.tenantId, graviteeApiId: apis.graviteeApiId })
    .from(apis)
    .where(isNotNull(apis.graviteeApiId));

  const map: ApiLookup = new Map();
  for (const row of rows) {
    if (row.graviteeApiId) map.set(row.graviteeApiId, { id: row.id, tenantId: row.tenantId });
  }
  return map;
}

// ─── Elasticsearch query ─────────────────────────────────────────────────────

interface ApiBucket {
  key: string;            // gravitee api-id
  doc_count: number;
  avg_latency: { value: number | null };
  error_count: { doc_count: number };
}

async function queryEsAggregation(from: Date, to: Date): Promise<ApiBucket[]> {
  const body = {
    size: 0,
    query: {
      range: {
        "@timestamp": {
          gte: from.toISOString(),
          lte: to.toISOString(),
        },
      },
    },
    aggs: {
      by_api: {
        terms: { field: "api-id", size: 500 },
        aggs: {
          avg_latency: { avg: { field: "gateway-response-time-ms" } },
          error_count: {
            filter: { range: { status: { gte: 400 } } },
          },
        },
      },
    },
  };

  const url = `${ENV.elasticsearchUrl}/${ES_INDEX}/_search`;
  const resp = await axios.post<{ aggregations: { by_api: { buckets: ApiBucket[] } } }>(url, body, {
    headers: { "Content-Type": "application/json" },
    timeout: 10_000,
  });
  return resp.data?.aggregations?.by_api?.buckets ?? [];
}

// ─── Write to usage_records ──────────────────────────────────────────────────

async function persistBuckets(buckets: ApiBucket[], lookup: ApiLookup, windowEnd: Date) {
  if (buckets.length === 0) return;

  const db = getDb();

  for (const bucket of buckets) {
    const local = lookup.get(bucket.key);
    if (!local) continue; // Unknown API — not registered in our system

    const calls = bucket.doc_count;
    const avgLatency = Math.round(bucket.avg_latency.value ?? 0);
    const errorCount = bucket.error_count.doc_count;

    await db.insert(usageRecords).values({
      tenantId: local.tenantId,
      apiId: local.id,
      date: windowEnd,
      apiCalls: calls,
      errorCount,
      avgLatencyMs: avgLatency,
    });
  }
}

// ─── Sync cycle ──────────────────────────────────────────────────────────────

async function syncOnce() {
  const from = lastSyncedAt;
  const to = new Date();

  try {
    const [buckets, lookup] = await Promise.all([
      queryEsAggregation(from, to),
      buildApiLookup(),
    ]);

    if (buckets.length > 0) {
      await persistBuckets(buckets, lookup, to);
      logger.info({ from, to, apis: buckets.length }, "[AnalyticsSync] synced");
    }

    lastSyncedAt = to;
  } catch (err: any) {
    // ES unreachable or no index yet — non-fatal, keep the window for next cycle.
    if (err?.code === "ECONNREFUSED" || err?.response?.status === 404) {
      logger.debug("[AnalyticsSync] Elasticsearch not reachable or index absent — will retry");
    } else {
      logger.warn({ err: err?.message }, "[AnalyticsSync] sync error");
    }
  }
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export function startAnalyticsSync() {
  if (timer) return; // Already running
  // Run immediately, then every 30 s
  syncOnce();
  timer = setInterval(syncOnce, POLL_INTERVAL_MS);
  logger.info({ intervalMs: POLL_INTERVAL_MS }, "[AnalyticsSync] started");
}

export function stopAnalyticsSync() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info("[AnalyticsSync] stopped");
  }
}
