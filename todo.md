# CloudInfinit API Gateway - Project TODO

## Database & Schema
- [x] Tenants table (organization, tier, status, GSTIN, PAN, region)
- [x] Workspaces table (per-tenant, lifecycle states)
- [x] APIs table (name, version, status, spec, workspace)
- [x] Plans table (name, rate limits, quota, pricing)
- [x] Subscriptions table (consumer app → plan mapping)
- [x] Consumer apps table (client credentials, owner)
- [x] Policies table (masking, rate limit, geoip, vault)
- [x] Audit events table (immutable append-only log)
- [x] Invoices table (GST-compliant, line items, status)
- [x] Usage records table (API calls, data transfer, daily aggregates)
- [x] Support tickets table (severity, SLA, status)
- [x] Incidents table (status page events)
- [x] Compliance artifacts table (SOC2, ISO, RBI docs)
- [x] Roles and permissions tables (custom RBAC)
- [x] BYOK keys table (vault references, rotation status)
- [x] Notifications table (alerts, maintenance windows)

## Backend API Layer
- [x] Tenant management router (CRUD, tier changes, provisioning)
- [x] Workspace management router (create, archive, delete)
- [x] API management router (create, publish, deprecate, import OpenAPI)
- [x] Plans and subscriptions router
- [x] Consumer apps router (registration, credentials)
- [x] Policy configuration router (masking rules, rate limits, geoip, vault)
- [x] Audit trail router (query, filter, export with SHA-256 signature)
- [x] Billing router (usage aggregation, invoice generation, payments, dunning)
- [x] Metering router (dual pipeline: customer-facing Lago + Sify-side)
- [x] RBAC router (roles, permissions, assignments)
- [x] Support router (tickets, SLA tracking)
- [x] Status/incidents router (service health, maintenance windows)
- [x] Compliance router (artifacts, DPDP rights, BYOK management)
- [x] Analytics router (real-time metrics, top APIs, latency trends)
- [ ] SRE dashboard router (platform health, per-tenant drilldown, capacity)
- [ ] Tenant lifecycle router (provisioning, suspension, offboarding, data export)

## Frontend - Layout & Branding
- [x] Sify/infinitAIZEN branded theme (gold/amber accent, clean white content)
- [x] DashboardLayout with collapsible sidebar navigation
- [x] Section-grouped navigation (MAIN, API MANAGEMENT, OPERATIONS, PLATFORM)
- [x] Responsive design for all viewports

## Frontend - Customer Portal Pages
- [x] Overview/Home dashboard with KPI cards and navigation cards
- [ ] Self-service signup flow (corporate email, KYC/KYB, MFA, tier selection)
- [x] Workspace management page
- [x] Tier and add-on management (in Tenants page)
- [x] User and role management page (RBAC page)

## Frontend - API Management Pages
- [x] API catalog/list page
- [x] Create API page with protocol selection
- [ ] API detail page (versions, deployments, policies)
- [x] Plans management page
- [ ] Subscriptions management page
- [x] Consumer applications page
- [x] Policy configuration page (masking, rate limit, geoip, vault)

## Frontend - Billing Pages
- [x] Usage dashboard (calls, data transfer, cost attribution by workspace)
- [x] Invoices list with GST-compliant display
- [ ] Payment methods management
- [x] Service credits display
- [x] Dunning/payment failure alerts

## Frontend - Audit Trail Pages
- [x] Audit log viewer with filters (actor, action, resource, time)
- [x] Export dialog (CSV/JSONL with SHA-256 signature)
- [x] SIEM stream status view

## Frontend - RBAC Pages
- [x] Roles list and custom role editor
- [x] Permission matrix display (platform, workspace, API, application scopes)
- [ ] Role assignments page

## Frontend - SRE Dashboard Pages
- [ ] Platform health overview (aggregate availability, latency, error rate)
- [ ] Per-tenant drilldown page
- [ ] Capacity dashboard (load vs headroom, forecast)
- [ ] Cost dashboard (infra cost per tenant)
- [ ] Security dashboard (auth failures, anomalies)

## Frontend - Tenant Lifecycle Pages
- [x] Tenant list with status indicators
- [x] Tenant creation with KYC/KYB fields (GSTIN, PAN)
- [ ] Tenant provisioning wizard
- [ ] Suspension and offboarding workflows
- [ ] Data export bundle download page

## Frontend - Compliance & Security Pages
- [x] DPDP Data Principal Rights portal
- [x] BYOK key management interface
- [x] Compliance artifacts download page (SOC2, ISO 27001, RBI CSCRF)
- [x] Certification roadmap tracker

## Frontend - Support & Status Pages
- [x] Support ticket creation and history
- [x] SLA tracking dashboard
- [x] Status page feed (per region, per service)
- [x] Incident history timeline
- [x] Maintenance window notifications

## Frontend - Analytics & Metering Pages
- [x] Real-time API call volume charts
- [x] Top APIs and top consumers views
- [x] Latency P99 trend display
- [x] Quota utilization gauges
- [x] Metering pipeline status (customer-facing + Sify-side)

## Testing
- [x] Backend unit tests for core routers (11 tests passing)
- [x] Auth and RBAC permission tests
