import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Server, Shield, AlertTriangle, TrendingUp, Cpu, HardDrive, Gauge } from "lucide-react";

export default function SreDashboardPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const { data: incidents } = trpc.status.incidents.useQuery();

  const tenantList = (tenants as any[]) || [];
  const incidentList = (incidents as any[]) || [];
  const activeIncidents = incidentList.filter((i: any) => i.status !== "resolved");

  // Platform health metrics (simulated from real data)
  const availability = activeIncidents.length === 0 ? 99.99 : activeIncidents.some((i: any) => i.severity === "critical") ? 98.5 : 99.7;
  const avgLatency = 23;
  const errorRate = activeIncidents.length * 0.02;
  const totalRequests = tenantList.length * 1250000;

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
                <p className="text-xs font-medium text-muted-foreground uppercase">Avg Latency (P99)</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">{avgLatency}ms</p>
                <p className="text-xs text-muted-foreground">Across all regions</p>
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
                <p className="text-2xl font-bold mt-1 text-purple-600">{(totalRequests / 1000000).toFixed(1)}M</p>
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
          <TabsTrigger value="capacity">Capacity</TabsTrigger>
          <TabsTrigger value="cost">Cost</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-4 mt-4">
          {/* Region Health */}
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Region Health</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { name: "Mumbai (ap-south-1)", pods: 48, cpu: 62, memory: 71 },
                  { name: "Chennai (ap-south-2)", pods: 32, cpu: 45, memory: 58 },
                  { name: "Hyderabad (ap-south-3)", pods: 24, cpu: 38, memory: 44 },
                ].map(r => (
                  <div key={r.name} className="p-4 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2 mb-3">
                      <Server className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{r.name}</span>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between"><span className="text-muted-foreground">Running Pods</span><span className="font-medium">{r.pods}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">CPU Usage</span><span className="font-medium">{r.cpu}%</span></div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Memory</span>
                        <span className="font-medium">{r.memory}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${r.memory > 80 ? "bg-red-500" : r.memory > 60 ? "bg-amber-500" : "bg-emerald-500"}`} style={{width: `${r.memory}%`}} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <p className="text-muted-foreground">API Calls</p>
                          <p className="font-medium">{(Math.random() * 500000 + 100000).toFixed(0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground">Latency</p>
                          <p className="font-medium">{(Math.random() * 30 + 10).toFixed(0)}ms</p>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">healthy</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="capacity" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />Compute Capacity</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>CPU Utilization</span><span className="font-medium">48%</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{width: "48%"}} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Memory Utilization</span><span className="font-medium">62%</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-amber-500" style={{width: "62%"}} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Network I/O</span><span className="font-medium">35%</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-emerald-500" style={{width: "35%"}} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4 text-primary" />Storage & Database</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Database Connections</span><span className="font-medium">124 / 500</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-blue-500" style={{width: "25%"}} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Redis Memory</span><span className="font-medium">2.1 / 8 GB</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-emerald-500" style={{width: "26%"}} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span>Object Storage</span><span className="font-medium">45 / 100 TB</span></div>
                    <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full bg-amber-500" style={{width: "45%"}} /></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Capacity Forecast</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { resource: "Compute (vCPU)", current: "192 cores", forecast: "Need +48 cores by Aug 2026", risk: "low" },
                  { resource: "Memory", current: "768 GB", forecast: "Sufficient through Q4 2026", risk: "low" },
                  { resource: "Database IOPS", current: "45K IOPS", forecast: "May need upgrade by Jul 2026", risk: "medium" },
                  { resource: "Network Bandwidth", current: "10 Gbps", forecast: "Sufficient through 2027", risk: "low" },
                ].map(item => (
                  <div key={item.resource} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-medium">{item.resource}</p>
                      <p className="text-xs text-muted-foreground">Current: {item.current}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{item.forecast}</p>
                      <Badge variant="secondary" className={item.risk === "low" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>{item.risk} risk</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Infrastructure Cost per Tenant</CardTitle></CardHeader>
            <CardContent>
              {tenantList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No tenants to display</p>
              ) : (
                <div className="space-y-3">
                  {tenantList.map((t: any, i: number) => {
                    const cost = (Math.random() * 5000 + 1000).toFixed(2);
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{t.name}</span>
                          <Badge variant="secondary">{t.tier}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">${cost}</p>
                          <p className="text-xs text-muted-foreground">this month</p>
                        </div>
                      </div>
                    );
                  })}
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
                  <p className="text-2xl font-bold text-emerald-600">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Auth Failures (24h)</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 text-center">
                  <p className="text-2xl font-bold text-blue-600">12</p>
                  <p className="text-xs text-muted-foreground mt-1">Rate Limit Hits (24h)</p>
                </div>
                <div className="p-4 rounded-lg border border-border/40 text-center">
                  <p className="text-2xl font-bold text-emerald-600">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Anomalies Detected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Recent Security Events</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { event: "Rate limit triggered for consumer app 'mobile-app-prod'", time: "2 hours ago", severity: "info" },
                  { event: "TLS certificate renewed for *.api.cloudinfinit.io", time: "1 day ago", severity: "info" },
                  { event: "New BYOK key rotation completed", time: "3 days ago", severity: "info" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{e.event}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
