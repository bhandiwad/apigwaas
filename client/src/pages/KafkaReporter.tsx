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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Radio, Plus, Activity, Database, Zap, Settings, ArrowRight, RefreshCw } from "lucide-react";

export default function KafkaReporter() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("gravitee-metrics");
  const [bootstrapServers, setBootstrapServers] = useState("");
  const [topic, setTopic] = useState("gravitee-gateway-metrics");
  const [securityProtocol, setSecurityProtocol] = useState("SASL_SSL");
  const [compressionType, setCompressionType] = useState("lz4");
  const [serializationFormat, setSerializationFormat] = useState("avro");
  const [schemaRegistryUrl, setSchemaRegistryUrl] = useState("");
  const [batchSize, setBatchSize] = useState(16384);
  const [lingerMs, setLingerMs] = useState(5);
  const [bufferMemory, setBufferMemory] = useState(33554432);
  const [maxBlockMs, setMaxBlockMs] = useState(60000);
  const [eventTypes, setEventTypes] = useState("request,health,log");

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = (tenants as any)?.[0]?.id || 1;
  const { data: policies, refetch } = trpc.policy.list.useQuery({ tenantId });

  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Kafka reporter configured"); },
  });

  // Topic Mapping Configuration
  const topicMappings = [
    { eventType: "REQUEST", topic: "gravitee-gateway-requests", format: "avro", schemaId: "gravitee.request.v2", partitionKey: "api_id", enabled: true },
    { eventType: "HEALTH_CHECK", topic: "gravitee-gateway-health", format: "avro", schemaId: "gravitee.health.v1", partitionKey: "endpoint_id", enabled: true },
    { eventType: "LOG", topic: "gravitee-gateway-logs", format: "json", schemaId: "-", partitionKey: "request_id", enabled: true },
    { eventType: "AUDIT", topic: "gravitee-audit-events", format: "avro", schemaId: "gravitee.audit.v1", partitionKey: "tenant_id", enabled: true },
    { eventType: "METRICS", topic: "gravitee-gateway-metrics", format: "avro", schemaId: "gravitee.metrics.v3", partitionKey: "api_id", enabled: true },
    { eventType: "ALERT", topic: "gravitee-gateway-alerts", format: "json", schemaId: "-", partitionKey: "rule_id", enabled: false },
  ];

  // Reporter Instances
  const reporters = [
    { id: 1, name: "Primary Metrics Reporter", bootstrapServers: "kafka-prod-1.sify.com:9093,kafka-prod-2.sify.com:9093,kafka-prod-3.sify.com:9093", securityProtocol: "SASL_SSL", compression: "lz4", format: "avro", batchSize: 16384, lingerMs: 5, bufferMemory: "32 MB", enabled: true, throughput: "12,847 msg/s" },
    { id: 2, name: "Audit Event Reporter", bootstrapServers: "kafka-prod-1.sify.com:9093,kafka-prod-2.sify.com:9093,kafka-prod-3.sify.com:9093", securityProtocol: "SASL_SSL", compression: "snappy", format: "avro", batchSize: 32768, lingerMs: 10, bufferMemory: "64 MB", enabled: true, throughput: "3,241 msg/s" },
    { id: 3, name: "DR Replication Reporter", bootstrapServers: "kafka-dr-1.sify.com:9093,kafka-dr-2.sify.com:9093", securityProtocol: "SASL_SSL", compression: "zstd", format: "avro", batchSize: 65536, lingerMs: 50, bufferMemory: "128 MB", enabled: true, throughput: "16,088 msg/s" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kafka Reporter (F-11)</h1>
          <p className="text-muted-foreground">Gateway event streaming — topic mapping, serialization formats, and buffer configuration</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Reporter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configure Kafka Reporter</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Reporter Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <div><Label>Bootstrap Servers</Label><Input value={bootstrapServers} onChange={e => setBootstrapServers(e.target.value)} placeholder="kafka-1:9093,kafka-2:9093,kafka-3:9093" className="font-mono text-sm" /></div>
              <div><Label>Default Topic</Label><Input value={topic} onChange={e => setTopic(e.target.value)} placeholder="gravitee-gateway-metrics" className="font-mono" /></div>
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
                <div><Label>Serialization Format</Label>
                  <Select value={serializationFormat} onValueChange={setSerializationFormat}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="avro">Avro (Schema Registry)</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="protobuf">Protobuf</SelectItem>
                      <SelectItem value="msgpack">MessagePack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {serializationFormat === "avro" && (
                  <div><Label>Schema Registry URL</Label><Input value={schemaRegistryUrl} onChange={e => setSchemaRegistryUrl(e.target.value)} placeholder="https://schema-registry.sify.com" className="font-mono text-sm" /></div>
                )}
              </div>
              <div className="border-t pt-4">
                <Label className="text-sm font-semibold">Buffer Settings</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div><Label className="text-xs">Batch Size (bytes)</Label><Input type="number" value={batchSize} onChange={e => setBatchSize(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Linger (ms)</Label><Input type="number" value={lingerMs} onChange={e => setLingerMs(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Buffer Memory (bytes)</Label><Input type="number" value={bufferMemory} onChange={e => setBufferMemory(Number(e.target.value))} /></div>
                  <div><Label className="text-xs">Max Block (ms)</Label><Input type="number" value={maxBlockMs} onChange={e => setMaxBlockMs(Number(e.target.value))} /></div>
                </div>
              </div>
              <div><Label>Event Types</Label><Input value={eventTypes} onChange={e => setEventTypes(e.target.value)} placeholder="request,health,log,audit,metrics,alert" className="font-mono text-sm" /></div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!bootstrapServers || createPolicy.isPending}
                onClick={() => createPolicy.mutate({ tenantId, name: `kafka-reporter-${name}`, type: "rate_limit", configuration: { kafkaReporter: true, bootstrapServers, topic, securityProtocol, compressionType, serializationFormat, schemaRegistryUrl, batchSize, lingerMs, bufferMemory, maxBlockMs, eventTypes: eventTypes.split(",") } })}>
                {createPolicy.isPending ? "Configuring..." : "Create Reporter"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Architecture Banner */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Radio className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium text-purple-800">Event Streaming Architecture (F-11)</p>
              <p className="text-sm text-purple-700 mt-1">Gateway Nodes → Kafka (SASL_SSL + Avro/JSON) → Consumers (Prometheus, Lago, SIEM, Audit Archive)</p>
              <div className="flex gap-4 mt-2 text-xs text-purple-600">
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />Latency: &lt;50ms p99</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3" />Retention: 7d default</span>
                <span className="flex items-center gap-1"><Activity className="w-3 h-3" />Schema Registry: Confluent</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="reporters">
        <TabsList>
          <TabsTrigger value="reporters">Reporter Instances</TabsTrigger>
          <TabsTrigger value="topic-mapping">Topic Mapping</TabsTrigger>
          <TabsTrigger value="metrics">Throughput Metrics</TabsTrigger>
        </TabsList>

        {/* Reporter Instances */}
        <TabsContent value="reporters" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configured Reporters</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reporters.map(reporter => (
                  <div key={reporter.id} className="p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                          <Radio className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="font-medium">{reporter.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{reporter.bootstrapServers}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-700">{reporter.throughput}</Badge>
                        <Switch checked={reporter.enabled} onCheckedChange={() => toast.info("Toggle reporter")} />
                        <Button size="sm" variant="outline"><Settings className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Protocol:</span> <span className="font-medium">{reporter.securityProtocol}</span></div>
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Compression:</span> <span className="font-medium">{reporter.compression}</span></div>
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Format:</span> <span className="font-medium uppercase">{reporter.format}</span></div>
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Batch:</span> <span className="font-medium">{reporter.batchSize}B</span></div>
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Linger:</span> <span className="font-medium">{reporter.lingerMs}ms</span></div>
                      <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Buffer:</span> <span className="font-medium">{reporter.bufferMemory}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Topic Mapping */}
        <TabsContent value="topic-mapping" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Event Type → Topic Mapping</CardTitle>
              <Button size="sm" variant="outline"><Plus className="w-3 h-3 mr-1" />Add Mapping</Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Event Type</th>
                      <th className="pb-3 font-medium">Kafka Topic</th>
                      <th className="pb-3 font-medium">Format</th>
                      <th className="pb-3 font-medium">Schema ID</th>
                      <th className="pb-3 font-medium">Partition Key</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicMappings.map(mapping => (
                      <tr key={mapping.eventType} className="border-b hover:bg-gray-50">
                        <td className="py-3"><Badge variant="outline" className="font-mono text-xs">{mapping.eventType}</Badge></td>
                        <td className="py-3 font-mono text-xs">{mapping.topic}</td>
                        <td className="py-3"><Badge className={mapping.format === "avro" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>{mapping.format.toUpperCase()}</Badge></td>
                        <td className="py-3 font-mono text-xs">{mapping.schemaId}</td>
                        <td className="py-3 font-mono text-xs">{mapping.partitionKey}</td>
                        <td className="py-3"><Switch checked={mapping.enabled} onCheckedChange={() => toast.info("Toggle mapping")} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Throughput Metrics */}
        <TabsContent value="metrics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Messages/sec</div>
                    <div className="text-2xl font-bold text-amber-600">32,176</div>
                    <div className="text-xs text-muted-foreground">across all reporters</div>
                  </div>
                  <Activity className="w-8 h-8 text-amber-200" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Total Consumer Lag</div>
                    <div className="text-2xl font-bold text-green-600">192</div>
                    <div className="text-xs text-muted-foreground">messages behind</div>
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
                    <div className="text-2xl font-bold text-blue-600">128 MB/s</div>
                    <div className="text-xs text-muted-foreground">aggregate bandwidth</div>
                  </div>
                  <Zap className="w-8 h-8 text-blue-200" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
