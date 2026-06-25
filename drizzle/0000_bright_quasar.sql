CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('error_rate', 'latency_p99', 'quota_usage', 'cert_expiry', 'subscription_expiry', 'custom');--> statement-breakpoint
CREATE TYPE "public"."api_protocol" AS ENUM('rest', 'graphql', 'grpc', 'websocket', 'kafka', 'mqtt');--> statement-breakpoint
CREATE TYPE "public"."api_status" AS ENUM('draft', 'published', 'deprecated', 'retired');--> statement-breakpoint
CREATE TYPE "public"."app_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."artifact_status" AS ENUM('current', 'expired', 'draft');--> statement-breakpoint
CREATE TYPE "public"."artifact_type" AS ENUM('soc2', 'iso27001', 'rbi_cscrf', 'dpdp', 'pentest', 'sub_processor', 'sla_report');--> statement-breakpoint
CREATE TYPE "public"."audit_action_type" AS ENUM('create', 'read', 'update', 'delete', 'login', 'logout', 'approve', 'reject', 'deploy', 'export');--> statement-breakpoint
CREATE TYPE "public"."byok_provider" AS ENUM('vault', 'aws_kms', 'azure_keyvault');--> statement-breakpoint
CREATE TYPE "public"."byok_status" AS ENUM('active', 'rotating', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."chain_phase" AS ENUM('request', 'response', 'connect', 'subscribe', 'publish');--> statement-breakpoint
CREATE TYPE "public"."cluster_status" AS ENUM('healthy', 'degraded', 'offline', 'provisioning');--> statement-breakpoint
CREATE TYPE "public"."cluster_tier" AS ENUM('shared', 'dedicated', 'sovereign');--> statement-breakpoint
CREATE TYPE "public"."dcr_status" AS ENUM('active', 'suspended', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."deployment_status" AS ENUM('pending', 'deploying', 'deployed', 'failed', 'undeploying', 'undeployed');--> statement-breakpoint
CREATE TYPE "public"."deployment_strategy" AS ENUM('rolling', 'blue_green', 'canary');--> statement-breakpoint
CREATE TYPE "public"."entrypoint_auth" AS ENUM('none', 'sasl_plain', 'sasl_scram', 'mtls', 'api_key');--> statement-breakpoint
CREATE TYPE "public"."entrypoint_status" AS ENUM('active', 'inactive', 'error');--> statement-breakpoint
CREATE TYPE "public"."entrypoint_type" AS ENUM('kafka', 'mqtt', 'rabbitmq', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."idp_status" AS ENUM('active', 'inactive', 'testing');--> statement-breakpoint
CREATE TYPE "public"."idp_type" AS ENUM('oidc', 'saml', 'ldap');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('minor', 'major', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('investigating', 'identified', 'monitoring', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'issued', 'paid', 'overdue', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."masking_action" AS ENUM('full_replace', 'partial', 'hash_sha256', 'redact');--> statement-breakpoint
CREATE TYPE "public"."masking_category" AS ENUM('pan_card', 'aadhaar', 'credit_card', 'email', 'phone', 'iban', 'ifsc', 'custom');--> statement-breakpoint
CREATE TYPE "public"."metering_pipeline" AS ENUM('customer_facing', 'sify_internal');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('incident', 'maintenance', 'usage_threshold', 'invoice', 'security', 'system');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('active', 'closed', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."policy_phase" AS ENUM('request', 'response', 'both');--> statement-breakpoint
CREATE TYPE "public"."policy_type" AS ENUM('masking', 'rate_limit', 'geoip', 'vault_secret', 'cors', 'ip_filtering', 'jwt_validation', 'oauth2');--> statement-breakpoint
CREATE TYPE "public"."portal_status" AS ENUM('active', 'draft', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."quota_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "public"."rate_limit_period" AS ENUM('second', 'minute', 'hour', 'day');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('platform', 'workspace', 'api', 'application');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'approved', 'rejected', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('synced', 'out_of_sync', 'syncing', 'error');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('active', 'provisioning', 'suspended', 'offboarding', 'terminated');--> statement-breakpoint
CREATE TYPE "public"."tenant_tier" AS ENUM('starter', 'business', 'enterprise', 'sovereign');--> statement-breakpoint
CREATE TYPE "public"."ticket_severity" AS ENUM('S1', 'S2', 'S3', 'S4');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"name" varchar(255) NOT NULL,
	"type" "alert_type" NOT NULL,
	"condition" jsonb,
	"threshold" numeric(10, 2),
	"duration" varchar(32),
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"channels" jsonb,
	"enabled" boolean DEFAULT true,
	"lastTriggeredAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_deployments" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiId" integer NOT NULL,
	"clusterId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"version" varchar(32) NOT NULL,
	"status" "deployment_status" DEFAULT 'pending' NOT NULL,
	"strategy" "deployment_strategy" DEFAULT 'rolling' NOT NULL,
	"syncStatus" "sync_status" DEFAULT 'out_of_sync' NOT NULL,
	"deployedAt" timestamp with time zone,
	"lastSyncAt" timestamp with time zone,
	"configuration" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_environments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"order" integer DEFAULT 0,
	"clusterId" integer,
	"gitBranch" varchar(128),
	"gitFolder" varchar(512),
	"argoAppName" varchar(255),
	"autoPromote" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apis" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspaceId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"version" varchar(32) DEFAULT '1.0.0',
	"status" "api_status" DEFAULT 'draft' NOT NULL,
	"protocol" "api_protocol" DEFAULT 'rest' NOT NULL,
	"backendUrl" text,
	"contextPath" varchar(512),
	"openApiSpec" jsonb,
	"description" text,
	"tags" jsonb,
	"graviteeApiId" varchar(128),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"actorId" integer,
	"actorName" varchar(255),
	"actorEmail" varchar(320),
	"action" varchar(128) NOT NULL,
	"actionType" "audit_action_type" NOT NULL,
	"targetType" varchar(64),
	"targetId" varchar(128),
	"targetName" varchar(255),
	"beforeState" jsonb,
	"afterState" jsonb,
	"sourceIp" varchar(45),
	"userAgent" text,
	"correlationId" varchar(128),
	"metadata" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "byok_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" "byok_provider" NOT NULL,
	"keyIdentifier" varchar(512) NOT NULL,
	"status" "byok_status" DEFAULT 'active' NOT NULL,
	"lastRotatedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"name" varchar(255) NOT NULL,
	"type" "artifact_type" NOT NULL,
	"version" varchar(32),
	"fileUrl" text,
	"validFrom" timestamp with time zone,
	"validUntil" timestamp with time zone,
	"status" "artifact_status" DEFAULT 'current' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consumer_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"workspaceId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"clientId" varchar(128) NOT NULL,
	"clientSecretHash" varchar(512),
	"status" "app_status" DEFAULT 'active' NOT NULL,
	"ownerEmail" varchar(320),
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consumer_apps_clientId_unique" UNIQUE("clientId")
);
--> statement-breakpoint
CREATE TABLE "dcr_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"clientId" varchar(128) NOT NULL,
	"clientName" varchar(255) NOT NULL,
	"clientSecretHash" varchar(512),
	"redirectUris" jsonb,
	"grantTypes" jsonb,
	"responseTypes" jsonb,
	"tokenEndpointAuthMethod" varchar(64) DEFAULT 'client_secret_basic',
	"scope" text,
	"autoSubscribePlan" integer,
	"status" "dcr_status" DEFAULT 'active' NOT NULL,
	"registrationAccessToken" varchar(512),
	"lastRotatedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dcr_clients_clientId_unique" UNIQUE("clientId")
);
--> statement-breakpoint
CREATE TABLE "developer_portals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"customDomain" varchar(512),
	"theme" jsonb,
	"logoUrl" text,
	"description" text,
	"status" "portal_status" DEFAULT 'draft' NOT NULL,
	"enableSignup" boolean DEFAULT true,
	"enableAutoApprove" boolean DEFAULT false,
	"publishedApis" jsonb,
	"customCss" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_entrypoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"type" "entrypoint_type" NOT NULL,
	"configuration" jsonb,
	"topicPattern" varchar(512),
	"brokerUrl" text,
	"authMethod" "entrypoint_auth" DEFAULT 'none',
	"status" "entrypoint_status" DEFAULT 'inactive' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_clusters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"region" varchar(64) NOT NULL,
	"tier" "cluster_tier" DEFAULT 'shared' NOT NULL,
	"status" "cluster_status" DEFAULT 'provisioning' NOT NULL,
	"nodeCount" integer DEFAULT 0,
	"maxNodes" integer DEFAULT 10,
	"cpuUsagePercent" integer DEFAULT 0,
	"memoryUsagePercent" integer DEFAULT 0,
	"requestsPerSecond" integer DEFAULT 0,
	"shardingTags" jsonb,
	"graviteeVersion" varchar(32),
	"lastSyncAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "idp_type" NOT NULL,
	"issuerUrl" text,
	"clientId" varchar(255),
	"clientSecretRef" varchar(255),
	"discoveryUrl" text,
	"samlMetadataUrl" text,
	"groupClaimMapping" jsonb,
	"roleClaimMapping" jsonb,
	"jitProvisioning" boolean DEFAULT true,
	"scimEnabled" boolean DEFAULT false,
	"scimEndpoint" text,
	"status" "idp_status" DEFAULT 'inactive' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(512) NOT NULL,
	"description" text,
	"severity" "incident_severity" DEFAULT 'minor' NOT NULL,
	"status" "incident_status" DEFAULT 'investigating' NOT NULL,
	"affectedServices" jsonb,
	"affectedRegions" jsonb,
	"startedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"invoiceNumber" varchar(64) NOT NULL,
	"periodStart" timestamp with time zone NOT NULL,
	"periodEnd" timestamp with time zone NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"cgst" numeric(12, 2) DEFAULT '0',
	"sgst" numeric(12, 2) DEFAULT '0',
	"igst" numeric(12, 2) DEFAULT '0',
	"total" numeric(12, 2) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"dueDate" timestamp with time zone,
	"paidAt" timestamp with time zone,
	"lineItems" jsonb,
	"paymentMethod" varchar(64),
	"serviceCredits" numeric(12, 2) DEFAULT '0',
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber")
);
--> statement-breakpoint
CREATE TABLE "masking_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"apiId" integer,
	"name" varchar(255) NOT NULL,
	"jsonPath" varchar(512) NOT NULL,
	"action" "masking_action" NOT NULL,
	"replacement" varchar(255),
	"showLastN" integer,
	"category" "masking_category" DEFAULT 'custom' NOT NULL,
	"phase" "policy_phase" DEFAULT 'both' NOT NULL,
	"enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metering_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"apiId" integer,
	"consumerAppId" integer,
	"subscriptionId" integer,
	"planId" integer,
	"endpoint" varchar(512),
	"method" varchar(10),
	"statusCode" integer,
	"requestBytes" integer DEFAULT 0,
	"responseBytes" integer DEFAULT 0,
	"latencyMs" integer DEFAULT 0,
	"pipeline" "metering_pipeline" DEFAULT 'customer_facing' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"userId" integer,
	"type" "notification_type" NOT NULL,
	"title" varchar(512) NOT NULL,
	"message" text,
	"read" boolean DEFAULT false,
	"actionUrl" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"rateLimit" integer DEFAULT 100,
	"rateLimitPeriod" "rate_limit_period" DEFAULT 'minute',
	"quotaLimit" bigint DEFAULT 10000,
	"quotaPeriod" "quota_period" DEFAULT 'month',
	"pricePerCall" numeric(10, 6),
	"monthlyFee" numeric(10, 2),
	"status" "plan_status" DEFAULT 'active' NOT NULL,
	"autoApprove" boolean DEFAULT true,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policies" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiId" integer,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "policy_type" NOT NULL,
	"phase" "policy_phase" DEFAULT 'both' NOT NULL,
	"configuration" jsonb,
	"enabled" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "policy_chains" (
	"id" serial PRIMARY KEY NOT NULL,
	"apiId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"phase" "chain_phase" NOT NULL,
	"policyId" integer NOT NULL,
	"order" integer NOT NULL,
	"condition" text,
	"enabled" boolean DEFAULT true,
	"configuration" jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"roleId" integer NOT NULL,
	"tenantId" integer,
	"workspaceId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer,
	"name" varchar(128) NOT NULL,
	"description" text,
	"scope" "role_scope" DEFAULT 'workspace' NOT NULL,
	"permissions" jsonb,
	"isSystem" boolean DEFAULT false,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"consumerAppId" integer NOT NULL,
	"planId" integer NOT NULL,
	"apiId" integer NOT NULL,
	"tenantId" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"approvedAt" timestamp with time zone,
	"expiresAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"userId" integer NOT NULL,
	"subject" varchar(512) NOT NULL,
	"description" text,
	"severity" "ticket_severity" DEFAULT 'S3' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"category" varchar(128),
	"assignee" varchar(255),
	"slaResponseDue" timestamp with time zone,
	"slaResolutionDue" timestamp with time zone,
	"resolvedAt" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"tier" "tenant_tier" DEFAULT 'starter' NOT NULL,
	"status" "tenant_status" DEFAULT 'provisioning' NOT NULL,
	"gstin" varchar(20),
	"pan" varchar(12),
	"region" varchar(64) DEFAULT 'mumbai',
	"contactEmail" varchar(320),
	"contactPhone" varchar(20),
	"address" text,
	"kybVerified" boolean DEFAULT false,
	"mfaEnabled" boolean DEFAULT false,
	"maxWorkspaces" integer DEFAULT 1,
	"maxApis" integer DEFAULT 5,
	"maxConsumerApps" integer DEFAULT 50,
	"includedCallsPerMonth" bigint DEFAULT 1000000,
	"dataTransferLimitGb" integer DEFAULT 10,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"workspaceId" integer,
	"apiId" integer,
	"date" timestamp with time zone NOT NULL,
	"apiCalls" bigint DEFAULT 0,
	"dataInBytes" bigint DEFAULT 0,
	"dataOutBytes" bigint DEFAULT 0,
	"errorCount" integer DEFAULT 0,
	"avgLatencyMs" integer DEFAULT 0,
	"p99LatencyMs" integer DEFAULT 0,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" text,
	"passwordHash" varchar(255),
	"loginMethod" varchar(64) DEFAULT 'email',
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"tenantId" integer,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(128) NOT NULL,
	"status" "workspace_status" DEFAULT 'active' NOT NULL,
	"description" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);
