import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Activity, Database, ArrowRight, Plus, Settings, Zap, Radio, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export default function MeteringPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: metering } = trpc.analytics.metering.useQuery({ tenantId: defaultTenantId, pipeline: "customer_facing" }, { enabled: !!defaultTenantId });
  const { data: sifyMetering } = trpc.analytics.metering.useQuery({ tenantId: defaultTenantId, pipeline: "sify_internal" }, { enabled: !!defaultTenantId });

  const lagoEvents = (metering as any[]) || [];
  const sifyEvents = (sifyMetering as any[]) || [];
  const lagoTotal = lagoEvents.reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);
  const sifyTotal = sifyEvents.reduce((sum: number, e: any) => sum + (e.quantity || 0), 0);

  const [metricOpen, setMetricOpen] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [extractionPath, setExtractionPath] = useState("");
  const [extractionType, setExtractionType] = useState("jsonpath");

  // F-03: Custom Metric Extraction Rules
  const metricExtractionRules = [
    { id: 1, name: "api_calls", path: "$.request.count", type: "counter", source: "gateway_event", kafkaTopic: "gravitee-metrics-api-calls", enabled: true },
    { id: 2, name: "data_egress_bytes", path: "$.response.content_length", type: "gauge", source: "gateway_event", kafkaTopic: "gravitee-metrics-data-transfer", enabled: true },
    { id: 3, name: "data_ingress_bytes", path: "$.request.content_length", type: "gauge", source: "gateway_event", kafkaTopic: "gravitee-metrics-data-transfer", enabled: true },
    { id: 4, name: "compute_time_ms", path: "$.metrics.proxy_latency", type: "histogram", source: "gateway_event", kafkaTopic: "gravitee-metrics-compute", enabled: true },
    { id: 5, name: "error_count", path: "$.response.status >= 500", type: "counter", source: "gateway_event", kafkaTopic: "gravitee-metrics-errors", enabled: false },
  ];

  // F-03: Kafka Topic Configuration for Metering
  const kafkaTopics = [
    { topic: "gravitee-metrics-api-calls", partitions: 12, replication: 3, retention: "7d", format: "avro", consumerGroup: "lago-metering-consumer", lag: 42, status: "healthy" },
    { topic: "gravitee-metrics-data-transfer", partitions: 6, replication: 3, retention: "7d", format: "avro", consumerGroup: "lago-metering-consumer", lag: 18, status: "healthy" },
    { topic: "gravitee-metrics-compute", partitions: 6, replication: 3, retention: "3d", format: "json", consumerGroup: "lago-metering-consumer", lag: 5, status: "healthy" },
    { topic: "gravitee-metrics-errors", partitions: 3, replication: 3, retention: "30d", format: "json", consumerGroup: "sify-billing-consumer", lag: 0, status: "idle" },
    { topic: "gravitee-audit-events", partitions: 6, replication: 3, retention: "90d", format: "avro", consumerGroup: "audit-archiver", lag: 127, status: "warning" },
  ];

  // F-03: Lago Plan Sync Status
  const lagoPlanSync = [
    { planId: "starter_monthly", lagoCode: "starter_monthly_v2", lastSync: "2 min ago", status: "synced", billableMetrics: ["api_calls", "data_egress_bytes"] },
    { planId: "business_monthly", lagoCode: "business_monthly_v2", lastSync: "2 min ago", status: "synced", billableMetrics: ["api_calls", "data_egress_bytes", "compute_time_ms"] },
    { planId: "enterprise_monthly", lagoCode: "enterprise_monthly_v2", lastSync: "5 min ago", status: "synced", billableMetrics: ["api_calls", "data_egress_bytes", "data_ingress_bytes", "compute_time_ms"] },
    { planId: "sovereign_monthly", lagoCode: "sovereign_monthly_v2", lastSync: "15 min ago", status: "drift", billableMetrics: ["api_calls", "data_egress_bytes", "data_ingress_bytes", "compute_time_ms", "storage_gb_hours"] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metering (F-03)</h1>
          <p className="text-muted-foreground text-sm mt-1">Custom metric extraction, Kafka pipeline, and Lago billing sync</p>
        </div>
        <Button variant="outline" onClick={() => toast.success("Pipelines refreshed")}><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
      </div>

      {/* Pipeline Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Lago Pipeline</div>
            <div className="text-2xl font-bold text-green-600">{lagoTotal.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">events processed</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Sify Internal</div>
            <div className="text-2xl font-bold text-blue-600">{sifyTotal.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">events processed</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Extraction Rules</div>
            <div className="text-2xl font-bold text-amber-600">{metricExtractionRules.filter(r => r.enabled).length}</div>
            <div className="text-xs text-muted-foreground">active / {metricExtractionRules.length} total</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Kafka Topics</div>
            <div className="text-2xl font-bold text-purple-600">{kafkaTopics.length}</div>
            <div className="text-xs text-muted-foreground">{kafkaTopics.filter(t => t.status === "healthy").length} healthy</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="extraction">
        <TabsList>
          <TabsTrigger value="extraction">Metric Extraction</TabsTrigger>
          <TabsTrigger value="kafka">Kafka Topics</TabsTrigger>
          <TabsTrigger value="lago">Lago Sync</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline Flow</TabsTrigger>
        </TabsList>

        {/* Custom Metric Extraction Rules */}
        <TabsContent value="extraction" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Custom Metric Extraction Rules</CardTitle>
              <Dialog open={metricOpen} onOpenChange={setMetricOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-3 h-3 mr-1" />Add Rule</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Metric Extraction Rule</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div><Label>Metric Name</Label><Input value={metricName} onChange={e => setMetricName(e.target.value)} placeholder="custom_metric_name" className="font-mono" /></div>
                    <div><Label>Extraction Path</Label><Input value={extractionPath} onChange={e => setExtractionPath(e.target.value)} placeholder="$.response.headers.x-custom-metric" className="font-mono" /></div>
                    <div><Label>Extraction Type</Label>
                      <Select value={extractionType} onValueChange={setExtractionType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jsonpath">JSONPath</SelectItem>
                          <SelectItem value="header">HTTP Header</SelectItem>
                          <SelectItem value="regex">Regex</SelectItem>
                          <SelectItem value="groovy">Groovy Script</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Metric Type</Label>
                      <Select defaultValue="counter">
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="counter">Counter</SelectItem>
                          <SelectItem value="gauge">Gauge</SelectItem>
                          <SelectItem value="histogram">Histogram</SelectItem>
                          <SelectItem value="summary">Summary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Target Kafka Topic</Label><Input placeholder="gravitee-metrics-custom" className="font-mono" /></div>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" onClick={() => { setMetricOpen(false); toast.success("Extraction rule created"); }}>Create Rule</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {metricExtractionRules.map(rule => (
                  <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center ${rule.enabled ? "bg-green-100" : "bg-gray-100"}`}>
                        <Activity className={`w-4 h-4 ${rule.enabled ? "text-green-600" : "text-gray-400"}`} />
                      </div>
                      <div>
                        <div className="font-medium text-sm font-mono">{rule.name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{rule.path}</code>
                          <Badge variant="outline" className="text-xs capitalize">{rule.type}</Badge>
                          <span className="text-xs text-muted-foreground">→ {rule.kafkaTopic}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={rule.enabled} onCheckedChange={() => toast.info("Toggle rule — coming soon")} />
                      <Button size="sm" variant="ghost"><Settings className="w-3 h-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Kafka Topic Configuration */}
        <TabsContent value="kafka" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Radio className="w-4 h-4 text-amber-600" />Kafka Topic Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Topic</th>
                      <th className="pb-3 font-medium">Partitions</th>
                      <th className="pb-3 font-medium">Replication</th>
                      <th className="pb-3 font-medium">Retention</th>
                      <th className="pb-3 font-medium">Format</th>
                      <th className="pb-3 font-medium">Consumer Group</th>
                      <th className="pb-3 font-medium">Lag</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kafkaTopics.map(topic => (
                      <tr key={topic.topic} className="border-b hover:bg-gray-50">
                        <td className="py-3 font-mono text-xs">{topic.topic}</td>
                        <td className="py-3">{topic.partitions}</td>
                        <td className="py-3">{topic.replication}</td>
                        <td className="py-3">{topic.retention}</td>
                        <td className="py-3"><Badge variant="outline" className="text-xs uppercase">{topic.format}</Badge></td>
                        <td className="py-3 font-mono text-xs">{topic.consumerGroup}</td>
                        <td className="py-3">
                          <span className={topic.lag > 100 ? "text-amber-600 font-medium" : "text-green-600"}>{topic.lag}</span>
                        </td>
                        <td className="py-3">
                          <Badge className={topic.status === "healthy" ? "bg-green-100 text-green-700" : topic.status === "warning" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}>
                            {topic.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lago Plan Sync */}
        <TabsContent value="lago" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Database className="w-4 h-4 text-blue-600" />Lago Plan Sync Status</CardTitle>
              <Button size="sm" variant="outline" onClick={() => toast.success("Full sync triggered")}><RefreshCw className="w-3 h-3 mr-1" />Force Sync All</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {lagoPlanSync.map(plan => (
                  <div key={plan.planId} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {plan.status === "synced" ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                      )}
                      <div>
                        <div className="font-medium text-sm">{plan.planId}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">lago: {plan.lagoCode}</code>
                          <span className="text-xs text-muted-foreground">• Last sync: {plan.lastSync}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          {plan.billableMetrics.map(m => (
                            <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={plan.status === "synced" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}>
                        {plan.status}
                      </Badge>
                      {plan.status === "drift" && (
                        <Button size="sm" variant="outline" onClick={() => toast.success(`Syncing ${plan.planId}...`)}><RefreshCw className="w-3 h-3" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Lago Connection Config */}
          <Card>
            <CardHeader><CardTitle className="text-base">Lago Connection Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Lago API URL</Label>
                  <code className="block text-sm font-mono mt-1">https://lago.sify-internal.com/api/v1</code>
                </div>
                <div className="p-3 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Sync Interval</Label>
                  <code className="block text-sm font-mono mt-1">Every 60 seconds</code>
                </div>
                <div className="p-3 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Event Batch Size</Label>
                  <code className="block text-sm font-mono mt-1">1000 events/batch</code>
                </div>
                <div className="p-3 border rounded-lg">
                  <Label className="text-xs text-muted-foreground">Deduplication Window</Label>
                  <code className="block text-sm font-mono mt-1">24 hours (idempotency key)</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline Flow */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">End-to-End Metering Pipeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between flex-wrap gap-4">
                {[
                  { label: "API Gateway", sub: "Event emission", icon: Zap },
                  { label: "Kafka", sub: "Event streaming", icon: Radio },
                  { label: "Metric Extractor", sub: "Custom rules", icon: Activity },
                  { label: "Aggregator", sub: "1min windows", icon: Database },
                  { label: "Lago / Sify", sub: "Billing engine", icon: Database },
                ].map((step, i, arr) => (
                  <div key={step.label} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
                      <step.icon className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">{step.label}</span>
                      <span className="text-[10px] text-muted-foreground">{step.sub}</span>
                    </div>
                    {i < arr.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
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
