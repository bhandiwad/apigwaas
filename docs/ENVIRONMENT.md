# Environment Variables

This document lists all environment variables used by the CloudInfinit API Gateway platform.

---

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string with SSL | `mysql://user:pass@host:3306/db?ssl=true` |
| `JWT_SECRET` | Secret for signing session JWT cookies (minimum 32 characters) | Random string |
| `VITE_APP_ID` | OAuth application ID for Manus authentication | UUID |
| `OAUTH_SERVER_URL` | Manus OAuth backend base URL | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal URL (frontend redirect) | `https://id.manus.im` |
| `OWNER_OPEN_ID` | OAuth identifier for the platform owner (auto-promoted to admin) | String |
| `OWNER_NAME` | Display name for the platform owner | String |

---

## Gravitee Integration (Optional)

These variables enable live synchronization with a Gravitee APIM instance. When not configured, the platform operates in Local Mode.

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAVITEE_API_URL` | Gravitee Management API base URL | `http://localhost:8083` |
| `GRAVITEE_API_TOKEN` | Personal Access Token for Gravitee API authentication | None |
| `GRAVITEE_ORG_ID` | Gravitee organization identifier | `DEFAULT` |
| `GRAVITEE_ENV_ID` | Gravitee environment identifier | `DEFAULT` |
| `GRAVITEE_TIMEOUT` | HTTP request timeout in milliseconds | `30000` |
| `GRAVITEE_RETRY_ATTEMPTS` | Number of retry attempts for failed requests | `3` |
| `GRAVITEE_RETRY_DELAY` | Delay between retries in milliseconds | `1000` |

---

## Branding (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_TITLE` | Application title in browser tab and header | `CloudInfinit API Gateway` |
| `VITE_APP_LOGO` | Logo URL for the application header | None |

---

## Internal System Variables

These are automatically configured by the platform and should not be modified manually:

| Variable | Description |
|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | Internal Manus API endpoint |
| `BUILT_IN_FORGE_API_KEY` | Internal API authentication key |
| `VITE_FRONTEND_FORGE_API_URL` | Frontend-accessible API endpoint |
| `VITE_FRONTEND_FORGE_API_KEY` | Frontend API authentication key |
| `VITE_ANALYTICS_ENDPOINT` | Analytics collection endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website identifier |
