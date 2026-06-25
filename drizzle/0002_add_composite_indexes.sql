CREATE TABLE "kafka_reporter_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenantId" integer NOT NULL,
	"brokers" text DEFAULT 'localhost:9092' NOT NULL,
	"enabled" boolean DEFAULT false,
	"reporters" jsonb DEFAULT '[]'::jsonb,
	"topicMappings" jsonb DEFAULT '[]'::jsonb,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kafka_reporter_configs_tenantId_unique" UNIQUE("tenantId")
);
--> statement-breakpoint
ALTER TABLE "consumer_apps" ADD COLUMN "graviteeAppId" varchar(128);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "graviteeApiId" varchar(128);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "graviteeSubId" varchar(128);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "apiKey" varchar(256);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resetToken" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "resetTokenExpiresAt" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "apis_tenant_status_idx" ON "apis" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "apis_workspace_status_idx" ON "apis" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE INDEX "consumer_apps_tenant_status_idx" ON "consumer_apps" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "metering_tenant_api_created_idx" ON "metering_events" USING btree ("tenantId","apiId","createdAt");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_status_idx" ON "subscriptions" USING btree ("tenantId","status");--> statement-breakpoint
CREATE INDEX "subscriptions_api_status_idx" ON "subscriptions" USING btree ("apiId","status");