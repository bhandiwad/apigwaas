-- ─── Tenant-level role enum ──────────────────────────────────────────────────
CREATE TYPE tenant_role AS ENUM ('owner', 'admin', 'developer', 'viewer');

-- ─── Add tenantRole to users ─────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "tenantRole" tenant_role;

-- ─── Add self-registration settings to tenants ───────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS "allowSelfRegistration" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "selfRegDefaultRole" varchar(32) NOT NULL DEFAULT 'developer',
  ADD COLUMN IF NOT EXISTS "allowedEmailDomains" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ─── Invite tokens ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_tokens (
  id              serial PRIMARY KEY,
  "tenantId"      integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email           varchar(320) NOT NULL,
  "tenantRole"    tenant_role NOT NULL DEFAULT 'developer',
  token           varchar(64)  NOT NULL UNIQUE,
  "expiresAt"     timestamp with time zone NOT NULL,
  "invitedByUserId" integer REFERENCES users(id) ON DELETE SET NULL,
  "usedAt"        timestamp with time zone,
  "usedByUserId"  integer REFERENCES users(id) ON DELETE SET NULL,
  "createdAt"     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_tokens_tenant_idx ON invite_tokens("tenantId");
CREATE INDEX IF NOT EXISTS invite_tokens_token_idx  ON invite_tokens(token);
