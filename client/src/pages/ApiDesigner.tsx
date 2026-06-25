import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowRight, ArrowDown, Plus, Settings, Trash2, GripVertical, Shield, Zap, Eye, Lock, Globe, Code, Save } from "lucide-react";

interface PolicyNode {
  id: string;
  type: string;
  label: string;
  phase: "request" | "response";
  icon: any;
  color: string;
  config?: Record<string, any>;
}

const AVAILABLE_POLICIES = [
  { type: "rate-limit", label: "Rate Limiting", icon: Zap, color: "bg-amber-100 text-amber-700" },
  { type: "jwt-validation", label: "JWT Validation", icon: Lock, color: "bg-blue-100 text-blue-700" },
  { type: "data-masking", label: "Data Masking", icon: Eye, color: "bg-purple-100 text-purple-700" },
  { type: "ip-filtering", label: "IP Filtering", icon: Shield, color: "bg-red-100 text-red-700" },
  { type: "geoip", label: "GeoIP Filtering", icon: Globe, color: "bg-green-100 text-green-700" },
  { type: "transform-headers", label: "Transform Headers", icon: Code, color: "bg-cyan-100 text-cyan-700" },
  { type: "cors", label: "CORS", icon: Globe, color: "bg-orange-100 text-orange-700" },
  { type: "cache", label: "Cache", icon: Zap, color: "bg-teal-100 text-teal-700" },
  { type: "oauth2", label: "OAuth2 Resource", icon: Lock, color: "bg-indigo-100 text-indigo-700" },
  { type: "circuit-breaker", label: "Circuit Breaker", icon: Shield, color: "bg-rose-100 text-rose-700" },
];

const DEFAULT_CONFIGS: Record<string, object> = {
  "rate-limit": { limit: 100, period: "minute", burstLimit: 200 },
  "jwt-validation": { issuer: "https://auth.example.com", audience: "api", algorithms: ["RS256"] },
  "data-masking": { fields: ["$.body.pan", "$.body.aadhaar"], action: "partial", showLastN: 4 },
  "ip-filtering": { whitelist: [], blacklist: [], failOnUnknown: false },
  "geoip": { allowedCountries: ["IN"], blockedCountries: [], failOnUnknown: false },
  "transform-headers": { addHeaders: {}, removeHeaders: [], renameHeaders: {} },
  "cors": { allowedOrigins: ["*"], allowCredentials: false, maxAge: 86400 },
  "cache": { ttl: 300, cacheControlHeader: true, varyOnHeaders: [] },
  "oauth2": { resourceServerUrl: "", requiredScopes: [], tokenIntrospect: true },
  "circuit-breaker": { failureThreshold: 50, slowCallThreshold: 2000, waitDuration: 30000 },
};

function policyIcon(type: string) {
  return AVAILABLE_POLICIES.find(p => p.type === type)?.icon ?? Shield;
}
function policyColor(type: string) {
  return AVAILABLE_POLICIES.find(p => p.type === type)?.color ?? "bg-gray-100 text-gray-700";
}

export default function ApiDesigner() {
  const [selectedApiId, setSelectedApiId] = useState<string>("");
  const [requestPolicies, setRequestPolicies] = useState<PolicyNode[]>([]);
  const [responsePolicies, setResponsePolicies] = useState<PolicyNode[]>([]);
  const [addPhase, setAddPhase] = useState<"request" | "response">("request");
  const [addType, setAddType] = useState("");
  const [configNode, setConfigNode] = useState<PolicyNode | null>(null);
  const [configJson, setConfigJson] = useState("");

  const { data: apis } = trpc.api.list.useQuery({ workspaceId: undefined });
  const saveFlowsMutation = trpc.api.saveFlows.useMutation({
    onSuccess: (result) => {
      toast.success(result.synced ? "Flows saved and synced to Gravitee" : "Flows saved to database (Gravitee offline)");
    },
    onError: () => toast.error("Failed to save flows"),
  });

  const selectedApi = (apis as any[])?.find((a: any) => String(a.id) === selectedApiId);

  // Load saved flows from openApiSpec when API changes
  useEffect(() => {
    if (!selectedApi) {
      setRequestPolicies([]);
      setResponsePolicies([]);
      return;
    }
    const saved = selectedApi.openApiSpec?.policyFlows ?? [];
    const toNode = (f: any, idx: number): PolicyNode => ({
      id: `${f.type}-${f.phase}-${idx}`,
      type: f.type,
      label: AVAILABLE_POLICIES.find(p => p.type === f.type)?.label ?? f.type,
      phase: f.phase,
      icon: policyIcon(f.type),
      color: policyColor(f.type),
      config: f.config,
    });
    setRequestPolicies(saved.filter((f: any) => f.phase === "request").map(toNode));
    setResponsePolicies(saved.filter((f: any) => f.phase === "response").map(toNode));
  }, [selectedApiId, selectedApi?.openApiSpec]);

  function addPolicy() {
    const policyDef = AVAILABLE_POLICIES.find(p => p.type === addType);
    if (!policyDef) return;
    const newNode: PolicyNode = {
      id: String(Date.now()),
      type: policyDef.type,
      label: policyDef.label,
      phase: addPhase,
      icon: policyDef.icon,
      color: policyDef.color,
    };
    if (addPhase === "request") setRequestPolicies(prev => [...prev, newNode]);
    else setResponsePolicies(prev => [...prev, newNode]);
    setAddType("");
    toast.success(`Added ${policyDef.label} to ${addPhase} phase`);
  }

  function openConfig(node: PolicyNode) {
    setConfigNode(node);
    setConfigJson(JSON.stringify(node.config ?? DEFAULT_CONFIGS[node.type] ?? {}, null, 2));
  }

  function saveConfig() {
    if (!configNode) return;
    try {
      const parsed = JSON.parse(configJson);
      const update = (prev: PolicyNode[]) => prev.map(p => p.id === configNode.id ? { ...p, config: parsed } : p);
      if (configNode.phase === "request") setRequestPolicies(update);
      else setResponsePolicies(update);
      setConfigNode(null);
      toast.success("Configuration updated");
    } catch {
      toast.error("Invalid JSON — check your configuration");
    }
  }

  function removePolicy(id: string, phase: "request" | "response") {
    if (phase === "request") setRequestPolicies(prev => prev.filter(p => p.id !== id));
    else setResponsePolicies(prev => prev.filter(p => p.id !== id));
  }

  function saveFlows() {
    if (!selectedApiId) { toast.error("Select an API first"); return; }
    const flows = [
      ...requestPolicies.map(p => ({ phase: "request" as const, type: p.type, config: (p.config ?? DEFAULT_CONFIGS[p.type] ?? {}) as Record<string, unknown> })),
      ...responsePolicies.map(p => ({ phase: "response" as const, type: p.type, config: (p.config ?? DEFAULT_CONFIGS[p.type] ?? {}) as Record<string, unknown> })),
    ];
    saveFlowsMutation.mutate({ apiId: Number(selectedApiId), flows });
  }

  const apiList = (apis as any[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Designer</h1>
          <p className="text-muted-foreground">Visual policy flow editor — configure request and response processing chains</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={saveFlows} disabled={!selectedApiId || saveFlowsMutation.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveFlowsMutation.isPending ? "Saving..." : "Save Flows"}
        </Button>
      </div>

      {/* API Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Target API</Label>
              <Select value={selectedApiId} onValueChange={setSelectedApiId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select API to configure flows..." />
                </SelectTrigger>
                <SelectContent>
                  {apiList.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name} {a.version && `(${a.version})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedApi && (
              <div className="text-sm text-muted-foreground pt-5">
                <span className="font-mono text-xs">{selectedApi.contextPath}</span>
                {selectedApi.openApiSpec?.policyFlows?.length > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700">
                    {selectedApi.openApiSpec.policyFlows.length} saved flows
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Policy */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <Select value={addPhase} onValueChange={v => setAddPhase(v as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="request">Request</SelectItem>
                <SelectItem value="response">Response</SelectItem>
              </SelectContent>
            </Select>
            <Select value={addType} onValueChange={setAddType}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select policy to add..." /></SelectTrigger>
              <SelectContent>
                {AVAILABLE_POLICIES.map(p => (
                  <SelectItem key={p.type} value={p.type}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addPolicy} disabled={!addType} className="bg-amber-500 hover:bg-amber-600 text-white">
              <Plus className="w-4 h-4 mr-1" />Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Visual Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Phase */}
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <ArrowRight className="w-5 h-5" />
              Request Phase
              <Badge variant="outline" className="ml-auto bg-blue-100 text-blue-700">{requestPolicies.length} policies</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-dashed">
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center"><Globe className="w-4 h-4 text-gray-600" /></div>
                <span className="text-sm font-medium text-gray-600">Client Request</span>
              </div>
              <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>

              {requestPolicies.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No request policies — add one above</p>
              )}

              {requestPolicies.map((policy, idx) => (
                <div key={policy.id}>
                  <div className="flex items-center gap-2 p-3 border rounded-lg hover:shadow-sm transition-shadow group">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${policy.color}`}>
                      <policy.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{policy.label}</span>
                      <div className="text-xs text-muted-foreground">Order: {idx + 1}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openConfig(policy)}><Settings className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removePolicy(policy.id, "request")}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  {idx < requestPolicies.length - 1 && <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>}
                </div>
              ))}

              <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <div className="w-8 h-8 bg-amber-200 rounded flex items-center justify-center"><Zap className="w-4 h-4 text-amber-700" /></div>
                <span className="text-sm font-medium text-amber-700">→ Backend</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backend */}
        <Card className="border-amber-200">
          <CardHeader className="bg-amber-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <Zap className="w-5 h-5" />
              Backend / Upstream
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4 text-center py-8">
              <div className="w-16 h-16 bg-amber-100 rounded-xl mx-auto flex items-center justify-center">
                <Zap className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Target Endpoint</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {selectedApi?.backendUrl ?? "No API selected"}
                </code>
              </div>
              {selectedApi && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Protocol: {selectedApi.protocol?.toUpperCase()}</p>
                  <p>Context: {selectedApi.contextPath}</p>
                  <p>Version: {selectedApi.version}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Response Phase */}
        <Card className="border-green-200">
          <CardHeader className="bg-green-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <ArrowRight className="w-5 h-5 rotate-180" />
              Response Phase
              <Badge variant="outline" className="ml-auto bg-green-100 text-green-700">{responsePolicies.length} policies</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                <div className="w-8 h-8 bg-amber-200 rounded flex items-center justify-center"><Zap className="w-4 h-4 text-amber-700" /></div>
                <span className="text-sm font-medium text-amber-700">Backend Response ←</span>
              </div>
              <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>

              {responsePolicies.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No response policies — add one above</p>
              )}

              {responsePolicies.map((policy, idx) => (
                <div key={policy.id}>
                  <div className="flex items-center gap-2 p-3 border rounded-lg hover:shadow-sm transition-shadow group">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-grab" />
                    <div className={`w-8 h-8 rounded flex items-center justify-center ${policy.color}`}>
                      <policy.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium">{policy.label}</span>
                      <div className="text-xs text-muted-foreground">Order: {idx + 1}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => openConfig(policy)}><Settings className="w-3 h-3" /></Button>
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 text-red-500" onClick={() => removePolicy(policy.id, "response")}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  {idx < responsePolicies.length - 1 && <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>}
                </div>
              ))}

              <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-dashed">
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center"><Globe className="w-4 h-4 text-gray-600" /></div>
                <span className="text-sm font-medium text-gray-600">→ Client Response</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Policy Config Dialog */}
      <Dialog open={!!configNode} onOpenChange={open => { if (!open) setConfigNode(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure: {configNode?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-xs text-muted-foreground">JSON configuration — edit fields then save</Label>
            <Textarea value={configJson} onChange={e => setConfigJson(e.target.value)} rows={12} className="font-mono text-xs" />
            <Button className="w-full" onClick={saveConfig}>Apply Configuration</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Available Policies Reference */}
      <Card>
        <CardHeader><CardTitle className="text-base">Available Policies</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {AVAILABLE_POLICIES.map(p => (
              <div key={p.type} className="flex items-center gap-2 p-2 border rounded-lg">
                <div className={`w-7 h-7 rounded flex items-center justify-center ${p.color}`}>
                  <p.icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
