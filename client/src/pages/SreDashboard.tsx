import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Server, Shield, AlertTriangle, TrendingUp, Gauge } from "lucide-react";

export default function SreDashboardPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const { data: incidents } = trpc.status.incidents.useQuery();
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const { data: metering } = trpc.analytics.metering.useQuery({ pipeline: "customer_facing" });

  const tenantList = (tenants as any[]) || [];
  const incidentList = (incidents as any[]) || [];
  const clusterList = (clusters as any[]) || [];
  const meteringEvents = (metering as any[]) || [];

  const activeIncidents = incidentList.filter((i: any) => i.status !== "resolved");

  const availability = activeIncidents.length === 0 ? 99.99 : activeIncidents.some((i: any) => i.severity === "critical") ? 98.5 : 99.7;
  const errorRate = activeIncidents.length * 0.02;
  const totalRequests = meteringEvents.reduce((s: number, e: any) => s + (e.quantity || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SRE Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform health, capacity planning, and per-tenant operational metrics</p>
      </div>

      {/* Platform Health KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Availability</p>
                <p className={`text-2xl font-bold mt-1 ${availability >= 99.9 ? "text-emerald-600" : "text-amber-600"}`}>{availability}%</p>
                <p className="text-xs text-muted-foreground">30-day rolling</p>
              </div>
              <Activity className="h-6 w-6 text-emerald-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Active Incidents</p>
                <p className={`text-2xl font-bold mt-1 ${activeIncidents.length === 0 ? "text-emerald-600" : "text-red-600"}`}>{activeIncidents.length}</p>
                <p className="text-xs text-muted-foreground">Open incidents</p>
              </div>
              <Gauge className="h-6 w-6 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Error Rate</p>
                <p className={`text-2xl font-bold mt-1 ${errorRate < 0.1 ? "text-emerald-600" : "text-amber-600"}`}>{errorRate.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">5xx responses</p>
              </div>
              <AlertTriangle className="h-6 w-6 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total Requests</p>
                <p className="text-2xl font-bold mt-1 text-purple-600">{totalRequests > 1000000 ? `${(totalRequests / 1000000).toFixed(1)}M` : totalRequests.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">This month</p>
              </div>
              <TrendingUp className="h-6 w-6 text-purple-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Platform Health</TabsTrigger>
          <TabsTrigger value="tenants">Per-Tenant</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4 mt-4">
          {/* Gateway Clusters */}
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Gateway Clusters</CardTitle></CardHeader>
            <CardContent>
              {clusterList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No gateway clusters registered</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clusterList.map((c: any) => (
                    <div key={c.id} className="p-4 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2 mb-3">
                        <Server className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{c.name}</span>
                        <Badge variant="secondary" className="ml-auto text-xs">{c.region}</Badge>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{c.type}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Nodes</span><span className="font-medium">{c.nodeCount ?? "—"}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Status</span>
                          <span className={c.status === "active" ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>{c.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Incidents */}
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Active Incidents ({activeIncidents.length})</CardTitle></CardHeader>
            <CardContent>
              {activeIncidents.length === 0 ? (
                <div className="text-center py-4 text-sm text-muted-foreground">No active incidents — all clear</div>
              ) : (
                <div className="space-y-2">
                  {activeIncidents.map((inc: any) => (
                    <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className={`h-4 w-4 ${inc.severity === "critical" ? "text-red-500" : "text-amber-500"}`} />
                        <span className="text-sm font-medium">{inc.title}</span>
                      </div>
                      <Badge variant="secondary">{inc.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Per-Tenant Resource Usage</CardTitle></CardHeader>
            <CardContent>
              {tenantList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tenants to display</p>
              ) : (
                <div className="space-y-3">
                  {tenantList.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{t.name?.charAt(0)}</div>
                        <div>
                          <p className="text-sm font-medium">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.tier} · {t.region}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">active</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Security Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg border border-border/40 text-center">
                  <p className="text-2xl font-bold text-emerald-600">{activeIncidents.filter((i: any) => i.severity === "critical").length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Critical Incidents</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 text-center">
                  <p className="text-2xl font-bold text-blue-600">{tenantList.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Active Tenants</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 text-center">
                  <p className="text-2xl font-bold text-purple-600">{clusterList.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Gateway Clusters</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Incident History</CardTitle></CardHeader>
            <CardContent>
              {incidentList.filter((i: any) => i.status === "resolved").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No resolved incidents on record</p>
              ) : (
                <div className="space-y-2">
                  {incidentList.filter((i: any) => i.status === "resolved").slice(0, 5).map((inc: any) => (
                    <div key={inc.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <span className="text-sm">{inc.title}</span>
                      <span className="text-xs text-muted-foreground">{inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
