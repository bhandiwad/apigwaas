import { relations } from "drizzle-orm";
import {
  users,
  tenants,
  workspaces,
  apis,
  plans,
  consumerApps,
  subscriptions,
  policies,
  policyChains,
  roles,
  roleAssignments,
  notifications,
  supportTickets,
  gatewayClusters,
  apiDeployments,
  eventEntrypoints,
  meteringEvents,
  usageRecords,
  invoices,
  byokKeys,
  developerPortals,
  maskingRules,
  dcrClients,
  identityProviders,
  apiEnvironments,
  alertRules,
  auditEvents,
} from "./schema";

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  workspaces: many(workspaces),
  roles: many(roles),
  invoices: many(invoices),
  byokKeys: many(byokKeys),
  developerPortals: many(developerPortals),
  dcrClients: many(dcrClients),
  identityProviders: many(identityProviders),
  apiEnvironments: many(apiEnvironments),
  alertRules: many(alertRules),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  roleAssignments: many(roleAssignments),
  notifications: many(notifications),
  supportTickets: many(supportTickets),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  tenant: one(tenants, { fields: [workspaces.tenantId], references: [tenants.id] }),
  apis: many(apis),
}));

export const apisRelations = relations(apis, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [apis.workspaceId], references: [workspaces.id] }),
  plans: many(plans),
  policies: many(policies),
  subscriptions: many(subscriptions),
  deployments: many(apiDeployments),
  eventEntrypoints: many(eventEntrypoints),
  policyChains: many(policyChains),
  meteringEvents: many(meteringEvents),
  usageRecords: many(usageRecords),
  maskingRules: many(maskingRules),
}));

export const plansRelations = relations(plans, ({ one, many }) => ({
  api: one(apis, { fields: [plans.apiId], references: [apis.id] }),
  subscriptions: many(subscriptions),
}));

export const consumerAppsRelations = relations(consumerApps, ({ many }) => ({
  subscriptions: many(subscriptions),
  meteringEvents: many(meteringEvents),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  api: one(apis, { fields: [subscriptions.apiId], references: [apis.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  consumerApp: one(consumerApps, { fields: [subscriptions.consumerAppId], references: [consumerApps.id] }),
}));

export const policiesRelations = relations(policies, ({ one, many }) => ({
  api: one(apis, { fields: [policies.apiId], references: [apis.id] }),
  policyChains: many(policyChains),
}));

export const policyChainsRelations = relations(policyChains, ({ one }) => ({
  api: one(apis, { fields: [policyChains.apiId], references: [apis.id] }),
  policy: one(policies, { fields: [policyChains.policyId], references: [policies.id] }),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  roleAssignments: many(roleAssignments),
}));

export const roleAssignmentsRelations = relations(roleAssignments, ({ one }) => ({
  user: one(users, { fields: [roleAssignments.userId], references: [users.id] }),
  role: one(roles, { fields: [roleAssignments.roleId], references: [roles.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [notifications.tenantId], references: [tenants.id] }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, { fields: [supportTickets.userId], references: [users.id] }),
  tenant: one(tenants, { fields: [supportTickets.tenantId], references: [tenants.id] }),
}));

export const apiDeploymentsRelations = relations(apiDeployments, ({ one }) => ({
  api: one(apis, { fields: [apiDeployments.apiId], references: [apis.id] }),
  cluster: one(gatewayClusters, { fields: [apiDeployments.clusterId], references: [gatewayClusters.id] }),
}));

export const gatewayClustersRelations = relations(gatewayClusters, ({ many }) => ({
  deployments: many(apiDeployments),
  environments: many(apiEnvironments),
}));

export const eventEntrypointsRelations = relations(eventEntrypoints, ({ one }) => ({
  api: one(apis, { fields: [eventEntrypoints.apiId], references: [apis.id] }),
}));

export const meteringEventsRelations = relations(meteringEvents, ({ one }) => ({
  api: one(apis, { fields: [meteringEvents.apiId], references: [apis.id] }),
  consumerApp: one(consumerApps, { fields: [meteringEvents.consumerAppId], references: [consumerApps.id] }),
  subscription: one(subscriptions, { fields: [meteringEvents.subscriptionId], references: [subscriptions.id] }),
  plan: one(plans, { fields: [meteringEvents.planId], references: [plans.id] }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  api: one(apis, { fields: [usageRecords.apiId], references: [apis.id] }),
  workspace: one(workspaces, { fields: [usageRecords.workspaceId], references: [workspaces.id] }),
  tenant: one(tenants, { fields: [usageRecords.tenantId], references: [tenants.id] }),
}));

export const maskingRulesRelations = relations(maskingRules, ({ one }) => ({
  api: one(apis, { fields: [maskingRules.apiId], references: [apis.id] }),
  tenant: one(tenants, { fields: [maskingRules.tenantId], references: [tenants.id] }),
}));

export const byokKeysRelations = relations(byokKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [byokKeys.tenantId], references: [tenants.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
}));

export const developerPortalsRelations = relations(developerPortals, ({ one }) => ({
  tenant: one(tenants, { fields: [developerPortals.tenantId], references: [tenants.id] }),
}));

export const dcrClientsRelations = relations(dcrClients, ({ one }) => ({
  tenant: one(tenants, { fields: [dcrClients.tenantId], references: [tenants.id] }),
}));

export const identityProvidersRelations = relations(identityProviders, ({ one }) => ({
  tenant: one(tenants, { fields: [identityProviders.tenantId], references: [tenants.id] }),
}));

export const apiEnvironmentsRelations = relations(apiEnvironments, ({ one }) => ({
  tenant: one(tenants, { fields: [apiEnvironments.tenantId], references: [tenants.id] }),
  cluster: one(gatewayClusters, { fields: [apiEnvironments.clusterId], references: [gatewayClusters.id] }),
}));

export const alertRulesRelations = relations(alertRules, ({ one }) => ({
  tenant: one(tenants, { fields: [alertRules.tenantId], references: [tenants.id] }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  tenant: one(tenants, { fields: [auditEvents.tenantId], references: [tenants.id] }),
  actor: one(users, { fields: [auditEvents.actorId], references: [users.id] }),
}));
