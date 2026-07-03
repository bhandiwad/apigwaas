/**
 * Gravitee Management API Client
 * 
 * Provides a typed HTTP client for interacting with the Gravitee APIM Management API.
 * Supports both v1 (/management) and v2 (/management/v2) endpoints.
 * 
 * Authentication: Bearer token (Personal Access Token)
 * Base URL pattern: {GRAVITEE_API_URL}/management/v2/environments/{envId}/...
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from "axios";
import { ENV } from "./_core/env";

// ─── Configuration ───────────────────────────────────────────────────────────

interface GraviteeConfig {
  baseUrl: string;
  token: string;
  user: string;
  password: string;
  organizationId: string;
  environmentId: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

function getConfig(): GraviteeConfig {
  return {
    baseUrl: ENV.graviteeApiUrl || "",
    token: ENV.graviteeApiToken || "",
    user: ENV.graviteeApiUser || "",
    password: ENV.graviteeApiPassword || "",
    organizationId: ENV.graviteeOrgId || "DEFAULT",
    environmentId: ENV.graviteeEnvId || "DEFAULT",
    timeout: parseInt(process.env.GRAVITEE_TIMEOUT || "30000"),
    retryAttempts: parseInt(process.env.GRAVITEE_RETRY_ATTEMPTS || "3"),
    retryDelay: parseInt(process.env.GRAVITEE_RETRY_DELAY || "1000"),
  };
}

// ─── JWT Token Cache (username/password auth) ────────────────────────────────

let _jwtCache: { token: string; expiresAt: number } | null = null;

async function resolveAuthToken(): Promise<string> {
  const config = getConfig();

  // PAT takes priority — used directly as Bearer
  if (config.token) return config.token;

  // Username/password → JWT login
  if (config.user && config.password) {
    if (_jwtCache && _jwtCache.expiresAt > Date.now() + 60_000) {
      return _jwtCache.token;
    }
    const creds = Buffer.from(`${config.user}:${config.password}`).toString("base64");
    const resp = await axios.post(
      `${config.baseUrl}/management/organizations/${config.organizationId}/user/login`,
      {},
      {
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/json" },
        timeout: 10_000,
      }
    );
    const token: string = resp.data?.token || resp.data?.access_token;
    if (!token) throw new Error("Gravitee login failed: unexpected response format");
    _jwtCache = { token, expiresAt: Date.now() + 50 * 60_000 }; // cache 50 min
    return token;
  }

  throw new Error("Gravitee not configured: set GRAVITEE_API_TOKEN or GRAVITEE_API_USER + GRAVITEE_API_PASSWORD");
}

// ─── HTTP Client with Retry ──────────────────────────────────────────────────

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;
  const config = getConfig();

  _client = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  // Inject auth token per-request (supports JWT refresh)
  _client.interceptors.request.use(async (requestConfig) => {
    const token = await resolveAuthToken();
    requestConfig.headers["Authorization"] = `Bearer ${token}`;
    return requestConfig;
  });

  // Response interceptor for retry on 5xx
  _client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
      if (!originalRequest) return Promise.reject(error);

      originalRequest._retryCount = originalRequest._retryCount || 0;

      const shouldRetry = (
        originalRequest._retryCount < config.retryAttempts &&
        (!error.response || error.response.status >= 500)
      );

      if (shouldRetry) {
        originalRequest._retryCount++;
        const delay = config.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        return _client!.request(originalRequest);
      }

      return Promise.reject(error);
    }
  );

  return _client;
}

// Reset client and cached token (call when config changes)
export function resetGraviteeClient(): void {
  _client = null;
  _jwtCache = null;
}

// ─── Health Check ────────────────────────────────────────────────────────────

export interface GraviteeHealthStatus {
  connected: boolean;
  version?: string;
  status?: string;
  error?: string;
  latencyMs?: number;
}

// The health probe must fail fast: it is batched with data queries by the tRPC
// client, so if it blocks (the shared client's 30s timeout + retries when
// Gravitee is unreachable) the whole UI hangs on "Checking…" instead of falling
// back to local mode. Bound it hard and bypass the retrying client.
const HEALTH_PROBE_TIMEOUT_MS = 4000;

export async function checkGraviteeHealth(): Promise<GraviteeHealthStatus> {
  if (!isGraviteeConfigured()) {
    return { connected: false, error: "Gravitee not configured (set GRAVITEE_API_URL + credentials)" };
  }

  const start = Date.now();
  const probe = (async (): Promise<GraviteeHealthStatus> => {
    const config = getConfig();
    const token = await resolveAuthToken();
    const response = await axios.get(`${config.baseUrl}/management/v2/environments`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      timeout: HEALTH_PROBE_TIMEOUT_MS,
    });
    return {
      connected: true,
      version: response.headers["x-gravitee-version"] || "unknown",
      status: "healthy",
      latencyMs: Date.now() - start,
    };
  })();
  const timeout = new Promise<GraviteeHealthStatus>((resolve) =>
    setTimeout(
      () => resolve({ connected: false, error: "Health check timed out", latencyMs: Date.now() - start }),
      HEALTH_PROBE_TIMEOUT_MS
    )
  );
  try {
    return await Promise.race([probe, timeout]);
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || "Connection failed",
      latencyMs: Date.now() - start,
    };
  }
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

function v1Path(path: string, envId?: string): string {
  const config = getConfig();
  const env = envId || config.environmentId;
  return `/management/organizations/${config.organizationId}/environments/${env}${path}`;
}

function v2Path(path: string, envId?: string): string {
  const config = getConfig();
  const env = envId || config.environmentId;
  return `/management/v2/environments/${env}${path}`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GraviteeApi {
  id: string;
  name: string;
  apiVersion: string;
  definitionVersion: string;
  type: string;
  description?: string;
  visibility: string;
  state: string;
  lifecycleState: string;
  deploymentState?: string;
  primaryOwner?: { id: string; displayName: string; email?: string };
  tags?: string[];
  labels?: string[];
  categories?: string[];
  listeners?: any[];
  endpointGroups?: any[];
  flows?: any[];
  analytics?: { enabled: boolean };
  createdAt?: string;
  updatedAt?: string;
  deployedAt?: string;
}

export interface GraviteePlan {
  id: string;
  name: string;
  description?: string;
  status: string;
  security: { type: string; configuration?: any };
  mode: string;
  validation?: string;
  characteristics?: string[];
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface GraviteeSubscription {
  id: string;
  plan: { id: string; name: string; security?: string };
  application: { id: string; name: string };
  status: string;
  processedAt?: string;
  startingAt?: string;
  endingAt?: string;
  createdAt?: string;
  closedAt?: string;
  request?: string;
  reason?: string;
}

export interface GraviteeApplication {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  domain?: string;
  groups?: string[];
  settings?: {
    app?: { type?: string; clientId?: string };
    oauth?: { clientId?: string; clientSecret?: string; grantTypes?: string[]; redirectUris?: string[] };
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface GraviteeInstance {
  id: string;
  event: string;
  hostname: string;
  ip: string;
  port: number;
  state: string;
  version: string;
  tags?: string[];
  tenant?: string;
  operatingSystemName?: string;
  startedAt?: string;
  lastHeartbeatAt?: string;
  stoppedAt?: string;
  environments?: string[];
  organizations?: string[];
}

export interface GraviteeAnalytics {
  timestamp?: { from: number; to: number; interval: number };
  values?: Record<string, number>;
  buckets?: Array<{ name: string; data: number[] }>;
}

export interface GraviteeDeployment {
  deploymentId?: string;
  deployedAt?: string;
  executionId?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; perPage: number; pageCount: number; pageItemsCount: number; totalCount: number };
  links?: Record<string, string>;
}

// ─── API Management ──────────────────────────────────────────────────────────

export async function listApis(params?: { page?: number; perPage?: number; query?: string }): Promise<PaginatedResponse<GraviteeApi>> {
  const client = getClient();
  const response = await client.get(v2Path("/apis"), {
    params: { page: params?.page || 1, perPage: params?.perPage || 50, q: params?.query },
  });
  return response.data;
}

export async function getApi(apiId: string, envId?: string): Promise<GraviteeApi> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}`, envId));
  return response.data;
}

export async function createApi(definition: any): Promise<GraviteeApi> {
  const client = getClient();
  const response = await client.post(v2Path("/apis"), definition);
  return response.data;
}

export async function updateApi(apiId: string, definition: any): Promise<GraviteeApi> {
  const client = getClient();
  const response = await client.put(v2Path(`/apis/${apiId}`), definition);
  return response.data;
}

export async function deleteApi(apiId: string): Promise<void> {
  const client = getClient();
  await client.delete(v2Path(`/apis/${apiId}`));
}

export async function importApiFromOpenApi(spec: string | object): Promise<GraviteeApi> {
  const client = getClient();
  const payload = typeof spec === "string" ? { payload: spec, type: "INLINE" } : spec;
  const response = await client.post(v2Path("/apis/_import/openapi"), payload);
  return response.data;
}

export async function importApiDefinition(definition: any): Promise<GraviteeApi> {
  const client = getClient();
  const response = await client.post(v2Path("/apis/_import/definition"), definition);
  return response.data;
}

// ─── API Lifecycle ───────────────────────────────────────────────────────────

export async function startApi(apiId: string, envId?: string): Promise<void> {
  const client = getClient();
  await client.post(v2Path(`/apis/${apiId}/_start`, envId));
}

export async function stopApi(apiId: string, envId?: string): Promise<void> {
  const client = getClient();
  await client.post(v2Path(`/apis/${apiId}/_stop`, envId));
}

export async function deployApi(apiId: string, label?: string, envId?: string): Promise<GraviteeDeployment> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/deployments`, envId), { deploymentLabel: label });
  return response.data;
}

export async function getApiDeploymentState(apiId: string, envId?: string): Promise<{ apiId: string; deployedAt?: string; isDeployed: boolean }> {
  const client = getClient();
  try {
    const api = await getApi(apiId, envId);
    return {
      apiId,
      deployedAt: api.deployedAt,
      isDeployed: api.state === "STARTED" && !!api.deployedAt,
    };
  } catch {
    return { apiId, isDeployed: false };
  }
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export async function listPlans(apiId: string, params?: { status?: string }): Promise<PaginatedResponse<GraviteePlan>> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}/plans`), { params });
  return response.data;
}

export async function createPlan(apiId: string, plan: any): Promise<GraviteePlan> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/plans`), plan);
  return response.data;
}

export async function publishPlan(apiId: string, planId: string): Promise<GraviteePlan> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/plans/${planId}/_publish`));
  return response.data;
}

export async function closePlan(apiId: string, planId: string): Promise<GraviteePlan> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/plans/${planId}/_close`));
  return response.data;
}

export async function deprecatePlan(apiId: string, planId: string): Promise<GraviteePlan> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/plans/${planId}/_deprecate`));
  return response.data;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export async function listSubscriptions(apiId: string, params?: { status?: string; applicationId?: string }): Promise<PaginatedResponse<GraviteeSubscription>> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}/subscriptions`), { params });
  return response.data;
}

export async function createSubscription(apiId: string, data: { planId: string; applicationId: string; request?: string }): Promise<GraviteeSubscription> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/subscriptions`), data);
  return response.data;
}

export async function processSubscription(apiId: string, subscriptionId: string, accepted: boolean, reason?: string): Promise<GraviteeSubscription> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/subscriptions/${subscriptionId}/_${accepted ? "accept" : "reject"}`), { reason });
  return response.data;
}

export async function closeSubscription(apiId: string, subscriptionId: string): Promise<void> {
  const client = getClient();
  await client.post(v2Path(`/apis/${apiId}/subscriptions/${subscriptionId}/_close`));
}

export async function getSubscriptionApiKeys(apiId: string, subscriptionId: string): Promise<Array<{ key: string; id: string; createdAt?: string; revokedAt?: string }>> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}/subscriptions/${subscriptionId}/api-keys`));
  return response.data?.data ?? response.data ?? [];
}

export async function renewSubscriptionApiKey(apiId: string, subscriptionId: string): Promise<{ key: string; id: string }> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/subscriptions/${subscriptionId}/api-keys/_renew`));
  return response.data;
}

export async function revokeSubscriptionApiKey(apiId: string, subscriptionId: string, keyId: string): Promise<void> {
  const client = getClient();
  await client.delete(v2Path(`/apis/${apiId}/subscriptions/${subscriptionId}/api-keys/${keyId}`));
}

// ─── Applications ────────────────────────────────────────────────────────────

export async function listApplications(params?: { page?: number; perPage?: number; query?: string }): Promise<PaginatedResponse<GraviteeApplication>> {
  const client = getClient();
  const response = await client.get(v1Path("/applications"), {
    params: { page: params?.page || 1, size: params?.perPage || 50, query: params?.query },
  });
  // v1 returns different pagination format
  return {
    data: response.data.data || response.data,
    pagination: response.data.metadata?.pagination || { page: 1, perPage: 50, pageCount: 1, pageItemsCount: 0, totalCount: 0 },
  };
}

export async function getApplication(appId: string): Promise<GraviteeApplication> {
  const client = getClient();
  const response = await client.get(v1Path(`/applications/${appId}`));
  return response.data;
}

export async function createApplication(data: { name: string; description?: string; type?: string; settings?: any }): Promise<GraviteeApplication> {
  const client = getClient();
  const response = await client.post(v1Path("/applications"), data);
  return response.data;
}

export async function deleteApplication(appId: string): Promise<void> {
  const client = getClient();
  await client.delete(v1Path(`/applications/${appId}`));
}

// ─── Gateway Instances ───────────────────────────────────────────────────────

export async function listInstances(params?: { includeStopped?: boolean; page?: number; size?: number }): Promise<GraviteeInstance[]> {
  const client = getClient();
  const response = await client.get(v1Path("/instances"), {
    params: { includeStopped: params?.includeStopped || false, page: params?.page || 0, size: params?.size || 100 },
  });
  return response.data.content || response.data || [];
}

export async function getInstance(instanceId: string): Promise<GraviteeInstance> {
  const client = getClient();
  const response = await client.get(v1Path(`/instances/${instanceId}`));
  return response.data;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getApiAnalytics(apiId: string, params: { type: string; field?: string; from: number; to: number; interval?: number }): Promise<GraviteeAnalytics> {
  const client = getClient();
  const response = await client.get(v1Path(`/apis/${apiId}/analytics`), { params });
  return response.data;
}

export async function getPlatformAnalytics(params: { type: string; field?: string; from: number; to: number; interval?: number }): Promise<GraviteeAnalytics> {
  const client = getClient();
  const response = await client.get(v1Path("/platform/analytics"), { params });
  return response.data;
}

// ─── API Health ──────────────────────────────────────────────────────────────

export async function getApiHealth(apiId: string, params?: { type?: string; from?: number; to?: number }): Promise<any> {
  const client = getClient();
  const response = await client.get(v1Path(`/apis/${apiId}/health`), { params });
  return response.data;
}

// ─── Policies (available plugins) ────────────────────────────────────────────

export async function listPolicies(): Promise<Array<{ id: string; name: string; description?: string; version?: string; category?: string }>> {
  const client = getClient();
  const response = await client.get("/management/v2/plugins/policies");
  return response.data;
}

// ─── Flows (Policy Chains on APIs) ──────────────────────────────────────────

export async function getApiFlows(apiId: string): Promise<any[]> {
  const api = await getApi(apiId);
  return api.flows || [];
}

export async function updateApiFlows(apiId: string, flows: any[]): Promise<GraviteeApi> {
  const api = await getApi(apiId);
  return updateApi(apiId, { ...api, flows });
}

// ─── Portal / Developer Portal ───────────────────────────────────────────────

export async function getPortalApis(params?: { page?: number; size?: number; category?: string }): Promise<any> {
  const client = getClient();
  const config = getConfig();
  const response = await client.get(`/portal/environments/${config.environmentId}/apis`, { params });
  return response.data;
}

export async function getPortalApi(apiId: string): Promise<any> {
  const client = getClient();
  const config = getConfig();
  const response = await client.get(`/portal/environments/${config.environmentId}/apis/${apiId}`);
  return response.data;
}

// ─── Utility: Check if Gravitee is configured ────────────────────────────────

export function isGraviteeConfigured(): boolean {
  const config = getConfig();
  const hasAuth = !!(config.token || (config.user && config.password));
  return !!(config.baseUrl && hasAuth);
}

// ─── Batch operations ────────────────────────────────────────────────────────

export async function syncAllApiStates(): Promise<Array<{ apiId: string; name: string; state: string; deployedAt?: string }>> {
  if (!isGraviteeConfigured()) return [];
  try {
    const result = await listApis({ perPage: 100 });
    return result.data.map(api => ({
      apiId: api.id,
      name: api.name,
      state: api.state,
      deployedAt: api.deployedAt,
    }));
  } catch {
    return [];
  }
}

export async function syncAllInstances(): Promise<GraviteeInstance[]> {
  if (!isGraviteeConfigured()) return [];
  try {
    return await listInstances({ includeStopped: true });
  } catch {
    return [];
  }
}

export async function getApiLogs(apiId: string, params?: { page?: number; size?: number }): Promise<{ data: any[]; pagination: any }> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}/logs`), { params: { page: params?.page ?? 1, size: params?.size ?? 50 } });
  return response.data;
}
