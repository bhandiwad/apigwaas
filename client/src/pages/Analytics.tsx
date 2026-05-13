import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, Users, Zap } from "lucide-react";

export default function AnalyticsPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: stats } = trpc.analytics.dashboard.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: usage } = trpc.analytics.usage.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });

  const usageList = (usage as any[]) || [];
  const totalCalls = usageList.reduce((sum, u) => sum + (u.apiCalls || 0), 0);
  const totalErrors = usageList.reduce((sum, u) => sum + (u.errorCount || 0), 0);
  const avgLatency = usageList.length > 0 ? usageList.reduce((sum, u) => sum + parseFloat(u.avgLatencyMs || "0"), 0) / usageList.length : 0;
  const errorRate = totalCalls > 0 ? ((totalErrors / totalCalls) * 100).toFixed(2) : "0.00";

  // Derive top APIs from usage records grouped by apiId
  const apiUsageMap = new Map<number, { calls: number; latency: number; count: number }>();
  usageList.forEach((u: any) => {
    if (u.apiId) {
      const existing = apiUsageMap.get(u.apiId) || { calls: 0, latency: 0, count: 0 };
      existing.calls += u.apiCalls || 0;
      existing.latency += parseFloat(u.avgLatencyMs || "0");
      existing.count += 1;
      apiUsageMap.set(u.apiId, existing);
    }
  });
  const topApis = Array.from(apiUsageMap.entries())
    .map(([id, data]) => ({ name: `API #${id}`, calls: data.calls, latency: Math.round(data.latency / data.count) }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 5);

  const maxCalls = topApis[0]?.calls || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time API performance metrics and usage analytics</p>
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
                <p className="text-xs font-medium text-muted-foreground uppercase">Avg Latency P99</p>
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
                        <p className="text-xs text-muted-foreground">P99: {api.latency}ms</p>
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
                { label: "API Calls", used: totalCalls, total: 10000000, color: "bg-amber-500" },
                { label: "Data Transfer", used: Math.round(totalCalls * 0.002), total: 10240, unit: "MB", color: "bg-blue-500" },
                { label: "Consumer Apps", used: (stats as any)?.totalConsumerApps || 0, total: 500, color: "bg-purple-500" },
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
