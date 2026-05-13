CREATE TABLE `apis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` varchar(32) DEFAULT '1.0.0',
	`status` enum('draft','published','deprecated','retired') NOT NULL DEFAULT 'draft',
	`protocol` enum('rest','graphql','grpc','websocket','kafka','mqtt') NOT NULL DEFAULT 'rest',
	`backendUrl` text,
	`contextPath` varchar(512),
	`openApiSpec` json,
	`description` text,
	`tags` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`actorId` int,
	`actorName` varchar(255),
	`actorEmail` varchar(320),
	`action` varchar(128) NOT NULL,
	`actionType` enum('create','read','update','delete','login','logout','approve','reject','deploy','export') NOT NULL,
	`targetType` varchar(64),
	`targetId` varchar(128),
	`targetName` varchar(255),
	`beforeState` json,
	`afterState` json,
	`sourceIp` varchar(45),
	`userAgent` text,
	`correlationId` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `byok_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`provider` enum('vault','aws_kms','azure_keyvault') NOT NULL,
	`keyIdentifier` varchar(512) NOT NULL,
	`status` enum('active','rotating','revoked') NOT NULL DEFAULT 'active',
	`lastRotatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `byok_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `compliance_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`name` varchar(255) NOT NULL,
	`type` enum('soc2','iso27001','rbi_cscrf','dpdp','pentest','sub_processor','sla_report') NOT NULL,
	`version` varchar(32),
	`fileUrl` text,
	`validFrom` timestamp,
	`validUntil` timestamp,
	`status` enum('current','expired','draft') NOT NULL DEFAULT 'current',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compliance_artifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `consumer_apps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`workspaceId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`clientId` varchar(128) NOT NULL,
	`clientSecretHash` varchar(512),
	`status` enum('active','suspended','revoked') NOT NULL DEFAULT 'active',
	`ownerEmail` varchar(320),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `consumer_apps_id` PRIMARY KEY(`id`),
	CONSTRAINT `consumer_apps_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(512) NOT NULL,
	`description` text,
	`severity` enum('minor','major','critical') NOT NULL DEFAULT 'minor',
	`status` enum('investigating','identified','monitoring','resolved') NOT NULL DEFAULT 'investigating',
	`affectedServices` json,
	`affectedRegions` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`invoiceNumber` varchar(64) NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`subtotal` decimal(12,2) NOT NULL,
	`cgst` decimal(12,2) DEFAULT '0',
	`sgst` decimal(12,2) DEFAULT '0',
	`igst` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`status` enum('draft','issued','paid','overdue','cancelled','disputed') NOT NULL DEFAULT 'draft',
	`dueDate` timestamp,
	`paidAt` timestamp,
	`lineItems` json,
	`paymentMethod` varchar(64),
	`serviceCredits` decimal(12,2) DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `metering_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`apiId` int,
	`consumerAppId` int,
	`subscriptionId` int,
	`planId` int,
	`endpoint` varchar(512),
	`method` varchar(10),
	`statusCode` int,
	`requestBytes` int DEFAULT 0,
	`responseBytes` int DEFAULT 0,
	`latencyMs` int DEFAULT 0,
	`pipeline` enum('customer_facing','sify_internal') NOT NULL DEFAULT 'customer_facing',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `metering_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`userId` int,
	`type` enum('incident','maintenance','usage_threshold','invoice','security','system') NOT NULL,
	`title` varchar(512) NOT NULL,
	`message` text,
	`read` boolean DEFAULT false,
	`actionUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiId` int NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`rateLimit` int DEFAULT 100,
	`rateLimitPeriod` enum('second','minute','hour','day') DEFAULT 'minute',
	`quotaLimit` bigint DEFAULT 10000,
	`quotaPeriod` enum('day','week','month') DEFAULT 'month',
	`pricePerCall` decimal(10,6),
	`monthlyFee` decimal(10,2),
	`status` enum('active','closed','deprecated') NOT NULL DEFAULT 'active',
	`autoApprove` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiId` int,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('masking','rate_limit','geoip','vault_secret','cors','ip_filtering','jwt_validation','oauth2') NOT NULL,
	`phase` enum('request','response','both') NOT NULL DEFAULT 'both',
	`configuration` json,
	`enabled` boolean DEFAULT true,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`tenantId` int,
	`workspaceId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`name` varchar(128) NOT NULL,
	`description` text,
	`scope` enum('platform','workspace','api','application') NOT NULL DEFAULT 'workspace',
	`permissions` json,
	`isSystem` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`consumerAppId` int NOT NULL,
	`planId` int NOT NULL,
	`apiId` int NOT NULL,
	`tenantId` int NOT NULL,
	`status` enum('pending','approved','rejected','revoked','expired') NOT NULL DEFAULT 'pending',
	`approvedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`userId` int NOT NULL,
	`subject` varchar(512) NOT NULL,
	`description` text,
	`severity` enum('S1','S2','S3','S4') NOT NULL DEFAULT 'S3',
	`status` enum('open','in_progress','waiting_customer','resolved','closed') NOT NULL DEFAULT 'open',
	`category` varchar(128),
	`assignee` varchar(255),
	`slaResponseDue` timestamp,
	`slaResolutionDue` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`tier` enum('starter','business','enterprise','sovereign') NOT NULL DEFAULT 'starter',
	`status` enum('active','provisioning','suspended','offboarding','terminated') NOT NULL DEFAULT 'provisioning',
	`gstin` varchar(20),
	`pan` varchar(12),
	`region` varchar(64) DEFAULT 'mumbai',
	`contactEmail` varchar(320),
	`contactPhone` varchar(20),
	`address` text,
	`kybVerified` boolean DEFAULT false,
	`mfaEnabled` boolean DEFAULT false,
	`maxWorkspaces` int DEFAULT 1,
	`maxApis` int DEFAULT 5,
	`maxConsumerApps` int DEFAULT 50,
	`includedCallsPerMonth` bigint DEFAULT 1000000,
	`dataTransferLimitGb` int DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`workspaceId` int,
	`apiId` int,
	`date` timestamp NOT NULL,
	`apiCalls` bigint DEFAULT 0,
	`dataInBytes` bigint DEFAULT 0,
	`dataOutBytes` bigint DEFAULT 0,
	`errorCount` int DEFAULT 0,
	`avgLatencyMs` int DEFAULT 0,
	`p99LatencyMs` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usage_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`status` enum('active','archived','deleted') NOT NULL DEFAULT 'active',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `tenantId` int;