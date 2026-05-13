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
import { EyeOff, Plus, Shield, Code, Trash2 } from "lucide-react";

const PREBUILT_RULES = [
  { name: "PAN Card Masking", jsonPath: "$.pan", category: "pan_card" as const, action: "partial" as const, showLastN: 4 },
  { name: "Aadhaar Masking", jsonPath: "$.aadhaar", category: "aadhaar" as const, action: "partial" as const, showLastN: 4 },
  { name: "Credit Card Masking", jsonPath: "$.cardNumber", category: "credit_card" as const, action: "partial" as const, showLastN: 4 },
  { name: "Email Redaction", jsonPath: "$.email", category: "email" as const, action: "hash_sha256" as const },
  { name: "Phone Masking", jsonPath: "$.phone", category: "phone" as const, action: "partial" as const, showLastN: 4 },
  { name: "IFSC Code", jsonPath: "$.ifsc", category: "ifsc" as const, action: "redact" as const },
];

export default function DataMasking() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [jsonPath, setJsonPath] = useState("");
  const [action, setAction] = useState<"full_replace" | "partial" | "hash_sha256" | "redact">("partial");
  const [category, setCategory] = useState<"pan_card" | "aadhaar" | "credit_card" | "email" | "phone" | "iban" | "ifsc" | "custom">("custom");
  const [phase, setPhase] = useState<"request" | "response" | "both">("both");
  const [replacement, setReplacement] = useState("");
  const [showLastN, setShowLastN] = useState(4);
  const [priority, setPriority] = useState(0);

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: rules, refetch } = trpc.masking.rules.useQuery({ tenantId });
  const createRule = trpc.masking.createRule.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Masking rule created"); resetForm(); },
  });
  const updateRule = trpc.masking.updateRule.useMutation({ onSuccess: () => refetch() });
  const deleteRule = trpc.masking.deleteRule.useMutation({
    onSuccess: () => { refetch(); toast.success("Rule deleted"); },
  });

  function resetForm() { setName(""); setJsonPath(""); setAction("partial"); setCategory("custom"); setPhase("both"); setReplacement(""); setShowLastN(4); }

  function applyPrebuilt(rule: typeof PREBUILT_RULES[0]) {
    createRule.mutate({ tenantId, name: rule.name, jsonPath: rule.jsonPath, action: rule.action, category: rule.category, phase: "response", showLastN: rule.showLastN, priority: 0 });
  }

  const actionLabel = (a: string) => {
    switch (a) {
      case "full_replace": return "Full Replace";
      case "partial": return "Partial Mask";
      case "hash_sha256": return "SHA-256 Hash";
      case "redact": return "Redact";
      default: return a;
    }
  };

  const categoryColor = (c: string) => {
    const colors: Record<string, string> = {
      pan_card: "bg-purple-100 text-purple-700",
      aadhaar: "bg-blue-100 text-blue-700",
      credit_card: "bg-red-100 text-red-700",
      email: "bg-green-100 text-green-700",
      phone: "bg-orange-100 text-orange-700",
      custom: "bg-gray-100 text-gray-700",
    };
    return colors[c] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Data Masking (F-01)</h1>
          <p className="text-muted-foreground">Configure JSONPath-based data masking rules for API responses</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create Masking Rule</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Rule Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="PAN Card Masking" /></div>
              <div><Label>JSONPath Expression</Label><Input value={jsonPath} onChange={e => setJsonPath(e.target.value)} placeholder="$.response.body.pan" className="font-mono text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Action</Label>
                  <Select value={action} onValueChange={v => setAction(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_replace">Full Replace</SelectItem>
                      <SelectItem value="partial">Partial Mask</SelectItem>
                      <SelectItem value="hash_sha256">SHA-256 Hash</SelectItem>
                      <SelectItem value="redact">Redact</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label>
                  <Select value={category} onValueChange={v => setCategory(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pan_card">PAN Card</SelectItem>
                      <SelectItem value="aadhaar">Aadhaar</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="iban">IBAN</SelectItem>
                      <SelectItem value="ifsc">IFSC</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phase</Label>
                  <Select value={phase} onValueChange={v => setPhase(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="request">Request</SelectItem>
                      <SelectItem value="response">Response</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Show Last N Chars</Label><Input type="number" value={showLastN} onChange={e => setShowLastN(Number(e.target.value))} /></div>
              </div>
              {action === "full_replace" && <div><Label>Replacement Value</Label><Input value={replacement} onChange={e => setReplacement(e.target.value)} placeholder="[REDACTED]" /></div>}
              <div><Label>Priority (lower = first)</Label><Input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} /></div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || !jsonPath || createRule.isPending}
                onClick={() => createRule.mutate({ tenantId, name, jsonPath, action, category, phase, replacement: replacement || undefined, showLastN, priority })}>
                {createRule.isPending ? "Creating..." : "Create Rule"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pre-built Rulesets */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-600" />Pre-built Rulesets (India Compliance)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {PREBUILT_RULES.map(rule => (
              <Button key={rule.name} variant="outline" size="sm" className="h-auto py-2 flex flex-col items-center gap-1" onClick={() => applyPrebuilt(rule)}>
                <EyeOff className="w-4 h-4 text-amber-600" />
                <span className="text-xs text-center">{rule.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Rules */}
      <Card>
        <CardHeader><CardTitle>Active Masking Rules</CardTitle></CardHeader>
        <CardContent>
          {rules && rules.length > 0 ? (
            <div className="space-y-3">
              {rules.map((rule: any) => (
                <div key={rule.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Switch checked={rule.enabled} onCheckedChange={checked => updateRule.mutate({ id: rule.id, enabled: checked })} />
                    <div>
                      <div className="font-medium text-sm">{rule.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{rule.jsonPath}</code>
                        <Badge className={categoryColor(rule.category)} variant="outline">{rule.category?.replace("_", " ")}</Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{actionLabel(rule.action)}</Badge>
                    <Badge variant="outline" className="capitalize">{rule.phase}</Badge>
                    <span className="text-xs text-muted-foreground">P{rule.priority}</span>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteRule.mutate({ id: rule.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Code className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No masking rules configured. Add rules or apply pre-built rulesets above.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
