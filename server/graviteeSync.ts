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
      console.warn("[GraviteeSync] Failed to fetch APIs from Gravitee, falling back to local:", error);
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
      console.warn("[GraviteeSync] Failed to create API in Gravitee:", error);
      return { id: localId, synced: false, error: "Created locally but failed to sync to Gravitee" };
    }
  }

  return { id: localId, synced: false };
}

export async function deployApiHybrid(input: {
  apiId: number;
  clusterId: number;
  tenantId: number;
  version: string;
  strategy: "rolling" | "blue_green" | "canary";
  configuration?: any;
}) {
  const status = await getConnectionStatus();
  
  // Create local deployment record
  const deploymentId = await db.createApiDeployment({
    ...input,
    status: "deploying",
    syncStatus: "syncing",
  });

  if (status.mode === "live") {
    try {
      // Get the Gravitee API ID from local DB
      const localApi = await db.getApiById(input.apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      
      if (graviteeApiId) {
        // Deploy to Gravitee gateway
        await gravitee.deployApi(graviteeApiId);
        await gravitee.startApi(graviteeApiId);
        
        // Update local record
        await db.updateApiDeployment(deploymentId!, {
          status: "deployed",
          syncStatus: "synced",
          deployedAt: new Date(),
          lastSyncAt: new Date(),
        });
        
        return { id: deploymentId, synced: true, graviteeState: "STARTED" };
      }
    } catch (error) {
      console.warn("[GraviteeSync] Failed to deploy API to Gravitee:", error);
      await db.updateApiDeployment(deploymentId!, {
        status: "failed",
        syncStatus: "error",
      });
      return { id: deploymentId, synced: false, error: String(error) };
    }
  }

  // Simulate deployment in local mode
  setTimeout(async () => {
    await db.updateApiDeployment(deploymentId!, {
      status: "deployed",
      syncStatus: status.mode === "live" ? "synced" as const : "synced" as const,
      deployedAt: new Date(),
      lastSyncAt: new Date(),
    });
  }, 3000);

  return { id: deploymentId, synced: false };
}

export async function undeployApiHybrid(deploymentId: number) {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      // Get deployment info to find the Gravitee API ID
      const deployments = await db.getApiDeployments(undefined, undefined);
      const deployment = deployments.find((d: any) => d.id === deploymentId);
      if (deployment) {
        const localApi = await db.getApiById(deployment.apiId);
        const graviteeApiId = (localApi as any)?.graviteeApiId;
        if (graviteeApiId) {
          await gravitee.stopApi(graviteeApiId);
        }
      }
    } catch (error) {
      console.warn("[GraviteeSync] Failed to undeploy from Gravitee:", error);
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
      console.warn("[GraviteeSync] Failed to fetch instances:", error);
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

export async function createSubscriptionHybrid(input: {
  consumerAppId: number;
  planId: number;
  apiId: number;
  tenantId: number;
}) {
  // Create locally
  const id = await db.createSubscription({ ...input, status: "approved", approvedAt: new Date() });

  const status = await getConnectionStatus();
  if (status.mode === "live") {
    try {
      const localApi = await db.getApiById(input.apiId);
      const graviteeApiId = (localApi as any)?.graviteeApiId;
      if (graviteeApiId) {
        // In Gravitee, subscriptions link applications to plans
        // We'd need the Gravitee plan ID and app ID
        // For now, log the sync attempt
        console.log(`[GraviteeSync] Would create subscription in Gravitee for API ${graviteeApiId}`);
      }
    } catch (error) {
      console.warn("[GraviteeSync] Failed to sync subscription:", error);
    }
  }

  return { id };
}

// ─── Plans Sync ──────────────────────────────────────────────────────────────

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
        });
        // Could store gravitee plan ID locally
        console.log(`[GraviteeSync] Created plan ${graviteePlan.id} in Gravitee`);
      }
    } catch (error) {
      console.warn("[GraviteeSync] Failed to sync plan:", error);
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
      console.warn("[GraviteeSync] Failed to fetch analytics:", error);
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
      console.warn("[GraviteeSync] Failed to fetch platform analytics:", error);
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
      console.warn("[GraviteeSync] Failed to fetch policies:", error);
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
      console.warn("[GraviteeSync] Failed to fetch flows:", error);
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
      const graviteeApi = await gravitee.importApiFromOpenApi(spec);
      
      // Also create local record
      const localId = await db.createApi({
        tenantId,
        workspaceId,
        name: graviteeApi.name,
        version: graviteeApi.apiVersion || "1.0.0",
        protocol: "rest",
        description: graviteeApi.description,
        graviteeApiId: graviteeApi.id,
      } as any);

      return { id: localId, graviteeApiId: graviteeApi.id, synced: true };
    } catch (error) {
      console.warn("[GraviteeSync] Failed to import OpenAPI to Gravitee:", error);
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
    openApiSpec: spec,
  } as any);

  return { id: localId, synced: false };
}

// ─── Developer Portal Sync ───────────────────────────────────────────────────

export async function getPortalApisHybrid() {
  const status = await getConnectionStatus();
  
  if (status.mode === "live") {
    try {
      const portalApis = await gravitee.getPortalApis();
      return { apis: portalApis.data || portalApis, source: "gravitee" as const };
    } catch (error) {
      console.warn("[GraviteeSync] Failed to fetch portal APIs:", error);
    }
  }

  return { apis: [], source: "local" as const };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildGraviteeApiDefinition(input: {
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
