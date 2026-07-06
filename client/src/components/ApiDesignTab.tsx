import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ArrowDown, Plus, Settings, Trash2, Shield, Zap, Eye, Lock, Globe, Code, Save } from "lucide-react";

type Phase = "request" | "response";
interface PolicyNode { id: string; type: string; label: string; phase: Phase; config?: Record<string, any>; }

const AVAILABLE_POLICIES = [
  { type: "rate-limit", label: "Rate Limiting", icon: Zap, color: "bg-amber-100 text-amber-700" },
  { type: "jwt", label: "JWT Validation", icon: Lock, color: "bg-blue-100 text-blue-700" },
  { type: "transform-headers", label: "Transform Headers", icon: Code, color: "bg-cyan-100 text-cyan-700" },
  { type: "cors", label: "CORS", icon: Globe, color: "bg-orange-100 text-orange-700" },
  { type: "cache", label: "Cache", icon: Zap, color: "bg-teal-100 text-teal-700" },
  { type: "ip-filtering", label: "IP Filtering", icon: Shield, color: "bg-red-100 text-red-700" },
  { type: "json-threat-protection", label: "JSON Threat Protection", icon: Eye, color: "bg-purple-100 text-purple-700" },
];
const DEFAULT_CONFIGS: Record<string, object> = {
  "rate-limit": { rate: { limit: 100, periodTime: 1, periodTimeUnit: "MINUTES" } },
  "jwt": { signature: "RSA_RS256", publicKeyResolver: "GIVEN_KEY" },
  "transform-headers": { addHeaders: [], removeHeaders: [] },
  "cors": { allowOrigin: ["*"], allowCredentials: false, maxAge: 86400 },
  "cache": { timeToLiveSeconds: 300 },
  "ip-filtering": { whitelistIps: [], blacklistIps: [] },
  "json-threat-protection": { maxDepth: 10, maxEntries: 100 },
};
const meta = (t: string) => AVAILABLE_POLICIES.find(p => p.type === t) ?? { label: t, icon: Shield, color: "bg-gray-100 text-gray-700" };

export function ApiDesignTab({ apiId, api, onSaved }: { apiId: number; api: any; onSaved: () => void }) {
  const [request, setRequest] = useState<PolicyNode[]>([]);
  const [response, setResponse] = useState<PolicyNode[]>([]);
  const [addPhase, setAddPhase] = useState<Phase>("request");
  const [addType, setAddType] = useState("");
  const [configNode, setConfigNode] = useState<PolicyNode | null>(null);
  const [configJson, setConfigJson] = useState("");
  const [dirty, setDirty] = useState(false);

  // Load persisted flows from the API's openApiSpec (round-trips via saveFlows).
  useEffect(() => {
    const saved: any[] = api?.openApiSpec?.policyFlows ?? [];
    const toNode = (f: any, i: number): PolicyNode => ({ id: `${f.type}-${f.phase}-${i}`, type: f.type, label: meta(f.type).label, phase: f.phase, config: f.config });
    setRequest(saved.filter(f => f.phase === "request").map(toNode));
    setResponse(saved.filter(f => f.phase === "response").map(toNode));
    setDirty(false);
  }, [api?.openApiSpec]);

  const save = trpc.api.saveFlows.useMutation({
    onSuccess: (r: any) => { toast.success(r.synced ? "Flows saved & synced to gateway" : "Flows saved (gateway offline)"); setDirty(false); onSaved(); },
    onError: (e) => toast.error(e.message),
  });

  function add() {
    const def = AVAILABLE_POLICIES.find(p => p.type === addType);
    if (!def) return;
    const node: PolicyNode = { id: `${addType}-${Date.now()}`, type: def.type, label: def.label, phase: addPhase };
    (addPhase === "request" ? setRequest : setResponse)(prev => [...prev, node]);
    setAddType(""); setDirty(true);
  }
  function remove(id: string, phase: Phase) {
    (phase === "request" ? setRequest : setResponse)(prev => prev.filter(p => p.id !== id)); setDirty(true);
  }
  function openConfig(node: PolicyNode) { setConfigNode(node); setConfigJson(JSON.stringify(node.config ?? DEFAULT_CONFIGS[node.type] ?? {}, null, 2)); }
  function applyConfig() {
    if (!configNode) return;
    try {
      const parsed = JSON.parse(configJson);
      const upd = (prev: PolicyNode[]) => prev.map(p => p.id === configNode.id ? { ...p, config: parsed } : p);
      (configNode.phase === "request" ? setRequest : setResponse)(upd);
      setConfigNode(null); setDirty(true);
    } catch { toast.error("Invalid JSON"); }
  }
  function saveFlows() {
    const flows = [
      ...request.map(p => ({ phase: "request" as const, type: p.type, config: (p.config ?? DEFAULT_CONFIGS[p.type] ?? {}) as Record<string, unknown> })),
      ...response.map(p => ({ phase: "response" as const, type: p.type, config: (p.config ?? DEFAULT_CONFIGS[p.type] ?? {}) as Record<string, unknown> })),
    ];
    save.mutate({ apiId, flows });
  }

  const Lane = ({ title, nodes, phase, tone }: { title: string; nodes: PolicyNode[]; phase: Phase; tone: string }) => (
    <Card>
      <CardHeader className={`rounded-t-lg ${tone}`}>
        <CardTitle className="flex items-center gap-2 text-sm">
          <ArrowRight className={`w-4 h-4 ${phase === "response" ? "rotate-180" : ""}`} />{title}
          <Badge variant="outline" className="ml-auto text-xs">{nodes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {nodes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No {phase} policies</p>}
        {nodes.map((n, idx) => {
          const m = meta(n.type);
          return (
            <div key={n.id}>
              <div className="flex items-center gap-2 p-2.5 border rounded-lg group hover:shadow-sm">
                <div className={`w-7 h-7 rounded flex items-center justify-center ${m.color}`}><m.icon className="w-3.5 h-3.5" /></div>
                <span className="text-sm font-medium flex-1">{n.label}</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openConfig(n)}><Settings className="w-3 h-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => remove(n.id, phase)}><Trash2 className="w-3 h-3" /></Button>
              </div>
              {idx < nodes.length - 1 && <div className="flex justify-center py-0.5"><ArrowDown className="w-3 h-3 text-muted-foreground/40" /></div>}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <Select value={addPhase} onValueChange={v => setAddPhase(v as Phase)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="request">Request</SelectItem><SelectItem value="response">Response</SelectItem></SelectContent>
          </Select>
          <Select value={addType} onValueChange={setAddType}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Add a policy…" /></SelectTrigger>
            <SelectContent>{AVAILABLE_POLICIES.map(p => <SelectItem key={p.type} value={p.type}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={add} disabled={!addType}><Plus className="w-4 h-4 mr-1" />Add</Button>
          <Button className="ml-auto" onClick={saveFlows} disabled={!dirty || save.isPending}>
            <Save className="w-4 h-4 mr-1" />{save.isPending ? "Saving…" : "Save flows"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Lane title="Request phase" nodes={request} phase="request" tone="bg-blue-50 dark:bg-blue-950/30" />
        <Lane title="Response phase" nodes={response} phase="response" tone="bg-emerald-50 dark:bg-emerald-950/30" />
      </div>

      <Sheet open={!!configNode} onOpenChange={o => { if (!o) setConfigNode(null); }}>
        <SheetContent>
          <SheetHeader><SheetTitle>Configure: {configNode?.label}</SheetTitle></SheetHeader>
          <div className="space-y-3 mt-4">
            <Label className="text-xs text-muted-foreground">Policy configuration (JSON)</Label>
            <Textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={16} className="font-mono text-xs" />
            <Button className="w-full" onClick={applyConfig}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
