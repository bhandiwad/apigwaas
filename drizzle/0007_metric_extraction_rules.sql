-- Persist custom metric extraction rules for the metering pipeline
DO $$ BEGIN
  CREATE TYPE "metric_extraction_type" AS ENUM('jsonpath', 'header', 'regex', 'groovy');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "metric_type" AS ENUM('counter', 'gauge', 'histogram', 'summary');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "metric_extraction_rules" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenantId" integer NOT NULL,
  "name" varchar(255) NOT NULL,
  "extractionPath" varchar(512) NOT NULL,
  "extractionType" "metric_extraction_type" DEFAULT 'jsonpath' NOT NULL,
  "metricType" "metric_type" DEFAULT 'counter' NOT NULL,
  "kafkaTopic" varchar(255),
  "enabled" boolean DEFAULT true NOT NULL,
  "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
  "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "metric_extraction_tenant_idx" ON "metric_extraction_rules" USING btree ("tenantId");
