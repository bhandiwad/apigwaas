import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register, prefix: "ci_" });

export const httpRequestsTotal = new Counter({
  name: "ci_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [register],
});

export const httpRequestDurationMs = new Histogram({
  name: "ci_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route"] as const,
  buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
});

export const graviteeErrors = new Counter({
  name: "ci_gravitee_errors_total",
  help: "Gravitee API sync errors",
  labelNames: ["operation"] as const,
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: "ci_db_query_errors_total",
  help: "Database query errors",
  registers: [register],
});
