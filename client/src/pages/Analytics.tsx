import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BarChart3, TrendingUp, Users, Zap, Play } from "lucide-react";

export default function AnalyticsPage() {
  const { data: me } = trpc.auth.me.useQuery();
  const isAdmin = (me as any)?.role === "admin";

  // Platform admins see all usage if they have no personal tenant; otherwise scope to their tenant.
  // We pass no tenantId for platform admins so the server uses the first registered tenant with data.
  // Tenant members automatically scope to their own tenantId via ctx on the server.
  const { data: stats, refetch: refetchStats } = trpc.analytics.dashboard.useQuery({}, { refetchInterval: 30_000 });
  const { data: usage, refetch: refetchUsage } = trpc.analytics.usage.useQuery({}, { refetchInterval: 30_000 });
  const { data: tenants } = trpc.tenant.list.useQuery(undefined, { enabled: isAdmin });
  const tenant = isAdmin ? (tenants as any[])?.[0] : (me as any);

  const usageList = (usage as any[]) || [];
  const totalCalls = usageList.reduce((sum, u) => sum + (u.apiCalls || 0), 0);
  const totalErrors = usageList.reduce((sum, u) => sum + (u.errorCount || 0), 0);
  const avgLatency = usageList.length > 0 ? usageList.reduce((sum, u) => sum + (u.avgLatencyMs || 0), 0) / usageList.length : 0;
  const errorRate = totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) : "0.00";

  // Derive top APIs from usage records grouped by apiId
  const apiUsageMap = new Map<number, { name: string; calls: number; latency: number; count: number }>();
  usageList.forEach((u: any) => {
    if (u.apiId) {
      const existing = apiUsageMap.get(u.apiId) || { name: u.apiName ?? `API #${u.apiId}`, calls: 0, latency: 0, count: 0 };
      existing.calls += u.apiCalls || 0;
      existing.latency += u.avgLatencyMs || 0;
      existing.count += 1;
      apiUsageMap.set(u.apiId, existing);
    }
  });
  const topApis = Array.from(apiUsageMap.values())
    .map(data => ({ name: data.name, calls: data.calls, latency: Math.round(data.latency / data.count) }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5);

  const maxCalls = topApis[0]?.calls || 1;

  // Daily buckets for the requests-over-time chart (last 14 days).
  const dayMap = new Map<string, { calls: number; errors: number }>();
  usageList.forEach((u: any) => {
    if (!u.date) return;
    const day = new Date(u.date).toISOString().slice(0, 10);
    const e = dayMap.get(day) || { calls: 0, errors: 0 };
    e.calls += u.apiCalls || 0;
    e.errors += u.errorCount || 0;
    dayMap.set(day, e);
  });
  const series = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-14)
    .map(([day, v]) => ({ day, ...v }));
  const maxDay = Math.max(1, ...series.map(s => s.calls));

  const simulateTraffic = trpc.analytics.simulateTraffic.useMutation({
    onSuccess: (data) => {
      toast.success(`Simulated ${data.inserted} API calls — metrics updating…`);
      setTimeout(() => { refetchUsage(); refetchStats(); }, 800);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time API performance metrics and usage analytics</p>
        </div>
        <Button variant="outline" size="sm" disabled={simulateTraffic.isPending}
          onClick={() => simulateTraffic.mutate({ count: 100 })}>
          <Play className="w-3.5 h-3.5 mr-1.5" />
          {simulateTraffic.isPending ? "Simulating…" : "Simulate Traffic"}
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Total API Calls</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{totalCalls > 1000000 ? `${(totalCalls / 1000000).toFixed(2)}M` : totalCalls.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Across all APIs</p>
              </div>
              <BarChart3 className="h-8 w-8 text-amber-600/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Avg Latency</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{avgLatency.toFixed(1)}ms</p>
                <p className="text-xs text-muted-foreground mt-1">Across all endpoints</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Error Rate</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{errorRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">{totalErrors.toLocaleString()} total errors</p>
              </div>
              <Zap className="h-8 w-8 text-emerald-600/40" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase">Active Consumers</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{(stats as any)?.totalConsumerApps || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">Registered applications</p>
              </div>
              <Users className="h-8 w-8 text-purple-600/40" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Requests over time */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Requests over time</CardTitle></CardHeader>
        <CardContent>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No traffic recorded yet. Use Simulate Traffic or send requests through the gateway to populate this chart.</p>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-44" role="img" aria-label="Daily API requests over the last 14 days">
                {series.map((s) => {
                  const pct = Math.max(2, (s.calls / maxDay) * 100);
                  return (
                    <div key={s.day} className="flex-1 flex flex-col justify-end h-full group relative"
                      title={`${s.day} — ${s.calls.toLocaleString()} calls, ${s.errors.toLocaleString()} errors`}>
                      <div className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-colors" style={{ height: `${pct}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                <span>{series[0]?.day.slice(5)}</span>
                <span>Peak {maxDay.toLocaleString()} calls/day</span>
                <span>{series[series.length - 1]?.day.slice(5)}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top APIs */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Top APIs by Volume</CardTitle></CardHeader>
          <CardContent>
            {topApis.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No API traffic recorded yet. Data will appear once APIs receive requests.</p>
            ) : (
              <div className="space-y-3">
                {topApis.map((api, i) => (
                  <div key={api.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{api.name}</p>
                        <p className="text-xs text-muted-foreground">avg {api.latency}ms</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{api.calls > 1000000 ? `${(api.calls / 1000000).toFixed(2)}M` : api.calls.toLocaleString()}</p>
                      <div className="w-20 h-1.5 bg-muted rounded-full mt-1">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(api.calls / maxCalls) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quota Utilization */}
        <Card className="border border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Quota Utilization</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-5">
              {[
                { label: "API Calls", used: totalCalls, total: tenant?.includedCallsPerMonth ?? 10000000, color: "bg-amber-500" },
                { label: "Data Transfer", used: Math.round(totalCalls * 0.002), total: (tenant?.dataTransferLimitGb ?? 100) * 1024, unit: "MB", color: "bg-blue-500" },
                { label: "Consumer Apps", used: (stats as any)?.totalConsumerApps || 0, total: tenant?.maxConsumerApps ?? 500, color: "bg-purple-500" },
              ].map((q) => {
                const pct = Math.min((q.used / q.total) * 100, 100);
                return (
                  <div key={q.label}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{q.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {q.unit ? `${q.used.toLocaleString()} ${q.unit} / ${q.total.toLocaleString()} ${q.unit}` : `${q.used.toLocaleString()} / ${q.total.toLocaleString()}`}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full">
                      <div className={`h-full ${q.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{pct.toFixed(1)}% utilized</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
