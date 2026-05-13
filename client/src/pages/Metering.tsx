import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Database, ArrowRight } from "lucide-react";

export default function MeteringPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: metering } = trpc.analytics.metering.useQuery({ tenantId: defaultTenantId, pipeline: "customer_facing" }, { enabled: !!defaultTenantId });
  const { data: sifyMetering } = trpc.analytics.metering.useQuery({ tenantId: defaultTenantId, pipeline: "sify_internal" }, { enabled: !!defaultTenantId });

  const lagoEvents = (metering as any[]) || [];
  const sifyEvents = (sifyMetering as any[]) || [];

  const lagoTotal = lagoEvents.reduce((sum, e) => sum + (e.quantity || 0), 0);
  const sifyTotal = sifyEvents.reduce((sum, e) => sum + (e.quantity || 0), 0);

  const pipelines = [
    { name: "Customer Billing (Lago)", status: lagoEvents.length > 0 ? "healthy" : "idle", events: lagoTotal, color: lagoEvents.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600" },
    { name: "Sify Internal Billing", status: sifyEvents.length > 0 ? "healthy" : "idle", events: sifyTotal, color: sifyEvents.length > 0 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600" },
  ];

  // Aggregate meter types from metering events
  const meterMap = new Map<string, number>();
  [...lagoEvents, ...sifyEvents].forEach((e: any) => {
    const key = e.metricName || "api_calls";
    meterMap.set(key, (meterMap.get(key) || 0) + (e.quantity || 0));
  });

  const meterTypes = [
    { name: "API Calls", unit: "requests", current: meterMap.get("api_calls") || 0 },
    { name: "Data Transfer (Egress)", unit: "GB", current: ((meterMap.get("data_egress") || 0) / 1024).toFixed(1) },
    { name: "Data Transfer (Ingress)", unit: "GB", current: ((meterMap.get("data_ingress") || 0) / 1024).toFixed(1) },
    { name: "Compute Time", unit: "vCPU-seconds", current: meterMap.get("compute_time") || 0 },
    { name: "Storage", unit: "GB-hours", current: meterMap.get("storage") || 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Metering</h1>
        <p className="text-muted-foreground text-sm mt-1">Dual billing pipeline status — Lago (customer-facing) and Sify internal billing</p>
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pipelines.map((p) => (
          <Card key={p.name} className="border border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">Status: {p.status}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={p.color}>{p.status}</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Events processed: <strong className="text-foreground">{p.events.toLocaleString()}</strong></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Meter Types */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Active Meters</CardTitle></CardHeader>
        <CardContent>
          {meterTypes.every(m => m.current === 0 || m.current === "0.0") ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No metering events recorded yet. Data will appear once API traffic flows through the gateway.
            </div>
          ) : (
            <div className="space-y-3">
              {meterTypes.map((meter) => (
                <div key={meter.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{meter.name}</p>
                      <p className="text-xs text-muted-foreground">Unit: {meter.unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{typeof meter.current === "number" ? meter.current.toLocaleString() : meter.current}</p>
                    <p className="text-xs text-muted-foreground">Current period</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Flow */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Metering Pipeline Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between flex-wrap gap-4">
            {["API Gateway", "Event Collector", "Aggregator", "Lago / Sify Billing", "Invoice Generation"].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-foreground">{step}</div>
                {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
