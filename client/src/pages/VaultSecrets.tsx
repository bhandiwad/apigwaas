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
import { KeyRound, Plus, RefreshCw, Lock, Clock, Database } from "lucide-react";

export default function VaultSecrets() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [vaultPath, setVaultPath] = useState("");
  const [secretEngine, setSecretEngine] = useState<"kv_v2" | "dynamic_db" | "pki" | "transit">("kv_v2");
  const [cacheTtl, setCacheTtl] = useState(300);
  const [elExpression, setElExpression] = useState("");
  const [mountPath, setMountPath] = useState("secret");

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: policies, refetch } = trpc.policy.list.useQuery({ tenantId });
  const vaultPolicies = policies?.filter((p: any) => p.type === "vault_secret") || [];
  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Vault secret resource created"); resetForm(); },
  });

  function resetForm() { setName(""); setVaultPath(""); setSecretEngine("kv_v2"); setCacheTtl(300); setElExpression(""); setMountPath("secret"); }

  const engineLabel = (e: string) => {
    const labels: Record<string, string> = { kv_v2: "KV v2", dynamic_db: "Dynamic DB Creds", pki: "PKI Certificates", transit: "Transit Encryption" };
    return labels[e] || e;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vault Secret Resources (F-09)</h1>
          <p className="text-muted-foreground">HashiCorp Vault integration for dynamic secrets, KV v2, and certificate management</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Secret Resource</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Configure Vault Secret Resource</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Resource Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="db-credentials-prod" /></div>
              <div><Label>Secret Engine</Label>
                <Select value={secretEngine} onValueChange={v => setSecretEngine(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kv_v2">KV v2 (Static Secrets)</SelectItem>
                    <SelectItem value="dynamic_db">Dynamic Database Credentials</SelectItem>
                    <SelectItem value="pki">PKI (Certificates)</SelectItem>
                    <SelectItem value="transit">Transit (Encryption as a Service)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Mount Path</Label><Input value={mountPath} onChange={e => setMountPath(e.target.value)} placeholder="secret" className="font-mono" /></div>
              <div><Label>Vault Path</Label><Input value={vaultPath} onChange={e => setVaultPath(e.target.value)} placeholder="data/api-gateway/db-creds" className="font-mono" /></div>
              <div><Label>Cache TTL (seconds)</Label><Input type="number" value={cacheTtl} onChange={e => setCacheTtl(Number(e.target.value))} /></div>
              <div>
                <Label>EL Expression (Gravitee Expression Language)</Label>
                <Input value={elExpression} onChange={e => setElExpression(e.target.value)} placeholder="{#vault.get('secret/data/api-key')}" className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground mt-1">Use EL to reference secrets in policy configurations</p>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || !vaultPath || createPolicy.isPending}
                onClick={() => createPolicy.mutate({ tenantId, name, type: "vault_secret", configuration: { secretEngine, mountPath, vaultPath, cacheTtl, elExpression } })}>
                {createPolicy.isPending ? "Creating..." : "Create Secret Resource"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vault Connection Status */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">HashiCorp Vault Connected</p>
                <p className="text-sm text-green-700 mt-1">Vault cluster: <code className="bg-green-100 px-1 rounded">https://vault.cloudinfinit.sify.com:8200</code></p>
                <p className="text-xs text-green-600 mt-1">Auth: AppRole • Namespace: cloudinfinit/prod • Seal Status: Unsealed</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-700">Connected</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Secret Resources */}
      <Card>
        <CardHeader><CardTitle>Configured Secret Resources</CardTitle></CardHeader>
        <CardContent>
          {vaultPolicies.length > 0 ? (
            <div className="space-y-3">
              {vaultPolicies.map((policy: any) => {
                const config = policy.configuration as any;
                return (
                  <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <KeyRound className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <div className="font-medium">{policy.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{engineLabel(config?.secretEngine)}</Badge>
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{config?.mountPath}/{config?.vaultPath}</code>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />TTL: {config?.cacheTtl}s</span>
                          {config?.elExpression && <span className="flex items-center gap-1"><Database className="w-3 h-3" />EL: {config?.elExpression}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline"><RefreshCw className="w-3 h-3 mr-1" />Refresh</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <KeyRound className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No Vault secret resources configured. Add resources to use dynamic secrets in your API policies.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
