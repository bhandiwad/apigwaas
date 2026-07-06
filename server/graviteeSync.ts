/**
 * Gravitee Sync Service
 * 
 * Provides a hybrid approach: when Gravitee is configured and reachable,
 * operations are forwarded to the live Gravitee Management API. When not
 * configured or unreachable, falls back to local database operations.
 * 
 * This ensures the platform works in both connected (production) and
 * disconnected (development/demo) modes.
 */

import * as gravitee from "./gravitee";
import * as db from "./db";
import { logger } from "./_core/logger";
import { graviteeErrors } from "./_core/metrics";

// ─── Connection State ────────────────────────────────────────────────────────

let _lastHealthCheck: { timestamp: number; result: gravitee.GraviteeHealthStatus } | null = null;
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

export async function getConnectionStatus(): Promise<gravitee.GraviteeHealthStatus & { mode: "live" | "local" }> {
  if (!gravitee.isGraviteeConfigured()) {
    return { connected: false, mode: "local", error: "Gravitee not configured - using local database" };
  }

  const now = Date.now();
  if (_lastHealthCheck && (now - _lastHealthCheck.timestamp) < HEALTH_CHECK_INTERVAL) {
    return { ..._lastHealthCheck.result, mode: _lastHealthCheck.result.connected ? "live" : "local" };
  }

  const result = await gravitee.checkGraviteeHealth();
  _lastHealthCheck = { timestamp: now, result };
  return { ...result, mode: result.connected ? "live" : "local" };
}

// ─── API Sync ────────────────────────────────────────────────────────────────

export async function listApisHybrid(tenantId: number, workspaceId?: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const graviteeApis = await gravitee.listApis({ perPage: 100 });
      // Merge with local metadata (tenant/workspace associations)
      const localApis = workspaceId 
        ? await db.getApisByWorkspace(workspaceId) 
        : await db.getApisByTenant(tenantId);
      
      // Enrich local APIs with live Gravitee state
      return localApis.map(localApi => {
        const graviteeApi = graviteeApis.data.find(g => 
          g.id === (localApi as any).graviteeApiId || g.name === localApi.name
        );
        if (graviteeApi) {
          return {
            ...localApi,
            graviteeState: graviteeApi.state,
            graviteeLifecycle: graviteeApi.lifecycleState,
            deployedAt: graviteeApi.deployedAt,
            isDeployedToGateway: graviteeApi.state === "STARTED",
            syncStatus: "synced" as const,
          };
        }
        return { ...localApi, syncStatus: "local_only" as const };
      });
    } catch (error) {
      graviteeErrors.inc({ operation: "list_apis" }); logger.warn({ err: error }, "[GraviteeSync] Failed to fetch APIs from Gravitee, falling back to local:");
      const apis = workspaceId ? await db.getApisByWorkspace(workspaceId) : await db.getApisByTenant(tenantId);
      return apis.map(a => ({ ...a, syncStatus: "disconnected" as const }));
    }
  }

  const apis = workspaceId ? await db.getApisByWorkspace(workspaceId) : await db.getApisByTenant(tenantId);
  return apis.map(a => ({ ...a, syncStatus: "local_only" as const }));
}

export async function createApiHybrid(input: {
  workspaceId: number;
  tenantId: number;
  name: string;
  version: string;
  protocol: "rest" | "graphql" | "grpc" | "websocket" | "kafka" | "mqtt";
  backendUrl?: string;
  contextPath?: string;
  description?: string;
  openApiSpec?: any;
  tags?: string[];
}) {
  // Always create locally first
  const localId = await db.createApi(input);
  
  const status = await getConnectionStatus();
  if (status.mode === "live") {
    try {
      // Create in Gravitee
      const graviteeDefinition = buildGraviteeApiDefinition(input);
      const graviteeApi = await gravitee.createApi(graviteeDefinition);
      
      // Store the Gravitee API ID in local DB for future reference
      await db.updateApi(localId!, { graviteeApiId: graviteeApi.id } as any);
      
      return { id: localId, graviteeApiId: graviteeApi.id, synced: true };
    } catch (error) {
      graviteeErrors.inc({ operation: "create_api" }); logger.warn({ err: error }, "[GraviteeSync] Failed to create API in Gravitee:");
      return { id: localId, synced: false, error: "Created locally but failed to sync to Gravitee" };
    }
  }

  return { id: localId, synced: false };
}

type LogEntry = { ts: string; action: string; result: "ok" | "warn" | "error"; detail: string };

function logEntry(action: string, result: LogEntry["result"], detail: string): LogEntry {
  return { ts: new Date().toISOString(), action, result, detail };
}

export async function deployApiHybrid(input: {
  apiId: number;
  clusterId: number;
  tenantId: number;
  version: string;
  strategy: "rolling" | "blue_green" | "canary";
  configuration?: any;
}) {
  const opLog: LogEntry[] = [];

  const status = await getConnectionStatus();
  opLog.push(logEntry("gravitee_health", status.mode === "live" ? "ok" : "error",
    status.mode === "live" ? `Connected to Gravitee at ${status.mode}` : "Gravitee unreachable — check GRAVITEE_API_URL and credentials"));

  // Look up the cluster
  const clusters = await db.getGatewayClusters();
  const cluster = clusters.find((c: any) => c.id === input.clusterId);
  const graviteeEnvId = (cluster as any)?.graviteeEnvId || undefined;
  opLog.push(logEntry("resolve_cluster", cluster ? "ok" : "error",
    cluster ? `Cluster "${(cluster as any).name}" → env:${graviteeEnvId || "DEFAULT"} @ ${(cluster as any).managementUrl || "env-var URL"}` : `Cluster ID ${input.clusterId} not found`));

  // Create deployment record immediately so the user can see it
  const deploymentId = await db.createApiDeployment({
    ...input,
    status: "deploying",
    syncStatus: "syncing",
    operationLog: opLog as any,
  });

  if (status.mode !== "live") {
    const errMsg = "Gravitee is not reachable. Verify GRAVITEE_API_URL, GRAVITEE_API_USER, GRAVITEE_API_PASSWORD in server/.env";
    opLog.push(logEntry("deploy", "error", errMsg));
    await db.updateApiDeployment(deploymentId!, { status: "failed", syncStatus: "error", errorMessage: errMsg, operationLog: opLog as any });
    throw new Error(errMsg);
  }

  try {
    // Resolve the local API — auto-publish to Gravitee if not yet synced
    let localApi = await db.getApiById(input.apiId);
    let graviteeApiId = (localApi as any)?.graviteeApiId as string | undefined;

    if (!graviteeApiId) {
      opLog.push(logEntry("resolve_gravitee_id", "warn", `API "${(localApi as any)?.name}" not yet in Gravitee — auto-publishing now`));
      await db.updateApiDeployment(deploymentId!, { operationLog: opLog as any });
      try {
        const published = await publishApiHybrid(input.apiId);
        graviteeApiId = published.graviteeApiId;
        opLog.push(logEntry("auto_publish", "ok", `Created in Gravitee with ID: ${graviteeApiId}`));
      } catch (pubErr: any) {
        const detail = pubErr?.response?.data?.message || pubErr?.message || String(pubErr);
        const errMsg = `Auto-publish to Gravitee failed: ${detail}`;
        opLog.push(logEntry("auto_publish", "error", errMsg));
        await db.updateApiDeployment(deploymentId!, { status: "failed", syncStatus: "error", errorMessage: errMsg, operationLog: opLog as any });
        throw new Error(errMsg);
      }
      // Re-fetch to get updated graviteeApiId
      localApi = await db.getApiById(input.apiId);
    } else {
      opLog.push(logEntry("resolve_gravitee_id", "ok", `Gravitee API ID: ${graviteeApiId}`));
    }
    await db.updateApiDeployment(deploymentId!, { operationLog: opLog as any });

    // Push new deployment revision to Gravitee
    try {
      await gravitee.deployApi(graviteeApiId, `v${input.version}`, graviteeEnvId);
      opLog.push(logEntry("gravitee_deploy", "ok", `Deployment revision pushed to Gravitee env:${graviteeEnvId || "DEFAULT"}`));
    } catch (err: any) {
      const detail = err?.response?.data?.message || err?.message || String(err);
      opLog.push(logEntry("gravitee_deploy", "error", `Deploy call failed: ${detail}`));
      graviteeErrors.inc({ operation: "deploy_api" });
      logger.error({ err, graviteeApiId, envId: graviteeEnvId }, "[GraviteeSync] deployApi failed");
      await db.updateApiDeployment(deploymentId!, { status: "failed", syncStatus: "error", errorMessage: detail, operationLog: opLog as any });
      throw err;
    }

    // Start the API (idempotent — "already started" is not an error)
    try {
      await gravitee.startApi(graviteeApiId, graviteeEnvId);
      opLog.push(logEntry("gravitee_start", "ok", "API started on gateway"));
    } catch (err: any) {
      const msg: string = err?.response?.data?.message || err?.message || String(err);
      if (msg.toLowerCase().includes("already started")) {
        opLog.push(logEntry("gravitee_start", "warn", "API was already started — no action needed"));
      } else {
        const detail = msg;
        opLog.push(logEntry("gravitee_start", "error", `Start call failed: ${detail}`));
        graviteeErrors.inc({ operation: "start_api" });
        logger.error({ err, graviteeApiId, envId: graviteeEnvId }, "[GraviteeSync] startApi failed");
        await db.updateApiDeployment(deploymentId!, { status: "failed", syncStatus: "error", errorMessage: detail, operationLog: opLog as any });
        throw err;
      }
    }
    await db.updateApiDeployment(deploymentId!, { operationLog: opLog as any });

    // Poll until STARTED (max 10 × 2s = 20s)
    let confirmed = false;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const state = await gravitee.getApiDeploymentState(graviteeApiId, graviteeEnvId);
      if (state.isDeployed) { confirmed = true; break; }
    }

    opLog.push(logEntry("confirm_started", confirmed ? "ok" : "warn",
      confirmed ? "Gravitee reports API state=STARTED" : "Timeout waiting for STARTED state — API may still be propagating"));

    await db.updateApiDeployment(deploymentId!, {
      status: confirmed ? "deployed" : "failed",
      syncStatus: confirmed ? "synced" : "error",
      deployedAt: confirmed ? new Date() : undefined,
      lastSyncAt: new Date(),
      errorMessage: confirmed ? null : "Timed out waiting for gateway to confirm STARTED state",
      operationLog: opLog as any,
    });

    logger.info({ deploymentId, apiId: input.apiId, graviteeApiId, confirmed }, "[GraviteeSync] deploy complete");
    return { id: deploymentId, synced: confirmed, graviteeState: confirmed ? "STARTED" : "UNKNOWN" };

  } catch (error: any) {
    // Catch-all for unexpected errors not handled in the steps above
    const errMsg = error?.response?.data?.message || error?.message || String(error);
    if (!opLog.some(e => e.result === "error")) {
      opLog.push(logEntry("deploy", "error", errMsg));
    }
    logger.error({ err: error, deploymentId, apiId: input.apiId }, "[GraviteeSync] unexpected deploy error");
    await db.updateApiDeployment(deploymentId!, { status: "failed", syncStatus: "error", errorMessage: errMsg, operationLog: opLog as any }).catch(() => {});
    throw error;
  }
}

export async function undeployApiHybrid(deploymentId: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      // Get deployment info to find the Gravitee API ID
      const deployment = await db.getApiDeploymentById(deploymentId);
      if (deployment) {
        const localApi = await db.getApiById(deployment.apiId);
        const graviteeApiId = (localApi as any)?.graviteeApiId;
        if (graviteeApiId) {
          await gravitee.stopApi(graviteeApiId);
        }
      }
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to undeploy from Gravitee:");
    }
  }

  await db.updateApiDeployment(deploymentId, { status: "undeployed", syncStatus: "out_of_sync" });
  return { success: true };
}

export async function startApiHybrid(apiId: number) {
  const status = await getConnectionStatus();
  if (status.mode === "live") {
    const localApi = await db.getApiById(apiId);
    const graviteeApiId = (localApi as any)?.graviteeApiId;
    if (graviteeApiId) {
      await gravitee.startApi(graviteeApiId);
      return { started: true, synced: true };
    }
  }
  return { started: true, synced: false };
}

export async function stopApiHybrid(apiId: number) {
  const status = await getConnectionStatus();
  if (status.mode === "live") {
    const localApi = await db.getApiById(apiId);
    const graviteeApiId = (localApi as any)?.graviteeApiId;
    if (graviteeApiId) {
      await gravitee.stopApi(graviteeApiId);
      return { stopped: true, synced: true };
    }
  }
  return { stopped: true, synced: false };
}

export async function deleteApiHybrid(apiId: number) {
  const status = await getConnectionStatus();
  if (status.mode === "live") {
    const localApi = await db.getApiById(apiId);
    const graviteeApiId = (localApi as any)?.graviteeApiId;
    if (graviteeApiId) {
      // Gravitee requires an API to be stopped, and its plans closed, before deletion.
      try { await gravitee.stopApi(graviteeApiId); } catch { /* already stopped */ }
      try {
        const plans = await gravitee.listPlans(graviteeApiId, { status: "PUBLISHED" });
        for (const plan of plans.data) {
          try { await gravitee.closePlan(graviteeApiId, plan.id); } catch { /* already closed */ }
        }
      } catch { /* no plans / listing failed — attempt delete anyway */ }
      try {
        await gravitee.deleteApi(graviteeApiId);
      } catch (err: any) {
        if (err?.response?.status !== 404) throw err; // 404 = already gone, treat as success
      }
      return { deleted: true, synced: true };
    }
  }
  return { deleted: true, synced: false };
}

// ─── API Flow (Policy Chain) Sync ────────────────────────────────────────────
export async function saveApiFlowsHybrid(apiId: number, flows: { phase: "request" | "response"; type: string; config: Record<string, any> }[]) {
  const localApi = await db.getApiById(apiId);
  if (!localApi) throw new Error(`API ${apiId} not found`);

  // Persist the design flows to local openApiSpec, then recompose the full flow
  // set (design + masking + IP filtering) and push it as one — the composer is
  // the single writer, so saving Design no longer wipes masking/IP flows.
  const existing = (localApi as any).openApiSpec ?? {};
  await db.updateApi(apiId, { openApiSpec: { ...existing, policyFlows: flows } } as any);

  try {
    const { synced } = await syncApiFlowsToGateway(apiId);
    return { saved: true, synced };
  } catch (error) {
    graviteeErrors.inc({ operation: "save_api_flows" });
    logger.warn({ err: error }, "[GraviteeSync] Failed to sync API flows to Gravitee");
    return { saved: true, synced: false };
  }
}

// ─── Gateway Policy Enforcement (data masking) ───────────────────────────────

const MASKING_FLOW_NAME = "cloudinfinit-data-masking";

// Generates a Groovy script that redacts the configured JSON paths in the
// response body. Runs as a Gravitee `groovy` response-content policy.
function buildMaskingGroovyScript(
  rules: Array<{ jsonPath: string; action: string; replacement: string | null; showLastN: number | null }>
): string {
  const ruleLiterals = rules.map(r => {
    const path = r.jsonPath.replace(/^\$\.?/, ""); // "$.user.pan" -> "user.pan"
    return `['path': ${JSON.stringify(path)}, 'action': ${JSON.stringify(r.action)}, 'replacement': ${JSON.stringify(r.replacement || "***REDACTED***")}, 'showLastN': ${Number(r.showLastN) || 0}]`;
  }).join(",\n  ");
  return `import groovy.json.JsonSlurper
import groovy.json.JsonOutput
import java.security.MessageDigest
def rules = [
  ${ruleLiterals}
]
def maskValue(value, rule) {
  if (value == null) return value
  def s = value.toString()
  switch (rule.action) {
    case 'hash_sha256':
      return MessageDigest.getInstance('SHA-256').digest(s.getBytes('UTF-8')).encodeHex().toString()
    case 'partial':
      int n = (rule.showLastN ?: 0) as int
      if (n <= 0 || n >= s.length()) return rule.replacement
      return ('*' * (s.length() - n)) + s.substring(s.length() - n)
    default:
      return rule.replacement
  }
}
try {
  def obj = new JsonSlurper().parseText(response.content)
  rules.each { rule ->
    def parts = rule.path.split('\\\\.')
    def cur = obj
    for (int i = 0; i < parts.size() - 1; i++) {
      if (cur instanceof Map && cur.containsKey(parts[i])) { cur = cur[parts[i]] } else { cur = null; break }
    }
    if (cur instanceof Map && cur.containsKey(parts[-1])) {
      cur[parts[-1]] = maskValue(cur[parts[-1]], rule)
    }
  }
  return JsonOutput.toJson(obj)
} catch (e) {
  // Non-JSON or unparseable body — pass through unchanged.
  return response.content
}`;
}

function buildMaskingFlow(rules: any[]) {
  return {
    name: MASKING_FLOW_NAME,
    enabled: true,
    selectors: [{ type: "HTTP", path: "/", pathOperator: "STARTS_WITH", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] }],
    request: [],
    response: [{
      name: "Mask sensitive fields",
      policy: "groovy",
      enabled: true,
      configuration: {
        readContent: true,
        overrideContent: true,
        onResponseContentScript: buildMaskingGroovyScript(rules),
      },
    }],
  };
}

// Compiles the API's response-phase masking rules into a Groovy policy on the
// Gravitee API flow and redeploys, so masking is actually enforced at the gateway.
export async function deployApiMaskingToGateway(apiId: number) {
  const status = await getConnectionStatus();
  if (status.mode !== "live") throw new Error("Gravitee is not reachable — cannot deploy masking to the gateway.");
  const localApi = await db.getApiById(apiId);
  if (!localApi) throw new Error("API not found");
  const graviteeApiId = (localApi as any).graviteeApiId;
  if (!graviteeApiId) throw new Error("Publish the API to the gateway before deploying masking rules.");

  // Apply rules scoped to this API plus tenant-wide rules (apiId = null).
  const rules = (await db.getMaskingRules((localApi as any).tenantId))
    .filter((r: any) => (r.apiId === apiId || r.apiId == null)
      && r.enabled !== false && (r.phase === "response" || r.phase === "both"));

  // Masking rules already live in the DB — recompose the full flow set so we
  // don't clobber Design or IP-filtering flows.
  await syncApiFlowsToGateway(apiId);
  return { deployed: true, rules: rules.length };
}

// ─── Gateway Policy Enforcement (IP/CIDR filtering) ──────────────────────────

const IP_FILTER_FLOW_NAME = "cloudinfinit-ip-filtering";

// Compiles the tenant's ip_filtering policies scoped to this API into a Gravitee
// `ip-filtering` request policy (allow -> whitelist, deny -> blacklist) and
// redeploys, so IP/CIDR access control is enforced at the gateway.
export async function deployApiIpFilteringToGateway(apiId: number) {
  const status = await getConnectionStatus();
  if (status.mode !== "live") throw new Error("Gravitee is not reachable — cannot deploy IP filtering to the gateway.");
  const localApi = await db.getApiById(apiId);
  if (!localApi) throw new Error("API not found");
  const graviteeApiId = (localApi as any).graviteeApiId;
  if (!graviteeApiId) throw new Error("Publish the API to the gateway before deploying IP filtering.");

  const policies = (await db.getPoliciesByTenant((localApi as any).tenantId))
    .filter((p: any) => p.type === "ip_filtering" && p.enabled !== false)
    .filter((p: any) => { const c = p.configuration || {}; return c.apiId === apiId || c.apiId == null; });

  const whitelistIps: string[] = [];
  const blacklistIps: string[] = [];
  for (const p of policies) {
    const c = (p as any).configuration || {};
    const ips: string[] = Array.isArray(c.ips) ? c.ips.filter(Boolean) : [];
    if (c.mode === "allow") whitelistIps.push(...ips); else blacklistIps.push(...ips);
  }

  // IP policies already live in the DB — recompose the full flow set.
  await syncApiFlowsToGateway(apiId);
  return { deployed: true, whitelist: whitelistIps.length, blacklist: blacklistIps.length };
}

// ─── Unified flow composition ────────────────────────────────────────────────
// The Design editor, data masking, and IP filtering each contribute a named flow.
// composeApiFlows rebuilds the API's COMPLETE flow set from every local source so
// deploying one never wipes the others (they used to clobber each other).
const DESIGN_FLOW_NAME = "cloudinfinit-design";
const HTTP_SELECTOR = [{ type: "HTTP", path: "/", pathOperator: "STARTS_WITH", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] }];

function buildDesignFlow(policyFlows: any[]) {
  const request = policyFlows.filter(f => f.phase === "request").map(f => ({ name: f.type, policy: f.type, enabled: true, configuration: f.config }));
  const response = policyFlows.filter(f => f.phase === "response").map(f => ({ name: f.type, policy: f.type, enabled: true, configuration: f.config }));
  if (request.length === 0 && response.length === 0) return null;
  return { name: DESIGN_FLOW_NAME, enabled: true, selectors: HTTP_SELECTOR, request, response };
}

function buildIpFilteringFlow(policies: any[]) {
  const whitelistIps: string[] = [];
  const blacklistIps: string[] = [];
  for (const p of policies) {
    const c = (p as any).configuration || {};
    const ips: string[] = Array.isArray(c.ips) ? c.ips.filter(Boolean) : [];
    if (c.mode === "allow") whitelistIps.push(...ips); else blacklistIps.push(...ips);
  }
  if (whitelistIps.length === 0 && blacklistIps.length === 0) return null;
  return {
    name: IP_FILTER_FLOW_NAME, enabled: true, selectors: HTTP_SELECTOR,
    request: [{ name: "IP Filtering", enabled: true, policy: "ip-filtering", configuration: { matchAllFromXForwardedFor: false, whitelistIps, blacklistIps } }],
    response: [],
  };
}

async function composeApiFlows(apiId: number): Promise<any[]> {
  const localApi = await db.getApiById(apiId);
  const tenantId = (localApi as any)?.tenantId;
  const flows: any[] = [];

  const design = buildDesignFlow((localApi as any)?.openApiSpec?.policyFlows ?? []);
  if (design) flows.push(design);

  const maskRules = (await db.getMaskingRules(tenantId))
    .filter((r: any) => (r.apiId === apiId || r.apiId == null) && r.enabled !== false && (r.phase === "response" || r.phase === "both"));
  if (maskRules.length) flows.push(buildMaskingFlow(maskRules));

  const ipPolicies = (await db.getPoliciesByTenant(tenantId))
    .filter((p: any) => p.type === "ip_filtering" && p.enabled !== false)
    .filter((p: any) => { const c = (p as any).configuration || {}; return c.apiId === apiId || c.apiId == null; });
  const ipFlow = buildIpFilteringFlow(ipPolicies);
  if (ipFlow) flows.push(ipFlow);

  return flows;
}

// Recompose and push the full flow set to Gravitee, then deploy. No-op if the API
// isn't synced or Gravitee is offline. This is the single writer of API flows.
export async function syncApiFlowsToGateway(apiId: number): Promise<{ synced: boolean; flowCount: number }> {
  const status = await getConnectionStatus();
  const localApi = await db.getApiById(apiId);
  const graviteeApiId = (localApi as any)?.graviteeApiId;
  if (status.mode !== "live" || !graviteeApiId) return { synced: false, flowCount: 0 };
  const flows = await composeApiFlows(apiId);
  const api = await gravitee.getApi(graviteeApiId);
  await gravitee.updateApi(graviteeApiId, { ...(api as any), flows });
  await gravitee.deployApi(graviteeApiId);
  return { synced: true, flowCount: flows.length };
}

// ─── Gateway Instances Sync ──────────────────────────────────────────────────

export async function getGatewayInstancesHybrid() {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const instances = await gravitee.listInstances({ includeStopped: true });
      return {
        instances: instances.map(inst => ({
          id: inst.id,
          hostname: inst.hostname,
          ip: inst.ip,
          port: inst.port,
          state: inst.state,
          version: inst.version,
          tags: inst.tags || [],
          tenant: inst.tenant,
          os: inst.operatingSystemName,
          startedAt: inst.startedAt,
          lastHeartbeat: inst.lastHeartbeatAt,
          stoppedAt: inst.stoppedAt,
        })),
        source: "gravitee" as const,
      };
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch instances:");
    }
  }

  // Return local cluster data as fallback
  const clusters = await db.getGatewayClusters();
  return {
    instances: clusters.map((c: any) => ({
      id: String(c.id),
      hostname: c.name,
      ip: "N/A",
      port: 8082,
      state: c.status === "healthy" ? "STARTED" : "STOPPED",
      version: c.graviteeVersion || "4.x",
      tags: c.shardingTags || [],
      tenant: c.region,
      os: "Linux",
      startedAt: c.createdAt,
      lastHeartbeat: c.updatedAt,
    })),
    source: "local" as const,
  };
}

// ─── Subscriptions Sync ──────────────────────────────────────────────────────

export async function createConsumerAppHybrid(input: {
  id: number;
  name: string;
  description?: string;
  clientId: string;
}) {
  const status = await getConnectionStatus();
  if (status.mode !== "live") return;
  try {
    const graviteeApp = await gravitee.createApplication({
      name: input.name,
      description: input.description || "",
      type: "SIMPLE",
      settings: { app: { clientId: input.clientId } },
    });
    await db.updateConsumerApp(input.id, { graviteeAppId: graviteeApp.id } as any);
  } catch (error) {
    graviteeErrors.inc({ operation: "create_app" }); logger.warn({ err: error }, "[GraviteeSync] Failed to create Gravitee application:");
  }
}

export async function createSubscriptionHybrid(input: {
  consumerAppId: number;
  planId: number;
  apiId: number;
  tenantId: number;
}) {
  // Determine if plan requires manual approval
  const plans = await db.getPlansByApi(input.apiId);
  const plan = plans.find((p: any) => p.id === input.planId);
  const requiresManualApproval = !(plan as any)?.autoApprove;

  const initialStatus = requiresManualApproval ? "pending" : "approved";
  const id = await db.createSubscription({
    ...input,
    status: initialStatus,
    approvedAt: requiresManualApproval ? null : new Date(),
  } as any);

  // Only auto-sync to Gravitee for auto-approve plans; manual plans wait for explicit approval
  if (!requiresManualApproval) {
    const connStatus = await getConnectionStatus();
    if (connStatus.mode === "live") {
      try {
        const [localApi, localPlan, localApp] = await Promise.all([
          db.getApiById(input.apiId),
          db.getPlansByApi(input.apiId).then(ps => ps.find((p: any) => p.id === input.planId)),
          db.getConsumerAppById(input.consumerAppId),
        ]);

        const graviteeApiId = (localApi as any)?.graviteeApiId;
        const graviteePlanId = (localPlan as any)?.graviteeApiId;
        const graviteeAppId = (localApp as any)?.graviteeAppId;

        if (graviteeApiId && graviteePlanId && graviteeAppId) {
          const graviteeSub = await gravitee.createSubscription(graviteeApiId, {
            planId: graviteePlanId,
            applicationId: graviteeAppId,
          });

          let apiKey: string | undefined;
          try {
            const keys = await gravitee.getSubscriptionApiKeys(graviteeApiId, graviteeSub.id);
            apiKey = keys[0]?.key;
          } catch (_) { /* best-effort */ }

          await db.updateSubscription(id!, { graviteeSubId: graviteeSub.id, apiKey: apiKey ?? null } as any);
        }
      } catch (error) {
        graviteeErrors.inc({ operation: "create_subscription" }); logger.warn({ err: error }, "[GraviteeSync] Failed to sync subscription to Gravitee:");
      }
    }
  }

  const sub = await db.getSubscriptionById(id!);
  return { id, apiKey: (sub as any)?.apiKey ?? null, status: initialStatus };
}

export async function approveSubscriptionHybrid(subscriptionId: number): Promise<{ apiKey: string | null }> {
  const sub = await db.getSubscriptionById(subscriptionId);
  if (!sub) throw new Error("Subscription not found");

  await db.updateSubscription(subscriptionId, { status: "approved", approvedAt: new Date() } as any);

  const connStatus = await getConnectionStatus();
  if (connStatus.mode === "live") {
    try {
      const [localApi, localPlan, localApp] = await Promise.all([
        db.getApiById((sub as any).apiId),
        db.getPlansByApi((sub as any).apiId).then(ps => ps.find((p: any) => p.id === (sub as any).planId)),
        db.getConsumerAppById((sub as any).consumerAppId),
      ]);

      const graviteeApiId = (localApi as any)?.graviteeApiId;
      const graviteePlanId = (localPlan as any)?.graviteeApiId;
      const graviteeAppId = (localApp as any)?.graviteeAppId;

      if (graviteeApiId && graviteePlanId && graviteeAppId) {
        // Create subscription in Gravitee (or process existing pending one)
        const existingGraviteeSubId = (sub as any).graviteeSubId;
        let graviteeSubId = existingGraviteeSubId;

        if (!graviteeSubId) {
          const graviteeSub = await gravitee.createSubscription(graviteeApiId, { planId: graviteePlanId, applicationId: graviteeAppId });
          graviteeSubId = graviteeSub.id;
        } else {
          await gravitee.processSubscription(graviteeApiId, graviteeSubId, true);
        }

        let apiKey: string | undefined;
        try {
          const keys = await gravitee.getSubscriptionApiKeys(graviteeApiId, graviteeSubId);
          apiKey = keys[0]?.key;
        } catch (_) { /* best-effort */ }

        await db.updateSubscription(subscriptionId, { graviteeSubId, apiKey: apiKey ?? null } as any);
        const updated = await db.getSubscriptionById(subscriptionId);
        return { apiKey: (updated as any)?.apiKey ?? null };
      }
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to approve subscription in Gravitee:");
    }
  }

  return { apiKey: null };
}

export async function rejectSubscriptionHybrid(subscriptionId: number, reason?: string): Promise<void> {
  const sub = await db.getSubscriptionById(subscriptionId);
  if (!sub) throw new Error("Subscription not found");

  await db.updateSubscription(subscriptionId, { status: "rejected" } as any);

  const connStatus = await getConnectionStatus();
  if (connStatus.mode === "live" && (sub as any).graviteeSubId) {
    try {
      const localApi = await db.getApiById((sub as any).apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      if (graviteeApiId) {
        await gravitee.processSubscription(graviteeApiId, (sub as any).graviteeSubId, false, reason);
      }
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to reject subscription in Gravitee:");
    }
  }
}

export async function rotateSubscriptionApiKeyHybrid(subscriptionId: number): Promise<{ apiKey: string }> {
  const sub = await db.getSubscriptionById(subscriptionId);
  if (!sub) throw new Error("Subscription not found");

  const connStatus = await getConnectionStatus();
  if (connStatus.mode === "live" && (sub as any).graviteeSubId) {
    const localApi = await db.getApiById((sub as any).apiId);
    const graviteeApiId = (localApi as any)?.graviteeApiId;
    if (!graviteeApiId) throw new Error("API not synced to Gravitee");

    const newKey = await gravitee.renewSubscriptionApiKey(graviteeApiId, (sub as any).graviteeSubId);
    await db.updateSubscription(subscriptionId, { apiKey: newKey.key } as any);
    const updated = await db.getSubscriptionById(subscriptionId);
    return { apiKey: (updated as any)?.apiKey ?? newKey.key };
  }

  // Local mode: generate a new key
  const { nanoid } = await import("nanoid");
  const newApiKey = `ci_${nanoid(40)}`;
  await db.updateSubscription(subscriptionId, { apiKey: newApiKey } as any);
  const updated = await db.getSubscriptionById(subscriptionId);
  return { apiKey: (updated as any)?.apiKey ?? newApiKey };
}

// ─── Plans Sync ──────────────────────────────────────────────────────────────

const PERIOD_UNIT_MAP: Record<string, string> = {
  second: "SECONDS", minute: "MINUTES", hour: "HOURS", day: "DAYS", week: "WEEKS", month: "MONTHS",
};

function buildRateLimitFlow(rateLimit: number, rateLimitPeriod: string, quotaLimit: number, quotaPeriod: string) {
  return [{
    name: "Rate Limit & Quota",
    enabled: true,
    selectors: [{ type: "HTTP", path: "/", pathOperator: "STARTS_WITH", methods: ["GET","POST","PUT","DELETE","PATCH","OPTIONS","HEAD"] }],
    request: [{
      policy: "rate-limit",
      name: "Rate Limiting",
      enabled: true,
      configuration: {
        addHeaders: true,
        rate: { dynamicRateLimit: false, limit: rateLimit, periodTime: 1, periodTimeUnit: PERIOD_UNIT_MAP[rateLimitPeriod] ?? "MINUTES" },
        quota: { dynamicQuotaLimit: false, limit: quotaLimit, periodTime: 1, periodTimeUnit: PERIOD_UNIT_MAP[quotaPeriod] ?? "MONTHS" },
      },
    }],
    response: [], subscribe: [], publish: [],
  }];
}

export async function createPlanHybrid(input: {
  apiId: number;
  tenantId: number;
  name: string;
  description?: string;
  rateLimit: number;
  rateLimitPeriod: "second" | "minute" | "hour" | "day";
  quotaLimit: number;
  quotaPeriod: "day" | "week" | "month";
  pricePerCall?: string;
  monthlyFee?: string;
  autoApprove: boolean;
}) {
  const localId = await db.createPlan(input);

  const status = await getConnectionStatus();
  if (status.mode === "live") {
    try {
      const localApi = await db.getApiById(input.apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      if (graviteeApiId) {
        const graviteePlan = await gravitee.createPlan(graviteeApiId, {
          definitionVersion: "V4",
          name: input.name,
          description: input.description || "",
          mode: "STANDARD",
          security: { type: "API_KEY" },
          validation: input.autoApprove ? "AUTO" : "MANUAL",
          flows: buildRateLimitFlow(input.rateLimit, input.rateLimitPeriod, input.quotaLimit, input.quotaPeriod),
        });
        await gravitee.publishPlan(graviteeApiId, graviteePlan.id);
        await db.updatePlan(localId!, { graviteeApiId: graviteePlan.id } as any);
      }
    } catch (error) {
      graviteeErrors.inc({ operation: "create_plan" }); logger.warn({ err: error }, "[GraviteeSync] Failed to sync plan:");
    }
  }

  return { id: localId };
}

// ─── Analytics Sync ──────────────────────────────────────────────────────────

export async function getApiAnalyticsHybrid(apiId: number, from: number, to: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const localApi = await db.getApiById(apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      if (graviteeApiId) {
        const [countAnalytics, statusAnalytics] = await Promise.all([
          gravitee.getApiAnalytics(graviteeApiId, { type: "count", from, to }),
          gravitee.getApiAnalytics(graviteeApiId, { type: "group_by", field: "status", from, to }),
        ]);
        return {
          source: "gravitee" as const,
          totalCalls: countAnalytics.values?.["count"] || 0,
          statusBreakdown: statusAnalytics.buckets || [],
        };
      }
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch analytics:");
    }
  }

  // Return mock analytics for local mode
  return {
    source: "local" as const,
    totalCalls: 0,
    statusBreakdown: [],
  };
}

export async function getPlatformAnalyticsHybrid(from: number, to: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const [countAnalytics, topApis] = await Promise.all([
        gravitee.getPlatformAnalytics({ type: "count", from, to }),
        gravitee.getPlatformAnalytics({ type: "group_by", field: "api", from, to }),
      ]);
      return {
        source: "gravitee" as const,
        totalCalls: countAnalytics.values?.["count"] || 0,
        topApis: topApis.buckets || [],
      };
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch platform analytics:");
    }
  }

  return { source: "local" as const, totalCalls: 0, topApis: [] };
}

// ─── Policy Sync ─────────────────────────────────────────────────────────────

export async function getAvailablePoliciesHybrid() {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const policies = await gravitee.listPolicies();
      return { policies, source: "gravitee" as const };
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch policies:");
    }
  }

  // Return local policy list from the policies table
  const localPolicies = await db.getPoliciesByTenant(0); // platform-level policies
  return { policies: localPolicies, source: "local" as const };
}

export async function syncApiFlowsHybrid(apiId: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const localApi = await db.getApiById(apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      if (graviteeApiId) {
        const flows = await gravitee.getApiFlows(graviteeApiId);
        return { flows, source: "gravitee" as const };
      }
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch flows:");
    }
  }

  const chains = await db.getPolicyChains(apiId);
  return { flows: chains, source: "local" as const };
}

// ─── Import OpenAPI Sync ─────────────────────────────────────────────────────

export async function importOpenApiHybrid(spec: string, tenantId: number, workspaceId: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const graviteeApi: any = await gravitee.importApiFromOpenApi(spec);

      // Gravitee derives these from the spec (server basePath -> context path,
      // servers[0].url -> backend endpoint).
      const contextPath: string | undefined =
        (graviteeApi.listeners?.[0]?.paths?.[0]?.path || "").replace(/\/$/, "") || undefined;
      const backendUrl: string | undefined =
        graviteeApi.endpointGroups?.[0]?.endpoints?.[0]?.configuration?.target || undefined;

      const localId = await db.createApi({
        tenantId,
        workspaceId,
        name: graviteeApi.name || "Imported API",
        version: graviteeApi.apiVersion || "1.0.0",
        protocol: "rest",
        description: graviteeApi.description,
        backendUrl,
        contextPath,
        graviteeApiId: graviteeApi.id,
      } as any);

      return { id: localId, graviteeApiId: graviteeApi.id, synced: true, name: graviteeApi.name, contextPath, backendUrl };
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to import OpenAPI to Gravitee:");
      // Fall through to local-only import
    }
  }

  // Local-only: parse the spec and create an API record
  let parsed: any = {};
  try {
    parsed = JSON.parse(spec);
  } catch {
    // Could be YAML - store raw
  }
  
  const localId = await db.createApi({
    tenantId,
    workspaceId,
    name: parsed.info?.title || "Imported API",
    version: parsed.info?.version || "1.0.0",
    protocol: "rest",
    description: parsed.info?.description,
    backendUrl: parsed.servers?.[0]?.url,
    openApiSpec: spec,
  } as any);

  return { id: localId, synced: false, name: parsed.info?.title || "Imported API" };
}

// ─── Developer Portal Sync ───────────────────────────────────────────────────

export async function getPortalApisHybrid() {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const portalApis = await gravitee.getPortalApis();
      return { apis: portalApis.data || portalApis, source: "gravitee" as const };
    } catch (error) {
      logger.warn({ err: error }, "[GraviteeSync] Failed to fetch portal APIs:");
    }
  }

  return { apis: [], source: "local" as const };
}

// ─── Publish API (create if needed + deploy + start) ─────────────────────────

export async function publishApiHybrid(apiId: number): Promise<{ graviteeApiId: string; deployed: boolean }> {
  const status = await getConnectionStatus();
  if (status.mode !== "live") {
    throw new Error("Gravitee is not configured. Set GRAVITEE_API_URL and GRAVITEE_API_USER/GRAVITEE_API_TOKEN in .env");
  }

  const localApi = await db.getApiById(apiId);
  if (!localApi) throw new Error(`API ${apiId} not found`);

  let graviteeApiId = (localApi as any).graviteeApiId as string | undefined;

  // Create in Gravitee if not yet synced
  if (!graviteeApiId) {
    const definition = buildGraviteeApiDefinition(localApi as any);
    const graviteeApi = await gravitee.createApi(definition);
    graviteeApiId = graviteeApi.id;
    await db.updateApi(apiId, { graviteeApiId } as any);
  }

  // Gravitee requires at least one published plan before deploying.
  // Sync local plans; if none, create a default keyless plan.
  const publishedPlans = await gravitee.listPlans(graviteeApiId, { status: "PUBLISHED" });
  if (publishedPlans.data.length === 0) {
    const localPlans = await db.getPlansByApi(apiId);
    const plansToCreate = localPlans.length > 0 ? localPlans : [null];

    for (const lp of plansToCreate) {
      const planDef = lp
        ? {
            definitionVersion: "V4",
            name: (lp as any).name,
            description: (lp as any).description || "",
            mode: "STANDARD",
            security: { type: "API_KEY" },
            validation: (lp as any).autoApprove ? "AUTO" : "MANUAL",
          }
        : {
            definitionVersion: "V4",
            name: "Default Plan",
            description: "Default open access",
            mode: "STANDARD",
            security: { type: "KEY_LESS" },
            validation: "AUTO",
          };
      const gPlan = await gravitee.createPlan(graviteeApiId, planDef);
      await gravitee.publishPlan(graviteeApiId, gPlan.id);
    }
  }

  // Deploy to gateway, then start traffic. Starting is idempotent — re-publishing
  // an API that's already running on the gateway must not fail.
  await gravitee.deployApi(graviteeApiId);
  try {
    await gravitee.startApi(graviteeApiId);
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || "";
    if (!/already started/i.test(msg)) throw err;
  }

  return { graviteeApiId, deployed: true };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function buildGraviteeApiDefinition(input: {
  name: string;
  version: string;
  protocol: string;
  backendUrl?: string;
  contextPath?: string;
  description?: string;
}) {
  const contextPath = input.contextPath || `/${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  
  return {
    definitionVersion: "V4",
    name: input.name,
    apiVersion: input.version,
    description: input.description || "",
    type: input.protocol === "kafka" || input.protocol === "mqtt" ? "MESSAGE" : "PROXY",
    listeners: [
      {
        type: "HTTP",
        paths: [{ path: contextPath }],
        entrypoints: [{ type: "http-proxy" }],
      },
    ],
    endpointGroups: input.backendUrl ? [
      {
        name: "Default Backend",
        type: "http-proxy",
        endpoints: [
          {
            name: "default",
            type: "http-proxy",
            inheritConfiguration: false,
            configuration: { target: input.backendUrl },
          },
        ],
      },
    ] : [],
    flows: [],
    analytics: { enabled: true },
  };
}
