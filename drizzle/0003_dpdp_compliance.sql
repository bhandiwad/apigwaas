CREATE TYPE "public"."consent_status" AS ENUM('granted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."dpdp_request_action" AS ENUM('access', 'correct', 'erase', 'restrict', 'portability', 'object', 'nomination');--> statement-breakpoint
CREATE TYPE "public"."dpdp_request_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."legal_basis" AS ENUM('consent', 'contract', 'legal_obligation', 'legitimate_interest', 'vital_interest', 'public_task');--> statement-breakpoint
CREATE TABLE "consent_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"apiId" integer,
	"dataPrincipalId" varchar(512) NOT NULL,
	"purpose" varchar(512) NOT NULL,
	"status" "consent_status" DEFAULT 'granted' NOT NULL,
	"grantedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"revokedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"consentText" text,
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_processing_activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(512) NOT NULL,
	"purpose" text NOT NULL,
	"dataCategories" jsonb DEFAULT '[]'::jsonb,
	"dataSources" jsonb DEFAULT '[]'::jsonb,
	"recipients" jsonb DEFAULT '[]'::jsonb,
	"thirdPartyTransfers" jsonb DEFAULT '[]'::jsonb,
	"retentionPeriodDays" integer,
	"legalBasis" "legal_basis" NOT NULL,
	"dpdpActSection" varchar(64),
	"apiIds" jsonb DEFAULT '[]'::jsonb,
	"riskLevel" varchar(32) DEFAULT 'low',
	"dpiaConducted" boolean DEFAULT false,
	"dpiaDate" timestamp with time zone,
	"active" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpdp_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer,
	"action" "dpdp_request_action" NOT NULL,
	"subject" varchar(512) NOT NULL,
	"notes" text,
	"status" "dpdp_request_status" DEFAULT 'pending' NOT NULL,
	"dueDate" timestamp with time zone NOT NULL,
	"completedAt" timestamp with time zone,
	"response" text,
	"assignedTo" varchar(255),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "consent_tenant_idx" ON "consent_records" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "consent_principal_idx" ON "consent_records" USING btree ("tenantId","dataPrincipalId");--> statement-breakpoint
CREATE INDEX "consent_api_idx" ON "consent_records" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "processing_tenant_idx" ON "data_processing_activities" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "dpdp_requests_tenant_idx" ON "dpdp_requests" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "dpdp_requests_status_idx" ON "dpdp_requests" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "dpdp_requests_due_idx" ON "dpdp_requests" USING btree ("dueDate");