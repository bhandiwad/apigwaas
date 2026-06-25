ALTER TABLE "apis" ADD CONSTRAINT "apis_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_tenant_idx" ON "alert_rules" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "deployments_api_idx" ON "api_deployments" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "deployments_tenant_idx" ON "api_deployments" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "environments_tenant_idx" ON "api_environments" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "apis_tenant_idx" ON "apis" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "apis_workspace_idx" ON "apis" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "apis_status_idx" ON "apis" USING btree ("status");--> statement-breakpoint
CREATE INDEX "audit_tenant_created_idx" ON "audit_events" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_events" USING btree ("actorId");--> statement-breakpoint
CREATE INDEX "byok_tenant_idx" ON "byok_keys" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "consumer_apps_tenant_idx" ON "consumer_apps" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "dcr_tenant_idx" ON "dcr_clients" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "portals_tenant_idx" ON "developer_portals" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "entrypoints_api_idx" ON "event_entrypoints" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "entrypoints_tenant_idx" ON "event_entrypoints" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "idp_tenant_idx" ON "identity_providers" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "invoices_tenant_idx" ON "invoices" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "masking_tenant_idx" ON "masking_rules" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "metering_tenant_created_idx" ON "metering_events" USING btree ("tenantId","createdAt");--> statement-breakpoint
CREATE INDEX "metering_api_idx" ON "metering_events" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "plans_api_idx" ON "plans" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "plans_tenant_idx" ON "plans" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "policies_tenant_idx" ON "policies" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "policies_api_idx" ON "policies" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "chains_api_idx" ON "policy_chains" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "chains_tenant_idx" ON "policy_chains" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "role_assignments_user_idx" ON "role_assignments" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "role_assignments_tenant_idx" ON "role_assignments" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "roles_tenant_idx" ON "roles" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "subscriptions_tenant_idx" ON "subscriptions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "subscriptions_consumer_app_idx" ON "subscriptions" USING btree ("consumerAppId");--> statement-breakpoint
CREATE INDEX "subscriptions_api_idx" ON "subscriptions" USING btree ("apiId");--> statement-breakpoint
CREATE INDEX "tickets_tenant_idx" ON "support_tickets" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "tickets_user_idx" ON "support_tickets" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "usage_tenant_date_idx" ON "usage_records" USING btree ("tenantId","date");--> statement-breakpoint
CREATE INDEX "workspaces_tenant_idx" ON "workspaces" USING btree ("tenantId");