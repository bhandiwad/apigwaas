function requireEnv(key: string, minLength = 1): string {
  const val = process.env[key];
  if (!val || val.length < minLength) {
    throw new Error(
      `[startup] Missing or insufficient env var: ${key}` +
        (minLength > 1 ? ` (must be at least ${minLength} chars)` : "")
    );
  }
  return val;
}

// Validate critical secrets at module load — fail fast before any request is served
if (process.env.NODE_ENV !== "test") {
  requireEnv("JWT_SECRET", 32);
  requireEnv("DATABASE_URL");
  // ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars) for AES-256
  const encKey = process.env.ENCRYPTION_KEY ?? "";
  if (encKey.length > 0 && encKey.length !== 64) {
    throw new Error("[startup] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes for AES-256)");
  }
}

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",
  // Gravitee Management API
  graviteeApiUrl: process.env.GRAVITEE_API_URL ?? "",
  graviteeApiToken: process.env.GRAVITEE_API_TOKEN ?? "",
  graviteeApiUser: process.env.GRAVITEE_API_USER ?? "",
  graviteeApiPassword: process.env.GRAVITEE_API_PASSWORD ?? "",
  graviteeOrgId: process.env.GRAVITEE_ORG_ID ?? "DEFAULT",
  graviteeEnvId: process.env.GRAVITEE_ENV_ID ?? "DEFAULT",
  // Base URL of the Gravitee gateway that serves API traffic (used by the test console).
  graviteeGatewayUrl: process.env.GRAVITEE_GATEWAY_URL ?? "http://localhost:8082",
  appUrl: process.env.APP_URL ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean),
  // Elasticsearch (Gravitee analytics backend)
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
};
