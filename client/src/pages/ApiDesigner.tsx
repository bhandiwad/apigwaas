import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, ArrowDown, Plus, Settings, Trash2, GripVertical, Shield, Zap, Eye, Lock, Globe, Code } from "lucide-react";

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

export default function ApiDesigner() {
  const [requestPolicies, setRequestPolicies] = useState<PolicyNode[]>([
    { id: "1", type: "jwt-validation", label: "JWT Validation", phase: "request", icon: Lock, color: "bg-blue-100 text-blue-700" },
    { id: "2", type: "rate-limit", label: "Rate Limiting", phase: "request", icon: Zap, color: "bg-amber-100 text-amber-700" },
    { id: "3", type: "ip-filtering", label: "IP Filtering", phase: "request", icon: Shield, color: "bg-red-100 text-red-700" },
  ]);
  const [responsePolicies, setResponsePolicies] = useState<PolicyNode[]>([
    { id: "4", type: "data-masking", label: "Data Masking", phase: "response", icon: Eye, color: "bg-purple-100 text-purple-700" },
    { id: "5", type: "transform-headers", label: "Transform Headers", phase: "response", icon: Code, color: "bg-cyan-100 text-cyan-700" },
  ]);
  const [addPhase, setAddPhase] = useState<"request" | "response">("request");
  const [addType, setAddType] = useState("");

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
    if (addPhase === "request") {
      setRequestPolicies([...requestPolicies, newNode]);
    } else {
      setResponsePolicies([...responsePolicies, newNode]);
    }
    setAddType("");
    toast.success(`Added ${policyDef.label} to ${addPhase} phase`);
  }

  function removePolicy(id: string, phase: "request" | "response") {
    if (phase === "request") {
      setRequestPolicies(requestPolicies.filter(p => p.id !== id));
    } else {
      setResponsePolicies(responsePolicies.filter(p => p.id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Designer</h1>
          <p className="text-muted-foreground">Visual policy flow editor — configure request and response processing chains</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => toast.success("Policy chain saved")}>
          Save Configuration
        </Button>
      </div>

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
              {/* Client Entry */}
              <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-dashed">
                <div className="w-8 h-8 bg-gray-200 rounded flex items-center justify-center"><Globe className="w-4 h-4 text-gray-600" /></div>
                <span className="text-sm font-medium text-gray-600">Client Request</span>
              </div>
              <div className="flex justify-center"><ArrowDown className="w-4 h-4 text-gray-300" /></div>

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
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => toast.info("Configure policy — coming soon")}><Settings className="w-3 h-3" /></Button>
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
                <code className="text-xs bg-gray-100 px-2 py-1 rounded">https://api.backend.sify.com</code>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Load Balancing: Round Robin</p>
                <p>Health Check: /health (30s interval)</p>
                <p>Timeout: 30s connect, 60s read</p>
                <p>Retry: 3 attempts, exponential backoff</p>
              </div>
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
                    <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100" onClick={() => toast.info("Configure policy — coming soon")}><Settings className="w-3 h-3" /></Button>
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

      {/* Available Policies Reference */}
      <Card>
        <CardHeader><CardTitle>Available Policies</CardTitle></CardHeader>
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
