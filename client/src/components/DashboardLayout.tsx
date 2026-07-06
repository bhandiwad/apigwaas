import { useAuth } from "@/_core/hooks/useAuth";
import { SifyLogo } from "@/components/SifyLogo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Globe,
  Shield,
  FileText,
  CreditCard,
  Activity,
  Users,
  Server,
  AlertTriangle,
  Key,
  Bell,
  BarChart3,
  Settings,
  Layers,
  BookOpen,
  Zap,
  Building2,
  Rocket,
  Fingerprint,
  GitBranch,
  Workflow,
  EyeOff,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useTenantContext } from "@/contexts/TenantContext";

type MenuSection = {
  title: string;
  defaultOpen: boolean;
  items: { icon: any; label: string; path: string }[];
};

// Consolidated navigation. API-scoped surfaces (Designer, Policy Chains,
// Lifecycle) now live inside the API detail hub; advanced/secondary pages
// (GitOps, Vault, Dev Portal, Status, Support, SRE, Tenant Lifecycle, Logs,
// Role Assignments) remain reachable by URL but are off the primary sidebar.
const menuSections: MenuSection[] = [
  {
    title: "MAIN",
    defaultOpen: true,
    items: [
      { icon: LayoutDashboard, label: "Overview", path: "/" },
      { icon: Building2, label: "Tenants", path: "/tenants" },
      { icon: Layers, label: "Workspaces", path: "/workspaces" },
    ],
  },
  {
    title: "APIS",
    defaultOpen: true,
    items: [
      { icon: Globe, label: "APIs", path: "/apis" },
      { icon: BookOpen, label: "Plans", path: "/plans" },
      { icon: Zap, label: "Consumer Apps", path: "/consumer-apps" },
      { icon: Key, label: "Subscriptions", path: "/subscriptions" },
    ],
  },
  {
    title: "GATEWAY",
    defaultOpen: true,
    items: [
      { icon: Server, label: "Clusters", path: "/gateway-clusters" },
      { icon: Rocket, label: "Deployments", path: "/deployments" },
      { icon: GitBranch, label: "Environments", path: "/environments" },
    ],
  },
  {
    title: "SECURITY",
    defaultOpen: false,
    items: [
      { icon: Shield, label: "Policies", path: "/policies" },
      { icon: EyeOff, label: "Data Masking", path: "/data-masking" },
      { icon: Fingerprint, label: "Identity Providers", path: "/identity-providers" },
    ],
  },
  {
    title: "OBSERVABILITY",
    defaultOpen: false,
    items: [
      { icon: BarChart3, label: "Analytics", path: "/analytics" },
      { icon: Activity, label: "Metering", path: "/metering" },
      { icon: Bell, label: "Alerts", path: "/alerts" },
      { icon: FileText, label: "Audit Trail", path: "/audit" },
    ],
  },
  {
    title: "PLATFORM",
    defaultOpen: false,
    items: [
      { icon: CreditCard, label: "Billing", path: "/billing" },
      { icon: Key, label: "Compliance", path: "/compliance" },
      { icon: Users, label: "Roles & Access", path: "/rbac" },
    ],
  },
];

const allMenuItems = menuSections.flatMap((s) => s.items);

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <SifyLogo withLabel className="text-2xl mb-1" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Enterprise API management platform. Sign in to access your dashboard.
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-primary text-primary-foreground"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  if (!user.tenantId) {
    return <OnboardingScreen />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

// ─── Onboarding Screen ────────────────────────────────────────────────────────
function OnboardingScreen() {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: "",
    tier: "starter" as "starter" | "business" | "enterprise" | "sovereign",
    region: "mumbai",
    contactEmail: "",
  });

  const createTenant = trpc.tenant.create.useMutation({
    onSuccess: async () => {
      toast.success("Organisation created — welcome aboard!");
      await utils.auth.me.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-primary">Cloud</span>
              <span className="text-foreground">Infinit</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold">Create Your Organisation</h1>
          <p className="text-sm text-muted-foreground">
            Set up your tenant to start managing APIs on sifycloudinfinit API Gateway.
          </p>
        </div>

        <Card className="border border-border/60 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Organisation Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Organisation Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Corp"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plan</Label>
                <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v as typeof form.tier })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                    <SelectItem value="sovereign">Sovereign</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Region</Label>
                <Select value={form.region} onValueChange={v => setForm({ ...form, region: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mumbai">Mumbai</SelectItem>
                    <SelectItem value="delhi">Delhi</SelectItem>
                    <SelectItem value="bangalore">Bangalore</SelectItem>
                    <SelectItem value="chennai">Chennai</SelectItem>
                    <SelectItem value="hyderabad">Hyderabad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={form.contactEmail}
                onChange={e => setForm({ ...form, contactEmail: e.target.value })}
                placeholder="admin@yourcompany.com"
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              disabled={!form.name || createTenant.isPending}
              onClick={() => createTenant.mutate(form)}
            >
              {createTenant.isPending ? "Creating..." : "Create Organisation & Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tenant + Workspace Switcher ──────────────────────────────────────────────
function TenantSwitcher() {
  const { tenantId, setTenantId, workspaceId, setWorkspaceId, tenants, workspaces, isAdmin } = useTenantContext();
  const showTenant = isAdmin && tenants.length > 1;
  const currentTenant = tenants.find(t => t.id === tenantId);
  return (
    <div className="flex items-center gap-2">
      {showTenant ? (
        <Select value={tenantId ? String(tenantId) : ""} onValueChange={v => setTenantId(Number(v))}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Tenant" /></SelectTrigger>
          <SelectContent>
            {tenants.map(t => <SelectItem key={t.id} value={String(t.id)} className="text-xs">{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : currentTenant ? (
        <span className="hidden md:inline text-xs text-muted-foreground max-w-[160px] truncate" title={currentTenant.name}>{currentTenant.name}</span>
      ) : null}
      <Select value={workspaceId ? String(workspaceId) : "all"} onValueChange={v => setWorkspaceId(v === "all" ? null : Number(v))}>
        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="All workspaces" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all" className="text-xs">All workspaces</SelectItem>
          {workspaces.map(w => <SelectItem key={w.id} value={String(w.id)} className="text-xs">{w.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Gravitee Connection Status Badge ─────────────────────────────────────────
function GraviteeStatusBadge() {
  const { data: status } = trpc.gateway.connectionStatus.useQuery(undefined, {
    refetchInterval: 30000, // Check every 30s
    retry: false,
  });

  if (!status) {
    return (
      <Badge variant="outline" className="text-[11px] gap-1.5 font-normal px-2 py-0.5 border-muted-foreground/30">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" />
        Checking...
      </Badge>
    );
  }

  if (status.connected) {
    return (
      <Badge variant="outline" className="text-[11px] gap-1.5 font-normal px-2 py-0.5 border-emerald-500/30 text-emerald-600 bg-emerald-50">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Gravitee Live
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-[11px] gap-1.5 font-normal px-2 py-0.5 border-amber-500/30 text-amber-600 bg-amber-50">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Local Mode
    </Badge>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = allMenuItems.find((item) => item.path === location);

  // Collapsible nav groups, remembered in localStorage.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    let stored: Record<string, boolean> = {};
    try { stored = JSON.parse(window.localStorage.getItem("ci.navSections") || "{}"); } catch { /* ignore */ }
    return Object.fromEntries(menuSections.map(s => [s.title, stored[s.title] ?? s.defaultOpen]));
  });
  const toggleSection = (title: string) => setOpenSections(prev => {
    const next = { ...prev, [title]: !prev[title] };
    window.localStorage.setItem("ci.navSections", JSON.stringify(next));
    return next;
  });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft =
        sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed ? (
                <SifyLogo withLabel />
              ) : (
                <SifyLogo collapsed />
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 overflow-y-auto">
            {menuSections.map((section) => {
              const sectionOpen = isCollapsed || openSections[section.title] || section.items.some(i => i.path === location);
              return (
              <div key={section.title} className="py-1">
                {!isCollapsed && (
                  <button onClick={() => toggleSection(section.title)} className="w-full flex items-center justify-between px-4 py-1.5 hover:bg-sidebar-accent/40 rounded-md">
                    <span className="text-[10px] font-semibold tracking-wider text-sidebar-foreground/40 uppercase">
                      {section.title}
                    </span>
                    <ChevronDown className={`h-3 w-3 text-sidebar-foreground/40 transition-transform ${sectionOpen ? "" : "-rotate-90"}`} />
                  </button>
                )}
                {sectionOpen && (
                <SidebarMenu className="px-2">
                  {section.items.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-9 transition-all font-normal text-[13px] ${
                            isActive
                              ? "bg-primary/10 text-primary font-medium border-l-2 border-primary rounded-l-none"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          }`}
                        >
                          <item.icon
                            className={`h-4 w-4 ${
                              isActive
                                ? "text-primary"
                                : "text-sidebar-foreground/50"
                            }`}
                          />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
                )}
              </div>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border border-primary/20 shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="text-[11px] text-sidebar-foreground/50 truncate mt-1">
                      {user?.email || ""}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${
            isCollapsed ? "hidden" : ""
          }`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {/* Top header bar with page title and Gravitee connection status */}
        <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
          <div className="flex items-center gap-2">
            {isMobile && <SidebarTrigger className="h-9 w-9 rounded-lg" />}
            <span className="font-medium text-sm text-foreground">
              {activeMenuItem?.label ?? "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TenantSwitcher />
            <GraviteeStatusBadge />
            <Bell className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>
        <main className="flex-1 p-6 bg-background">{children}</main>
      </SidebarInset>
    </>
  );
}
