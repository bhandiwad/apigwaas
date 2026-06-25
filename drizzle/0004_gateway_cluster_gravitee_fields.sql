-- Add Gravitee environment linkage fields to gateway_clusters
-- Each cluster maps to a specific Gravitee environment + org + management URL
ALTER TABLE gateway_clusters
  ADD COLUMN IF NOT EXISTS description varchar(512),
  ADD COLUMN IF NOT EXISTS "graviteeEnvId" varchar(64) DEFAULT 'DEFAULT',
  ADD COLUMN IF NOT EXISTS "graviteeOrgId" varchar(64) DEFAULT 'DEFAULT',
  ADD COLUMN IF NOT EXISTS "managementUrl" varchar(512);
