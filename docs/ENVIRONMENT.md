# Environment Variables

This document lists the environment variables used by the CloudInfinit API Gateway platform, as validated and consumed in `server/_core/env.ts`.

---

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | **PostgreSQL** connection string | `postgresql://user:pass@host:5432/cloudinfinit_apigw` |
| `JWT_SECRET` | Secret for signing session JWT cookies (**minimum 32 characters**; validated at startup) | Random 32+ char string |

The server fails fast at startup if `JWT_SECRET` (< 32 chars) or `DATABASE_URL` is missing (except when `NODE_ENV=test`).

---

## Security (Optional)

| Variable | Description | Constraint |
|----------|-------------|-----------|
| `ENCRYPTION_KEY` | AES-256 key used to encrypt sensitive stored values | If set, must be **exactly 64 hex characters** (32 bytes) |

---

## Gravitee Integration (Optional)

These enable live synchronization with a Gravitee APIM instance. When unset (or the gateway is unreachable), the platform runs in **Local Mode** using only PostgreSQL.

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAVITEE_API_URL` | Gravitee Management API base URL | (empty) |
| `GRAVITEE_API_TOKEN` | Personal Access Token (token auth) | (empty) |
| `GRAVITEE_API_USER` | Basic-auth username (alternative to token) | (empty) |
| `GRAVITEE_API_PASSWORD` | Basic-auth password (alternative to token) | (empty) |
| `GRAVITEE_ORG_ID` | Gravitee organization identifier | `DEFAULT` |
| `GRAVITEE_ENV_ID` | Gravitee environment identifier | `DEFAULT` |
| `GRAVITEE_GATEWAY_URL` | Base URL of the gateway that serves API traffic (used by the in-app test console) | `http://localhost:8082` |
| `ELASTICSEARCH_URL` | Gravitee analytics backend | `http://localhost:9200` |

Authentication precedence: if `GRAVITEE_API_TOKEN` is set it is used; otherwise `GRAVITEE_API_USER`/`GRAVITEE_API_PASSWORD` basic auth is used.

---

## Application (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_URL` | Public base URL of the application (used in links/emails) | (empty) |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist | (empty) |
| `NODE_ENV` | Runtime mode: `development` \| `production` \| `test` | `development` |
| `PORT` | Preferred listen port (auto-increments if busy) | `3000` |

---

## Branding (Optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_APP_TITLE` | Application title in the browser tab and header | `CloudInfinit API Gateway` |
| `VITE_APP_LOGO` | Logo URL for the application header | None |

---

## Notes

- Authentication is **email/password (bcrypt) with JWT session cookies** — there is no external OAuth provider to configure.
- `Vite`-prefixed variables are exposed to the browser bundle; never place secrets in `VITE_*` variables.
- For a one-command local stack (Postgres 16 + Gravitee + supporting services), use `deploy/docker/docker-compose.yml`, which sets a working `DATABASE_URL` by default.
