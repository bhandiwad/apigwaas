import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Radio, Plus, Activity, Database, Zap, Settings } from "lucide-react";

interface ReporterConfig {
  id: number;
  name: string;
  type: "kafka" | "elasticsearch" | "file";
  bootstrapServers: string;
  topic: string;
  securityProtocol: string;
  compressionType: string;
  batchSize: number;
  lingerMs: number;
  enabled: boolean;
}

export default function KafkaReporter() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("gravitee-metrics");
  const [bootstrapServers, setBootstrapServers] = useState("");
  const [topic, setTopic] = useState("gravitee-gateway-metrics");
  const [securityProtocol, setSecurityProtocol] = useState("SASL_SSL");
  const [compressionType, setCompressionType] = useState("lz4");
  const [batchSize, setBatchSize] = useState(16384);
  const [lingerMs, setLingerMs] = useState(5);
  const [eventTypes, setEventTypes] = useState("request,health,log");

  // Using policies table for reporter configs
  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: policies, refetch } = trpc.policy.list.useQuery({ tenantId });
  const reporters = policies?.filter((p: any) => p.name?.includes("reporter") || p.type === "rate_limit" && (p.configuration as any)?.kafkaReporter) || [];

  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Kafka reporter configured"); resetForm(); },
  });

  function resetForm() { setName("gravitee-metrics"); setBootstrapServers(""); setTopic("gravitee-gateway-metrics"); }

  // Mock reporter data for display
  const mockReporters: ReporterConfig[] = [
    { id: 1, name: "Metrics Reporter", type: "kafka", bootstrapServers: "kafka-prod.sify.com:9093", topic: "gravitee-metrics", securityProtocol: "SASL_SSL", compressionType: "lz4", batchSize: 16384, lingerMs: 5, enabled: true },
    { id: 2, name: "Audit Reporter", type: "kafka", bootstrapServers: "kafka-prod.sify.com:9093", topic: "gravitee-audit-events", securityProtocol: "SASL_SSL", compressionType: "snappy", batchSize: 32768, lingerMs: 10, enabled: true },
    { id: 3, name: "Health Check Reporter", type: "elasticsearch", bootstrapServers: "es-prod.sify.com:9200", topic: "gravitee-health-*", securityProtocol: "TLS", compressionType: "none", batchSize: 1000, lingerMs: 1000, enabled: false },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kafka Reporter (F-11)</h1>
          <p className="text-muted-foreground">Configure Gravitee gateway event streaming to Kafka for observability and analytics</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Reporter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Configure Kafka Reporter</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Reporter Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Bootstrap Servers</Label><Input value={bootstrapServers} onChange={e => setBootstrapServers(e.target.value)} placeholder="kafka-1:9093,kafka-2:9093,kafka-3:9093" className="font-mono text-sm" /></div>
              <div><Label>Topic</Label><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="gravitee-gateway-metrics" className="font-mono" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Security Protocol</Label>
                  <Select value={securityProtocol} onValueChange={setSecurityProtocol}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SASL_SSL">SASL_SSL</SelectItem>
                      <SelectItem value="SASL_PLAINTEXT">SASL_PLAINTEXT</SelectItem>
                      <SelectItem value="SSL">SSL</SelectItem>
                      <SelectItem value="PLAINTEXT">PLAINTEXT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Compression</Label>
                  <Select value={compressionType} onValueChange={setCompressionType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lz4">LZ4</SelectItem>
                      <SelectItem value="snappy">Snappy</SelectItem>
                      <SelectItem value="gzip">GZIP</SelectItem>
                      <SelectItem value="zstd">ZSTD</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Batch Size (bytes)</Label><Input type="number" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} /></div>
                <div><Label>Linger (ms)</Label><Input type="number" value={lingerMs} onChange={e => setLingerMs(Number(e.target.value))} /></div>
              </div>
              <div><Label>Event Types</Label><Input value={eventTypes} onChange={e => setEventTypes(e.target.value)} placeholder="request,health,log,audit" className="font-mono text-sm" /></div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!bootstrapServers || createPolicy.isPending}
                onClick={() => createPolicy.mutate({ tenantId, name: `kafka-reporter-${name}`, type: "rate_limit", configuration: { kafkaReporter: true, bootstrapServers, topic, securityProtocol, compressionType, batchSize, lingerMs, eventTypes: eventTypes.split(",") } })}>
                {createPolicy.isPending ? "Configuring..." : "Create Reporter"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Architecture Overview */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Radio className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Event Streaming Architecture</p>
              <p className="text-sm text-purple-700 mt-1">Gateway nodes → Kafka (SASL_SSL) → Consumers (Prometheus Exporter, Lago Metering, SIEM, Audit Archive)</p>
              <div className="flex gap-4 mt-2 text-xs text-purple-600">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Low-latency: &lt;50ms p99</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3" />Retention: 7 days</span>
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" />Partitions: 12 per topic</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reporter Configurations */}
      <Card>
        <CardHeader><CardTitle>Configured Reporters</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockReporters.map(reporter => (
              <div key={reporter.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${reporter.type === "kafka" ? "bg-orange-100" : "bg-blue-100"}`}>
                    {reporter.type === "kafka" ? <Radio className="w-5 h-5 text-orange-600" /> : <Database className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <div className="font-medium">{reporter.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="capitalize">{reporter.type}</Badge>
                      <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{reporter.topic}</code>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {reporter.bootstrapServers} • {reporter.securityProtocol} • {reporter.compressionType} • batch:{reporter.batchSize}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={reporter.enabled} onCheckedChange={() => toast.info("Toggle reporter — coming soon")} />
                  <Button size="sm" variant="outline"><Settings className="w-3 h-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Topic Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Messages/sec</div>
                <div className="text-2xl font-bold text-amber-600">12,847</div>
              </div>
              <Activity className="w-8 h-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Consumer Lag</div>
                <div className="text-2xl font-bold text-green-600">142</div>
              </div>
              <Database className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Throughput</div>
                <div className="text-2xl font-bold text-blue-600">48 MB/s</div>
              </div>
              <Zap className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
