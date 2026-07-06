import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TenantProvider } from "./contexts/TenantContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import TenantsPage from "./pages/Tenants";
import WorkspacesPage from "./pages/Workspaces";
import ApisPage from "./pages/Apis";
import ApiCreateWizard from "./pages/ApiCreateWizard";
import ApiDetailPage from "./pages/ApiDetail";
import PlansPage from "./pages/Plans";
import ConsumerAppsPage from "./pages/ConsumerApps";
import SubscriptionsPage from "./pages/Subscriptions";
import PoliciesPage from "./pages/Policies";
import AnalyticsPage from "./pages/Analytics";
import MeteringPage from "./pages/Metering";
import BillingPage from "./pages/Billing";
import AuditPage from "./pages/Audit";
import LogsPage from "./pages/Logs";
import RbacPage from "./pages/Rbac";
import CompliancePage from "./pages/Compliance";
import StatusPage from "./pages/Status";
import SupportPage from "./pages/Support";
import SreDashboardPage from "./pages/SreDashboard";
import TenantLifecyclePage from "./pages/TenantLifecycle";
import PaymentMethodsPage from "./pages/PaymentMethods";
import SignupPage from "./pages/Signup";
import RoleAssignmentsPage from "./pages/RoleAssignments";
// Gravitee API Management pages
import GatewayClustersPage from "./pages/GatewayClusters";
import DeploymentsPage from "./pages/Deployments";
import DevPortalPage from "./pages/DevPortal";
import DataMaskingPage from "./pages/DataMasking";
import DcrClientsPage from "./pages/DcrClients";
import IdentityProvidersPage from "./pages/IdentityProviders";
import EnvironmentsPage from "./pages/Environments";
import EventEntrypointsPage from "./pages/EventEntrypoints";
import AlertsPage from "./pages/Alerts";
import GeoIpFilteringPage from "./pages/GeoIpFiltering";
import VaultSecretsPage from "./pages/VaultSecrets";
import ApiLifecyclePage from "./pages/ApiLifecycle";
import KafkaReporterPage from "./pages/KafkaReporter";
import LoginPage from "./pages/Login";
import ResetPasswordPage from "./pages/ResetPassword";
import AcceptInvitePage from "./pages/AcceptInvite";
import TenantDetailPage from "./pages/TenantDetail";
import GitOpsPipelinePage from "./pages/GitOpsPipeline";
import DeveloperPortalView from "./pages/DeveloperPortalView";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/accept-invite" component={AcceptInvitePage} />
      <Route path="/portal" component={DeveloperPortalView} />
      <Route>
        <TenantProvider>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Home} />
        <Route path="/tenants" component={TenantsPage} />
        <Route path="/tenants/:id" component={TenantDetailPage} />
        <Route path="/tenant-lifecycle" component={TenantLifecyclePage} />
        <Route path="/workspaces" component={WorkspacesPage} />
        <Route path="/apis" component={ApisPage} />
        <Route path="/apis/new" component={ApiCreateWizard} />
        <Route path="/apis/:id" component={ApiDetailPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/consumer-apps" component={ConsumerAppsPage} />
        <Route path="/subscriptions" component={SubscriptionsPage} />
        <Route path="/policies" component={PoliciesPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/metering" component={MeteringPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/logs" component={LogsPage} />
        <Route path="/rbac" component={RbacPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/status" component={StatusPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/role-assignments" component={RoleAssignmentsPage} />
        <Route path="/payment-methods" component={PaymentMethodsPage} />
        <Route path="/sre" component={SreDashboardPage} />
        {/* Gravitee API Management */}
        <Route path="/gateway-clusters" component={GatewayClustersPage} />
        <Route path="/deployments" component={DeploymentsPage} />
        <Route path="/dev-portal" component={DevPortalPage} />
        <Route path="/data-masking" component={DataMaskingPage} />
        <Route path="/dcr-clients" component={DcrClientsPage} />
        <Route path="/identity-providers" component={IdentityProvidersPage} />
        <Route path="/environments" component={EnvironmentsPage} />
        <Route path="/event-entrypoints" component={EventEntrypointsPage} />
        <Route path="/alerts" component={AlertsPage} />
        <Route path="/geoip-filtering" component={GeoIpFilteringPage} />
        <Route path="/vault-secrets" component={VaultSecretsPage} />
        <Route path="/api-lifecycle" component={ApiLifecyclePage} />
        <Route path="/gitops-pipeline" component={GitOpsPipelinePage} />
        <Route path="/kafka-reporter" component={KafkaReporterPage} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
        </TenantProvider>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
