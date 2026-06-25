import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Radio, Plus, Activity } from "lucide-react";

export default function KafkaReporter() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
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

  const { data: config, refetch } = trpc.kafkaReporter.get.useQuery();
  const savedReporters: any[] = (config as any)?.reporters ?? [];
  const savedMappings: any[] = (config as any)?.topicMappings ?? [];

  const [localMappings, setLocalMappings] = useState<any[] | null>(null);
  const topicMappings = localMappings ?? savedMappings;

  const saveConfig = trpc.kafkaReporter.save.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Kafka reporter configured"); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kafka Reporter</h1>
          <p className="text-muted-foreground">Gateway event streaming — topic mapping, serialization formats, and buffer configuration</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Reporter</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Configure Kafka Reporter</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Reporter Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Primary Metrics Reporter" /></div>
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
                  <div><Label>Schema Registry URL</Label><Input value={schemaRegistryUrl} onChange={e => setSchemaRegistryUrl(e.target.value)} placeholder="https://schema-registry:8081" className="font-mono text-sm" /></div>
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
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!bootstrapServers || !name || saveConfig.isPending}
                onClick={() => {
                  const newReporter = { name, topic, securityProtocol, compressionType, serializationFormat, schemaRegistryUrl, batchSize, lingerMs, bufferMemory, maxBlockMs, eventTypes: eventTypes.split(","), enabled: true };
                  saveConfig.mutate({ brokers: bootstrapServers, enabled: true, reporters: [...savedReporters, newReporter], topicMappings });
                }}>
                {saveConfig.isPending ? "Saving..." : "Create Reporter"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Reporter Instances */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configured Reporters</CardTitle></CardHeader>
        <CardContent>
          {savedReporters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No Kafka reporters configured yet.</p>
              <p className="text-xs mt-1">Add a reporter to start streaming gateway events to Kafka.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedReporters.map((reporter: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                        <Radio className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <div className="font-medium">{reporter.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{reporter.bootstrapServers || (config as any)?.brokers}</div>
                      </div>
                    </div>
                    <Switch checked={reporter.enabled ?? true} onCheckedChange={(checked) => {
                      const updated = savedReporters.map((r: any, i: number) => i === idx ? { ...r, enabled: checked } : r);
                      saveConfig.mutate({ reporters: updated });
                      toast.success(`Reporter ${checked ? "enabled" : "disabled"}`);
                    }} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Protocol:</span> <span className="font-medium">{reporter.securityProtocol}</span></div>
                    <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Compression:</span> <span className="font-medium">{reporter.compressionType}</span></div>
                    <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Format:</span> <span className="font-medium uppercase">{reporter.serializationFormat}</span></div>
                    <div className="p-2 bg-gray-50 rounded"><span className="text-muted-foreground">Linger:</span> <span className="font-medium">{reporter.lingerMs}ms</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Topic Mapping */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Event Type → Topic Mapping</CardTitle>
          <Button size="sm" variant="outline" onClick={() => {
            const newMapping = { eventType: "CUSTOM", topic: "gravitee-gateway-custom", format: "json", enabled: true };
            const updated = [...topicMappings, newMapping];
            setLocalMappings(updated);
            saveConfig.mutate({ topicMappings: updated, reporters: savedReporters });
            toast.success("Mapping added");
          }}><Plus className="w-3 h-3 mr-1" />Add Mapping</Button>
        </CardHeader>
        <CardContent>
          {topicMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No topic mappings configured. Add a reporter to enable event routing.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Event Type</th>
                    <th className="pb-3 font-medium">Kafka Topic</th>
                    <th className="pb-3 font-medium">Format</th>
                    <th className="pb-3 font-medium">Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {topicMappings.map((mapping: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-mono text-xs">{mapping.eventType}</td>
                      <td className="py-3 font-mono text-xs">{mapping.topic}</td>
                      <td className="py-3 uppercase text-xs">{mapping.format}</td>
                      <td className="py-3"><Switch checked={mapping.enabled} onCheckedChange={(checked) => {
                        const updated = topicMappings.map((m: any, i: number) => i === idx ? { ...m, enabled: checked } : m);
                        setLocalMappings(updated);
                        saveConfig.mutate({ topicMappings: updated, reporters: savedReporters });
                        toast.success(`${mapping.eventType} mapping ${checked ? "enabled" : "disabled"}`);
                      }} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
