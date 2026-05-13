import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Plus, AlertTriangle, CheckCircle2, Clock, Trash2 } from "lucide-react";

export default function Alerts() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [metric, setMetric] = useState("error_rate");
  const [condition, setCondition] = useState<"gt" | "lt" | "eq" | "gte" | "lte">("gt");
  const [threshold, setThreshold] = useState(5);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [severity, setSeverity] = useState<"critical" | "warning" | "info">("warning");
  const [channels, setChannels] = useState("email");

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: alerts, refetch } = trpc.alert.rules.useQuery({ tenantId });
  const createAlert = trpc.alert.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Alert rule created"); resetForm(); },
  });
  const updateAlert = trpc.alert.update.useMutation({ onSuccess: () => { refetch(); } });
  // No delete mutation available - use update to disable

  function resetForm() { setName(""); setMetric("error_rate"); setCondition("gt"); setThreshold(5); setWindowMinutes(5); setSeverity("warning"); setChannels("email"); }

  const severityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-100 text-red-700 border-red-300";
      case "warning": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "info": return "bg-blue-100 text-blue-700 border-blue-300";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const conditionLabel = (c: string) => {
    const labels: Record<string, string> = { gt: ">", lt: "<", eq: "=", gte: "≥", lte: "≤" };
    return labels[c] || c;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts & Notifications (F-10)</h1>
          <p className="text-muted-foreground">Configure alert rules with threshold-based triggers and multi-channel notifications</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Create Alert</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Alert Rule</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Alert Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="High Error Rate" /></div>
              <div><Label>Metric</Label>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="error_rate">Error Rate (%)</SelectItem>
                    <SelectItem value="latency_p99">Latency P99 (ms)</SelectItem>
                    <SelectItem value="request_count">Request Count</SelectItem>
                    <SelectItem value="cpu_usage">CPU Usage (%)</SelectItem>
                    <SelectItem value="memory_usage">Memory Usage (%)</SelectItem>
                    <SelectItem value="quota_usage">Quota Usage (%)</SelectItem>
                    <SelectItem value="5xx_count">5xx Count</SelectItem>
                    <SelectItem value="4xx_count">4xx Count</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Condition</Label>
                  <Select value={condition} onValueChange={v => setCondition(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gt">&gt; Greater than</SelectItem>
                      <SelectItem value="gte">≥ Greater or equal</SelectItem>
                      <SelectItem value="lt">&lt; Less than</SelectItem>
                      <SelectItem value="lte">≤ Less or equal</SelectItem>
                      <SelectItem value="eq">= Equal to</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Threshold</Label><Input type="number" value={threshold} onChange={e => setThreshold(Number(e.target.value))} /></div>
                <div><Label>Window (min)</Label><Input type="number" value={windowMinutes} onChange={e => setWindowMinutes(Number(e.target.value))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Severity</Label>
                  <Select value={severity} onValueChange={v => setSeverity(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Channels (comma-sep)</Label><Input value={channels} onChange={e => setChannels(e.target.value)} placeholder="email,slack,pagerduty" /></div>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || createAlert.isPending}
                onClick={() => createAlert.mutate({ tenantId, name, type: metric as any, condition: { operator: condition, value: threshold, windowMinutes }, threshold, severity, channels: channels.split(",").map(c => ({ type: c.trim(), target: c.trim() })) })}>
                {createAlert.isPending ? "Creating..." : "Create Alert Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Total Rules</div><div className="text-2xl font-bold text-amber-600">{alerts?.length || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Critical</div><div className="text-2xl font-bold text-red-600">{alerts?.filter((a: any) => a.severity === "critical").length || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Firing</div><div className="text-2xl font-bold text-orange-600">{alerts?.filter((a: any) => a.lastFiredAt && new Date(a.lastFiredAt) > new Date(Date.now() - 3600000)).length || 0}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-sm text-muted-foreground">Enabled</div><div className="text-2xl font-bold text-green-600">{alerts?.filter((a: any) => a.enabled).length || 0}</div></CardContent></Card>
      </div>

      {/* Alert Rules */}
      <Card>
        <CardHeader><CardTitle>Alert Rules</CardTitle></CardHeader>
        <CardContent>
          {alerts && alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Switch checked={alert.enabled} onCheckedChange={checked => updateAlert.mutate({ id: alert.id, enabled: checked })} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{alert.name}</span>
                        <Badge className={severityColor(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{alert.metric}</code>
                        <span className="mx-1">{conditionLabel(alert.condition)}</span>
                        <span className="font-medium">{alert.threshold}</span>
                        <span className="mx-1">over</span>
                        <span>{alert.windowMinutes}m</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Channels: {(alert.channels as string[])?.join(", ")}
                        {alert.lastFiredAt && <span className="ml-2">• Last fired: {new Date(alert.lastFiredAt).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.lastFiredAt && new Date(alert.lastFiredAt) > new Date(Date.now() - 3600000) && (
                      <Badge className="bg-orange-100 text-orange-700"><AlertTriangle className="w-3 h-3 mr-1" />Firing</Badge>
                    )}
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => updateAlert.mutate({ id: alert.id, enabled: false })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No alert rules configured. Create rules to monitor your API gateway metrics.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
