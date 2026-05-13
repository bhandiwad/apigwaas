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
import { Workflow, Plus, ArrowRight, Shield, Zap, Clock, Eye, Filter } from "lucide-react";

const POLICY_TYPES = [
  { value: "rate-limit", label: "Rate Limit", icon: Clock, color: "text-blue-600" },
  { value: "ip-filtering", label: "IP Filtering", icon: Filter, color: "text-red-600" },
  { value: "jwt-validation", label: "JWT Validation", icon: Shield, color: "text-green-600" },
  { value: "data-masking", label: "Data Masking", icon: Eye, color: "text-purple-600" },
  { value: "transform-headers", label: "Transform Headers", icon: Zap, color: "text-orange-600" },
  { value: "cache", label: "Cache", icon: Zap, color: "text-cyan-600" },
  { value: "cors", label: "CORS", icon: Shield, color: "text-teal-600" },
  { value: "circuit-breaker", label: "Circuit Breaker", icon: Zap, color: "text-red-600" },
  { value: "retry", label: "Retry", icon: Clock, color: "text-yellow-600" },
  { value: "logging", label: "Logging", icon: Eye, color: "text-gray-600" },
];

export default function PolicyChains() {
  const [open, setOpen] = useState(false);
  const [apiId, setApiId] = useState("");
  const [phase, setPhase] = useState<"request" | "response" | "connect" | "subscribe" | "publish">("request");
  const [policyType, setPolicyType] = useState("rate-limit");
  const [order, setOrder] = useState(0);
  const [condition, setCondition] = useState("");

  const { data: chains, refetch } = trpc.policyChain.list.useQuery({ apiId: apiId ? Number(apiId) : 0 }, { enabled: !!apiId });
  const addPolicy = trpc.policyChain.add.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Policy added to chain"); },
  });
  const removePolicy = trpc.policyChain.remove.useMutation({
    onSuccess: () => { refetch(); toast.success("Policy removed"); },
  });
  // reorder not available as separate mutation

  const phaseColor = (p: string) => {
    switch (p) {
      case "request": return "bg-blue-100 text-blue-700";
      case "response": return "bg-green-100 text-green-700";
      case "on_error": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getPolicyIcon = (type: string) => {
    const p = POLICY_TYPES.find(pt => pt.value === type);
    if (!p) return <Zap className="w-4 h-4" />;
    const Icon = p.icon;
    return <Icon className={`w-4 h-4 ${p.color}`} />;
  };

  // Group chains by phase
  const requestChain = chains?.filter((c: any) => c.phase === "request") || [];
  const responseChain = chains?.filter((c: any) => c.phase === "response") || [];
  const errorChain = chains?.filter((c: any) => c.phase === "on_error") || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policy Chains</h1>
          <p className="text-muted-foreground">Visual policy flow editor — configure request/response/error processing chains</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Policy to Chain</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>API ID</Label><Input type="number" value={apiId} onChange={e => setApiId(e.target.value)} placeholder="Target API" /></div>
              <div><Label>Phase</Label>
                <Select value={phase} onValueChange={v => setPhase(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="request">Request (pre-backend)</SelectItem>
                    <SelectItem value="response">Response (post-backend)</SelectItem>
                    <SelectItem value="connect">Connect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Policy Type</Label>
                <Select value={policyType} onValueChange={setPolicyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Order (0 = first)</Label><Input type="number" value={order} onChange={e => setOrder(Number(e.target.value))} /></div>
              <div><Label>Condition (optional SpEL)</Label><Input value={condition} onChange={e => setCondition(e.target.value)} placeholder="#request.headers['x-env'] == 'prod'" className="font-mono text-xs" /></div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!apiId || addPolicy.isPending}
                onClick={() => addPolicy.mutate({ apiId: Number(apiId), tenantId: 1, phase, policyId: POLICY_TYPES.findIndex(p => p.value === policyType) + 1, order, condition: condition || undefined, configuration: {} })}>
                {addPolicy.isPending ? "Adding..." : "Add to Chain"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Selector */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Select API:</Label>
            <Input type="number" value={apiId} onChange={e => setApiId(e.target.value)} placeholder="Enter API ID to view its policy chain" className="max-w-xs" />
          </div>
        </CardContent>
      </Card>

      {/* Policy Chain Visualization */}
      {apiId && (
        <div className="space-y-6">
          {/* Request Phase */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className="bg-blue-100 text-blue-700">REQUEST</Badge>
                <span>Pre-Backend Processing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {requestChain.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium">Client</div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  {requestChain.map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="border-2 border-blue-200 rounded-lg px-3 py-2 bg-blue-50 flex items-center gap-2 group relative">
                        {getPolicyIcon(p.policyType)}
                        <span className="text-sm font-medium">{POLICY_TYPES.find(pt => pt.value === p.policyType)?.label || p.policyType}</span>
                        {p.condition && <Badge variant="outline" className="text-xs">conditional</Badge>}
                        <button className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePolicy.mutate({ id: p.id })}>×</button>
                      </div>
                      {idx < requestChain.length - 1 && <ArrowRight className="w-4 h-4 text-blue-400" />}
                    </div>
                  ))}
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="bg-amber-100 rounded-lg px-3 py-2 text-sm font-medium text-amber-700">Backend</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No request policies. Add policies to process requests before they reach the backend.</p>
              )}
            </CardContent>
          </Card>

          {/* Response Phase */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className="bg-green-100 text-green-700">RESPONSE</Badge>
                <span>Post-Backend Processing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {responseChain.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="bg-amber-100 rounded-lg px-3 py-2 text-sm font-medium text-amber-700">Backend</div>
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  {responseChain.map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="border-2 border-green-200 rounded-lg px-3 py-2 bg-green-50 flex items-center gap-2 group relative">
                        {getPolicyIcon(p.policyType)}
                        <span className="text-sm font-medium">{POLICY_TYPES.find(pt => pt.value === p.policyType)?.label || p.policyType}</span>
                        {p.condition && <Badge variant="outline" className="text-xs">conditional</Badge>}
                        <button className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePolicy.mutate({ id: p.id })}>×</button>
                      </div>
                      {idx < responseChain.length - 1 && <ArrowRight className="w-4 h-4 text-green-400" />}
                    </div>
                  ))}
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm font-medium">Client</div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No response policies. Add policies to transform responses before sending to the client.</p>
              )}
            </CardContent>
          </Card>

          {/* Error Phase */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Badge className="bg-red-100 text-red-700">ON ERROR</Badge>
                <span>Error Handling</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errorChain.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                  {errorChain.map((p: any, idx: number) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="border-2 border-red-200 rounded-lg px-3 py-2 bg-red-50 flex items-center gap-2 group relative">
                        {getPolicyIcon(p.policyType)}
                        <span className="text-sm font-medium">{POLICY_TYPES.find(pt => pt.value === p.policyType)?.label || p.policyType}</span>
                        <button className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePolicy.mutate({ id: p.id })}>×</button>
                      </div>
                      {idx < errorChain.length - 1 && <ArrowRight className="w-4 h-4 text-red-400" />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No error policies. Add policies to handle errors gracefully.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!apiId && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">Select an API</h3>
            <p className="text-muted-foreground text-sm">Enter an API ID above to view and edit its policy chain</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
