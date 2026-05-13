import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Radio, Plus, Zap, Wifi, WifiOff } from "lucide-react";

export default function EventEntrypoints() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"kafka" | "mqtt" | "rabbitmq" | "webhook">("kafka");
  const [topicPattern, setTopicPattern] = useState("");
  const [brokerUrl, setBrokerUrl] = useState("");
  const [authMethod, setAuthMethod] = useState<"none" | "sasl_plain" | "sasl_scram" | "mtls" | "api_key">("none");
  const [apiId, setApiId] = useState("");

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: entrypoints, refetch } = trpc.event.entrypoints.useQuery({ tenantId });
  const createEntrypoint = trpc.event.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Event entrypoint created"); resetForm(); },
  });
  const updateEntrypoint = trpc.event.update.useMutation({ onSuccess: () => { refetch(); toast.success("Entrypoint updated"); } });

  function resetForm() { setType("kafka"); setTopicPattern(""); setBrokerUrl(""); setAuthMethod("none"); setApiId(""); }

  const typeIcon = (t: string) => {
    switch (t) {
      case "kafka": return "🔴";
      case "mqtt": return "📡";
      case "rabbitmq": return "🐰";
      case "webhook": return "🔗";
      default: return "⚡";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700";
      case "error": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Event-Native Entrypoints (F-13)</h1>
          <p className="text-muted-foreground">Configure Kafka, MQTT, RabbitMQ, and Webhook event sources for APIs</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Entrypoint</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Event Entrypoint</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>API ID</Label><Input type="number" value={apiId} onChange={e => setApiId(e.target.value)} placeholder="Target API ID" /></div>
              <div><Label>Type</Label>
                <Select value={type} onValueChange={v => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kafka">Apache Kafka</SelectItem>
                    <SelectItem value="mqtt">MQTT</SelectItem>
                    <SelectItem value="rabbitmq">RabbitMQ</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Broker URL</Label><Input value={brokerUrl} onChange={e => setBrokerUrl(e.target.value)} placeholder={type === "kafka" ? "kafka://broker:9092" : type === "mqtt" ? "mqtt://broker:1883" : "amqp://broker:5672"} /></div>
              <div><Label>Topic / Queue Pattern</Label><Input value={topicPattern} onChange={e => setTopicPattern(e.target.value)} placeholder={type === "kafka" ? "orders.*" : "events/#"} /></div>
              <div><Label>Authentication</Label>
                <Select value={authMethod} onValueChange={v => setAuthMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="sasl_plain">SASL Plain</SelectItem>
                    <SelectItem value="sasl_scram">SASL SCRAM</SelectItem>
                    <SelectItem value="mtls">mTLS</SelectItem>
                    <SelectItem value="api_key">API Key</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!apiId || createEntrypoint.isPending}
                onClick={() => createEntrypoint.mutate({ apiId: Number(apiId), tenantId, type, topicPattern: topicPattern || undefined, brokerUrl: brokerUrl || undefined, authMethod })}>
                {createEntrypoint.isPending ? "Creating..." : "Create Entrypoint"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entrypoint Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entrypoints?.map((ep: any) => (
          <Card key={ep.id} className="border-l-4 border-l-amber-400">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{typeIcon(ep.type)}</span>
                  <CardTitle className="text-base capitalize">{ep.type}</CardTitle>
                </div>
                <Badge className={statusColor(ep.status)}>{ep.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="text-muted-foreground">API:</span> #{ep.apiId}</div>
              {ep.brokerUrl && <div><span className="text-muted-foreground">Broker:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ep.brokerUrl}</code></div>}
              {ep.topicPattern && <div><span className="text-muted-foreground">Topic:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{ep.topicPattern}</code></div>}
              <div><span className="text-muted-foreground">Auth:</span> {ep.authMethod === "none" ? "None" : ep.authMethod?.replace("_", " ").toUpperCase()}</div>
              <div className="flex gap-2 pt-2">
                {ep.status === "inactive" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateEntrypoint.mutate({ id: ep.id, status: "active" })}>
                    <Wifi className="w-3 h-3 mr-1" />Activate
                  </Button>
                )}
                {ep.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => updateEntrypoint.mutate({ id: ep.id, status: "inactive" })}>
                    <WifiOff className="w-3 h-3 mr-1" />Deactivate
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!entrypoints || entrypoints.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Event Entrypoints</h3>
            <p className="text-muted-foreground text-sm mb-4">Connect your APIs to event-native sources like Kafka, MQTT, or RabbitMQ</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Add Entrypoint
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
