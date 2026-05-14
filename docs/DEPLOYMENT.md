# Deployment Guide

This guide covers deploying the CloudInfinit API Gateway platform to production environments.

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Node.js | 22+ | Runtime for the application server |
| pnpm | 10+ | Package manager |
| MySQL/TiDB | 8+ | Database (TiDB recommended for horizontal scaling) |
| Gravitee APIM | 4.x | API Gateway engine (optional for local mode) |

---

## Environment Configuration

Create a `.env` file or configure environment variables in your deployment platform:

```bash
# Database (Required)
DATABASE_URL=mysql://user:password@host:3306/cloudinfinit_apigw?ssl=true

# Authentication (Required)
JWT_SECRET=your-secure-random-string-minimum-32-chars
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://id.manus.im

# Owner (Required)
OWNER_OPEN_ID=owner-oauth-identifier
OWNER_NAME=Platform Owner

# Gravitee Integration (Optional - enables live gateway sync)
GRAVITEE_API_URL=https://apim-management.your-domain.com
GRAVITEE_API_TOKEN=your-gravitee-personal-access-token
GRAVITEE_ORG_ID=DEFAULT
GRAVITEE_ENV_ID=DEFAULT

# Application Branding (Optional)
VITE_APP_TITLE=CloudInfinit API Gateway
VITE_APP_LOGO=https://your-cdn.com/logo.png
```

---

## Database Setup

### Initial Migration

Apply the database schema using the generated migration files:

```bash
# Generate migration SQL from schema
pnpm drizzle-kit generate

# Apply migrations to the database
pnpm drizzle-kit migrate
```

The migration creates 29 tables covering all platform entities. Ensure the database user has CREATE TABLE, ALTER, INSERT, UPDATE, SELECT, and DELETE permissions.

### TiDB Configuration

For TiDB deployments, enable SSL and configure connection pooling:

```bash
DATABASE_URL=mysql://user:password@gateway.tidbcloud.com:4000/apigw?ssl={"rejectUnauthorized":true}
```

---

## Build and Deploy

### Production Build

```bash
# Install dependencies
pnpm install --frozen-lockfile

# Build frontend (Vite) and backend (esbuild)
pnpm build

# Start production server
pnpm start
```

The build produces:
- `dist/index.js` — Bundled backend server
- `dist/client/` — Static frontend assets

### Docker Deployment

```dockerfile
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Cloud Run Deployment

The application is designed for Cloud Run with the following specifications:

| Setting | Value |
|---------|-------|
| Memory | 512 MiB (minimum), 1 GiB (recommended) |
| CPU | 1 vCPU |
| Request Timeout | 180 seconds |
| Min Instances | 0 (cold starts acceptable) or 1 (low latency) |
| Max Instances | Scale based on traffic |
| Port | Automatically detected (do not hardcode) |

---

## Gravitee APIM Setup

### Generating a Personal Access Token

1. Log in to the Gravitee Console
2. Navigate to User Settings → Tokens
3. Click "Generate Token"
4. Set an appropriate expiration (or no expiration for service accounts)
5. Copy the token and set it as `GRAVITEE_API_TOKEN`

### Verifying Connectivity

After configuring the Gravitee environment variables, the platform header badge will indicate the connection status:

- **Green "Gravitee Live"** — Successfully connected and syncing
- **Amber "Local Mode"** — Not configured or unreachable, using local database

The platform performs health checks every 30 seconds and automatically switches modes based on reachability.

### Required Gravitee Permissions

The API token needs the following permissions in Gravitee:

| Scope | Permission | Purpose |
|-------|-----------|---------|
| Organization | READ | List organization details |
| Environment | READ, UPDATE | Manage environment configuration |
| API | CRUD | Full API lifecycle management |
| Application | CRUD | DCR and consumer app management |
| Subscription | CRUD | Subscription processing |
| Instance | READ | Gateway node monitoring |
| Analytics | READ | Platform and per-API metrics |

---

## Health Monitoring

### Application Health

The application exposes health information through the Gravitee connection status endpoint:

```
GET /api/trpc/gateway.connectionStatus
```

Response indicates whether the platform is operating in live or local mode.

### Database Health

Monitor the database connection through standard MySQL health checks. The application uses lazy connection initialization and will log warnings if the database is unavailable.

### Gravitee Health

The platform automatically monitors Gravitee health with a 30-second polling interval. Failed health checks trigger automatic fallback to local mode without service interruption.

---

## Backup and Recovery

### Database Backups

Schedule regular backups of the MySQL/TiDB database. Critical tables for recovery:

| Priority | Tables | Reason |
|----------|--------|--------|
| Critical | `tenants`, `users`, `audit_events` | Identity and compliance data |
| High | `apis`, `plans`, `subscriptions`, `consumer_apps` | Core business state |
| Medium | `invoices`, `usage_records`, `billing` | Financial records |
| Low | `notifications`, `incidents` | Operational data (can be regenerated) |

### Disaster Recovery

The hybrid architecture provides natural disaster recovery:

1. If Gravitee fails → Platform continues in local mode
2. If database fails → Restore from backup, Gravitee retains gateway state
3. If both fail → Restore database from backup, reconnect to Gravitee for state sync

---

## Security Hardening

### Production Checklist

- [ ] Enable HTTPS/TLS termination at the load balancer
- [ ] Set `JWT_SECRET` to a cryptographically random 64+ character string
- [ ] Enable database SSL connections
- [ ] Restrict database user permissions to minimum required
- [ ] Configure CORS headers for your domain
- [ ] Set up rate limiting at the infrastructure level
- [ ] Enable audit log exports to SIEM
- [ ] Configure alerting for authentication failures
- [ ] Rotate Gravitee API tokens on a regular schedule
- [ ] Enable BYOK for tenant data encryption
