-- Add error tracking and operation log to api_deployments
ALTER TABLE api_deployments
  ADD COLUMN IF NOT EXISTS "errorMessage" text,
  ADD COLUMN IF NOT EXISTS "operationLog" jsonb DEFAULT '[]'::jsonb;
