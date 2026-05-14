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
  organizationId: string;
  environmentId: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

function getConfig(): GraviteeConfig {
  return {
    baseUrl: ENV.graviteeApiUrl || "http://localhost:8083",
    token: ENV.graviteeApiToken || "",
    organizationId: ENV.graviteeOrgId || "DEFAULT",
    environmentId: ENV.graviteeEnvId || "DEFAULT",
    timeout: parseInt(process.env.GRAVITEE_TIMEOUT || "30000"),
    retryAttempts: parseInt(process.env.GRAVITEE_RETRY_ATTEMPTS || "3"),
    retryDelay: parseInt(process.env.GRAVITEE_RETRY_DELAY || "1000"),
  };
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
      "Authorization": `Bearer ${config.token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  });

  // Response interceptor for error handling
  _client.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };
      if (!originalRequest) return Promise.reject(error);
      
      originalRequest._retryCount = originalRequest._retryCount || 0;

      // Retry on 5xx or network errors
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

// Reset client (useful when config changes)
export function resetGraviteeClient(): void {
  _client = null;
}

// ─── Health Check ────────────────────────────────────────────────────────────

export interface GraviteeHealthStatus {
  connected: boolean;
  version?: string;
  status?: string;
  error?: string;
  latencyMs?: number;
}

export async function checkGraviteeHealth(): Promise<GraviteeHealthStatus> {
  const config = getConfig();
  if (!config.token || !config.baseUrl) {
    return { connected: false, error: "GRAVITEE_API_URL or GRAVITEE_API_TOKEN not configured" };
  }

  const start = Date.now();
  try {
    const client = getClient();
    const response = await client.get("/management/v2/environments");
    return {
      connected: true,
      version: response.headers["x-gravitee-version"] || "unknown",
      status: "healthy",
      latencyMs: Date.now() - start,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || "Connection failed",
      latencyMs: Date.now() - start,
    };
  }
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

function v1Path(path: string): string {
  const config = getConfig();
  return `/management/organizations/${config.organizationId}/environments/${config.environmentId}${path}`;
}

function v2Path(path: string): string {
  const config = getConfig();
  return `/management/v2/environments/${config.environmentId}${path}`;
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

export async function getApi(apiId: string): Promise<GraviteeApi> {
  const client = getClient();
  const response = await client.get(v2Path(`/apis/${apiId}`));
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

export async function startApi(apiId: string): Promise<void> {
  const client = getClient();
  await client.post(v2Path(`/apis/${apiId}/_start`));
}

export async function stopApi(apiId: string): Promise<void> {
  const client = getClient();
  await client.post(v2Path(`/apis/${apiId}/_stop`));
}

export async function deployApi(apiId: string, label?: string): Promise<GraviteeDeployment> {
  const client = getClient();
  const response = await client.post(v2Path(`/apis/${apiId}/deployments`), { deploymentLabel: label });
  return response.data;
}

export async function getApiDeploymentState(apiId: string): Promise<{ apiId: string; deployedAt?: string; isDeployed: boolean }> {
  const client = getClient();
  try {
    const api = await getApi(apiId);
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
  return !!(
    config.baseUrl && 
    config.token && 
    config.token !== "not-configured" &&
    config.baseUrl !== "http://localhost:8083"
  );
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
