CREATE TABLE `alert_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int,
	`name` varchar(255) NOT NULL,
	`type` enum('error_rate','latency_p99','quota_usage','cert_expiry','subscription_expiry','custom') NOT NULL,
	`condition` json,
	`threshold` decimal(10,2),
	`duration` varchar(32),
	`severity` enum('info','warning','critical') NOT NULL DEFAULT 'warning',
	`channels` json,
	`enabled` boolean DEFAULT true,
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alert_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiId` int NOT NULL,
	`clusterId` int NOT NULL,
	`tenantId` int NOT NULL,
	`version` varchar(32) NOT NULL,
	`status` enum('pending','deploying','deployed','failed','undeploying','undeployed') NOT NULL DEFAULT 'pending',
	`strategy` enum('rolling','blue_green','canary') NOT NULL DEFAULT 'rolling',
	`syncStatus` enum('synced','out_of_sync','syncing','error') NOT NULL DEFAULT 'out_of_sync',
	`deployedAt` timestamp,
	`lastSyncAt` timestamp,
	`configuration` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_environments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(128) NOT NULL,
	`slug` varchar(64) NOT NULL,
	`order` int DEFAULT 0,
	`clusterId` int,
	`gitBranch` varchar(128),
	`gitFolder` varchar(512),
	`argoAppName` varchar(255),
	`autoPromote` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_environments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dcr_clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`clientId` varchar(128) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientSecretHash` varchar(512),
	`redirectUris` json,
	`grantTypes` json,
	`responseTypes` json,
	`tokenEndpointAuthMethod` varchar(64) DEFAULT 'client_secret_basic',
	`scope` text,
	`autoSubscribePlan` int,
	`status` enum('active','suspended','revoked') NOT NULL DEFAULT 'active',
	`registrationAccessToken` varchar(512),
	`lastRotatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dcr_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `dcr_clients_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `developer_portals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`customDomain` varchar(512),
	`theme` json,
	`logoUrl` text,
	`description` text,
	`status` enum('active','draft','disabled') NOT NULL DEFAULT 'draft',
	`enableSignup` boolean DEFAULT true,
	`enableAutoApprove` boolean DEFAULT false,
	`publishedApis` json,
	`customCss` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `developer_portals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_entrypoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiId` int NOT NULL,
	`tenantId` int NOT NULL,
	`type` enum('kafka','mqtt','rabbitmq','webhook') NOT NULL,
	`configuration` json,
	`topicPattern` varchar(512),
	`brokerUrl` text,
	`authMethod` enum('none','sasl_plain','sasl_scram','mtls','api_key') DEFAULT 'none',
	`status` enum('active','inactive','error') NOT NULL DEFAULT 'inactive',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `event_entrypoints_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gateway_clusters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`region` varchar(64) NOT NULL,
	`tier` enum('shared','dedicated','sovereign') NOT NULL DEFAULT 'shared',
	`status` enum('healthy','degraded','offline','provisioning') NOT NULL DEFAULT 'provisioning',
	`nodeCount` int DEFAULT 0,
	`maxNodes` int DEFAULT 10,
	`cpuUsagePercent` int DEFAULT 0,
	`memoryUsagePercent` int DEFAULT 0,
	`requestsPerSecond` int DEFAULT 0,
	`shardingTags` json,
	`graviteeVersion` varchar(32),
	`lastSyncAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gateway_clusters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `identity_providers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('oidc','saml','ldap') NOT NULL,
	`issuerUrl` text,
	`clientId` varchar(255),
	`clientSecretRef` varchar(255),
	`discoveryUrl` text,
	`samlMetadataUrl` text,
	`groupClaimMapping` json,
	`roleClaimMapping` json,
	`jitProvisioning` boolean DEFAULT true,
	`scimEnabled` boolean DEFAULT false,
	`scimEndpoint` text,
	`status` enum('active','inactive','testing') NOT NULL DEFAULT 'inactive',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `identity_providers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `masking_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenantId` int NOT NULL,
	`apiId` int,
	`name` varchar(255) NOT NULL,
	`jsonPath` varchar(512) NOT NULL,
	`action` enum('full_replace','partial','hash_sha256','redact') NOT NULL,
	`replacement` varchar(255),
	`showLastN` int,
	`category` enum('pan_card','aadhaar','credit_card','email','phone','iban','ifsc','custom') NOT NULL DEFAULT 'custom',
	`phase` enum('request','response','both') NOT NULL DEFAULT 'both',
	`enabled` boolean DEFAULT true,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `masking_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `policy_chains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiId` int NOT NULL,
	`tenantId` int NOT NULL,
	`phase` enum('request','response','connect','subscribe','publish') NOT NULL,
	`policyId` int NOT NULL,
	`order` int NOT NULL,
	`condition` text,
	`enabled` boolean DEFAULT true,
	`configuration` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `policy_chains_id` PRIMARY KEY(`id`)
);
