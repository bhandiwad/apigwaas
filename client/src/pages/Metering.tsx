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
import { Activity, ArrowRight, Plus, Zap, Radio, Database, Trash2 } from "lucide-react";

export default function MeteringPage() {
  const { data: metering } = trpc.analytics.metering.useQuery({ pipeline: "customer_facing" });
  const { data: sifyMetering } = trpc.analytics.metering.useQuery({ pipeline: "sify_internal" });
  const { data: rules, refetch: refetchRules } = trpc.analytics.extractionRules.useQuery();

  const lagoEvents = (metering as any[]) || [];
  const sifyEvents = (sifyMetering as any[]) || [];
  const lagoTotal = lagoEvents.length;
  const sifyTotal = sifyEvents.length;
  const extractionRules = (rules as any[]) || [];

  const [metricOpen, setMetricOpen] = useState(false);
  const [metricName, setMetricName] = useState("");
  const [extractionPath, setExtractionPath] = useState("");
  const [extractionType, setExtractionType] = useState("jsonpath");
  const [metricType, setMetricType] = useState("counter");
  const [kafkaTopic, setKafkaTopic] = useState("");

  const createRule = trpc.analytics.createExtractionRule.useMutation({
    onSuccess: () => {
      refetchRules();
      setMetricOpen(false);
      setMetricName(""); setExtractionPath(""); setExtractionType("jsonpath"); setMetricType("counter"); setKafkaTopic("");
      toast.success("Extraction rule created");
    },
    onError: (e) => toast.error(e.message),
  });
  const updateRule = trpc.analytics.updateExtractionRule.useMutation({
    onSuccess: () => refetchRules(),
    onError: (e) => toast.error(e.message),
  });
  const deleteRule = trpc.analytics.deleteExtractionRule.useMutation({
    onSuccess: () => { refetchRules(); toast.success("Rule deleted"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metering</h1>
          <p className="text-muted-foreground text-sm mt-1">Custom metric extraction, Kafka pipeline, and Lago billing sync</p>
        </div>
      </div>

      {/* Pipeline Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="text-2xl font-bold text-amber-600">{extractionRules.filter(r => r.enabled).length}</div>
            <div className="text-xs text-muted-foreground">active / {extractionRules.length} total</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="extraction">
        <TabsList>
          <TabsTrigger value="extraction">Metric Extraction</TabsTrigger>
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
                      <Select value={metricType} onValueChange={setMetricType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="counter">Counter</SelectItem>
                          <SelectItem value="gauge">Gauge</SelectItem>
                          <SelectItem value="histogram">Histogram</SelectItem>
                          <SelectItem value="summary">Summary</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Target Kafka Topic</Label><Input value={kafkaTopic} onChange={e => setKafkaTopic(e.target.value)} placeholder="gravitee-metrics-custom" className="font-mono" /></div>
                    <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!metricName || !extractionPath || createRule.isPending} onClick={() => {
                      createRule.mutate({ name: metricName, extractionPath, extractionType: extractionType as any, metricType: metricType as any, kafkaTopic: kafkaTopic || undefined });
                    }}>{createRule.isPending ? "Creating…" : "Create Rule"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {extractionRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No extraction rules configured. Add rules to extract custom metrics from gateway events.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {extractionRules.map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/40">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center ${rule.enabled ? "bg-green-100" : "bg-muted"}`}>
                          <Activity className={`w-4 h-4 ${rule.enabled ? "text-green-600" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <div className="font-medium text-sm font-mono flex items-center gap-2">{rule.name}<Badge variant="outline" className="text-[10px] font-normal">{rule.metricType}</Badge></div>
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{rule.extractionType}: {rule.extractionPath}</code>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={rule.enabled} disabled={updateRule.isPending} onCheckedChange={checked => {
                          updateRule.mutate({ id: rule.id, enabled: checked });
                        }} />
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" disabled={deleteRule.isPending} onClick={() => deleteRule.mutate({ id: rule.id })}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
