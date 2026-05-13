import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Layers, Zap, CreditCard, Activity, Shield, BarChart3, ArrowRight, Server, Users } from "lucide-react";
import { useLocation } from "wouter";

export default function Home() {
  const { data: stats, isLoading } = trpc.analytics.dashboard.useQuery({ tenantId: undefined });
  const [, setLocation] = useLocation();

  const kpiCards = [
    { label: "Total APIs", value: stats?.totalApis ?? 0, sub: "Across all workspaces", icon: Globe, color: "text-amber-600" },
    { label: "Consumer Apps", value: stats?.totalConsumerApps ?? 0, sub: "Registered applications", icon: Zap, color: "text-emerald-600" },
    { label: "Subscriptions", value: stats?.totalSubscriptions ?? 0, sub: "Active subscriptions", icon: Activity, color: "text-blue-600" },
    { label: "Tenants", value: stats?.totalTenants ?? 0, sub: "Organizations onboarded", icon: Users, color: "text-purple-600" },
  ];

  const navCards = [
    { title: "API Management", desc: "Create, publish, and manage APIs across workspaces", icon: Globe, path: "/apis", color: "border-l-amber-500", bullets: ["OpenAPI Import", "Version Control", "Policy Attachment"] },
    { title: "Analytics & Metering", desc: "Real-time usage metrics and cost attribution", icon: BarChart3, path: "/analytics", color: "border-l-emerald-500", bullets: ["Call Volume", "Latency P99", "Top Consumers"] },
    { title: "Billing & Invoicing", desc: "GST-compliant invoicing and payment tracking", icon: CreditCard, path: "/billing", color: "border-l-blue-500", bullets: ["Usage Dashboard", "Invoice Generation", "Service Credits"] },
    { title: "Compliance & Security", desc: "SOC 2, ISO 27001, RBI CSCRF artifacts and BYOK", icon: Shield, path: "/compliance", color: "border-l-purple-500", bullets: ["DPDP Rights", "BYOK Keys", "Audit Exports"] },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="text-muted-foreground mt-1">CloudInfinit API Gateway — Enterprise platform management dashboard</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="border border-border/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                  <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>
                    {isLoading ? "—" : kpi.value.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-40`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform Info */}
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold text-foreground">Multi-Tenant API Gateway Platform</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
            Manage the complete lifecycle of APIs across multiple tenants and workspaces. Track cost efficiency, resource utilization, and ensure compliance with Indian regulatory requirements including GST, DPDP, and RBI CSCRF.
          </p>
          <div className="flex items-center gap-6 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Platform Status:</span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Operational
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Tiers:</span>
              <span className="font-medium text-foreground">Starter · Business · Enterprise · Sovereign</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {navCards.map((card) => (
          <Card
            key={card.title}
            className={`border border-border/60 border-l-4 ${card.color} shadow-sm hover:shadow-md transition-all cursor-pointer group`}
            onClick={() => setLocation(card.path)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{card.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.desc}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {card.bullets.map((b) => (
                  <span key={b} className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">• {b}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
