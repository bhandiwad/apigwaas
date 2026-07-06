import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, Zap, Activity, Users, Plus, KeyRound, Rocket, Upload, FilePlus2, Pencil, Trash2, CheckCircle2, History } from "lucide-react";
import { useLocation } from "wouter";

function actionMeta(e: any): { icon: any; text: string } {
  const name = e.targetName || (e.targetType ? `${e.targetType} #${e.targetId}` : "item");
  const a: string = e.action || "";
  if (a.endsWith(".published")) return { icon: Rocket, text: `Published ${name}` };
  if (a.endsWith(".deployed")) return { icon: Rocket, text: `Deployed ${name}` };
  if (a.endsWith(".deprecated")) return { icon: History, text: `Deprecated ${name}` };
  if (a.endsWith(".retired") || e.actionType === "delete") return { icon: Trash2, text: `Removed ${name}` };
  if (a.includes("subscription") && a.includes("approve")) return { icon: CheckCircle2, text: `Approved a subscription` };
  if (a.includes("subscription") && a.includes("creat")) return { icon: KeyRound, text: `New subscription` };
  if (a.includes("imported")) return { icon: Upload, text: `Imported ${name}` };
  if (e.actionType === "create") return { icon: FilePlus2, text: `Created ${name}` };
  if (e.actionType === "update") return { icon: Pencil, text: `Updated ${name}` };
  return { icon: Activity, text: `${a || "Activity"} · ${name}` };
}

function ago(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Home() {
  const [, navigate] = useLocation();
  const { data: stats, isLoading } = trpc.analytics.dashboard.useQuery({});
  const { data: status } = trpc.gateway.connectionStatus.useQuery();
  const { data: audit } = trpc.audit.list.useQuery({ limit: 8 });
  const events = ((audit as any)?.events ?? []) as any[];
  const live = (status as any)?.connected;

  const kpiCards = [
    { label: "APIs", value: stats?.totalApis ?? 0, icon: Globe, color: "text-amber-600", path: "/apis" },
    { label: "Consumer Apps", value: stats?.totalConsumerApps ?? 0, icon: Zap, color: "text-emerald-600", path: "/consumer-apps" },
    { label: "Subscriptions", value: stats?.totalSubscriptions ?? 0, icon: Activity, color: "text-blue-600", path: "/subscriptions" },
    { label: "Workspaces", value: stats?.totalWorkspaces ?? 0, icon: Users, color: "text-purple-600", path: "/workspaces" },
  ];

  const quickActions = [
    { label: "Create API", icon: Plus, path: "/apis/new" },
    { label: "Import OpenAPI", icon: Upload, path: "/apis" },
    { label: "Subscribe", icon: KeyRound, path: "/subscribe" },
    { label: "Deploy", icon: Rocket, path: "/deployments/new" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">CloudInfinit API Gateway — platform at a glance</p>
        </div>
        <Badge variant="outline" className={`gap-1.5 ${live ? "border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-950/30"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-500" : "bg-amber-500"}`} />
          {live ? "Gravitee Live" : "Local Mode"}
        </Badge>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {quickActions.map(a => (
          <Button key={a.label} variant="outline" onClick={() => navigate(a.path)}><a.icon className="h-4 w-4 mr-2" />{a.label}</Button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(kpi => (
          <Card key={kpi.label} role="button" tabIndex={0}
            className="border border-border/60 shadow-sm hover:shadow-md hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none transition-all cursor-pointer"
            onClick={() => navigate(kpi.path)}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(kpi.path); } }}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-3xl font-bold mt-1 ${kpi.color}`}>{isLoading ? "—" : kpi.value.toLocaleString()}</p>
              </div>
              <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-40`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => navigate("/audit")}>View all</Button>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity yet. Create an API to get started.</p>
          ) : (
            <div className="space-y-1">
              {events.map((e: any) => {
                const m = actionMeta(e);
                return (
                  <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><m.icon className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{m.text}</p>
                      <p className="text-xs text-muted-foreground">{e.actorName || "System"}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{e.createdAt ? ago(e.createdAt) : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
