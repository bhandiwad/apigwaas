import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import TenantsPage from "./pages/Tenants";
import WorkspacesPage from "./pages/Workspaces";
import ApisPage from "./pages/Apis";
import ApiDetailPage from "./pages/ApiDetail";
import PlansPage from "./pages/Plans";
import ConsumerAppsPage from "./pages/ConsumerApps";
import SubscriptionsPage from "./pages/Subscriptions";
import PoliciesPage from "./pages/Policies";
import AnalyticsPage from "./pages/Analytics";
import MeteringPage from "./pages/Metering";
import BillingPage from "./pages/Billing";
import AuditPage from "./pages/Audit";
import RbacPage from "./pages/Rbac";
import CompliancePage from "./pages/Compliance";
import StatusPage from "./pages/Status";
import SupportPage from "./pages/Support";
import SreDashboardPage from "./pages/SreDashboard";
import TenantLifecyclePage from "./pages/TenantLifecycle";
import PaymentMethodsPage from "./pages/PaymentMethods";
import SignupPage from "./pages/Signup";
import RoleAssignmentsPage from "./pages/RoleAssignments";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/tenants" component={TenantsPage} />
        <Route path="/tenant-lifecycle" component={TenantLifecyclePage} />
        <Route path="/workspaces" component={WorkspacesPage} />
        <Route path="/apis" component={ApisPage} />
        <Route path="/apis/:id" component={ApiDetailPage} />
        <Route path="/plans" component={PlansPage} />
        <Route path="/consumer-apps" component={ConsumerAppsPage} />
        <Route path="/subscriptions" component={SubscriptionsPage} />
        <Route path="/policies" component={PoliciesPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/metering" component={MeteringPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/rbac" component={RbacPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/status" component={StatusPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/signup" component={SignupPage} />
        <Route path="/role-assignments" component={RoleAssignmentsPage} />
        <Route path="/payment-methods" component={PaymentMethodsPage} />
        <Route path="/sre" component={SreDashboardPage} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
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
