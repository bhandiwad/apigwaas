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
import { Fingerprint, Plus, CheckCircle2, AlertCircle, Users } from "lucide-react";

export default function IdentityProviders() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"oidc" | "saml" | "ldap">("oidc");
  const [issuerUrl, setIssuerUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [jitProvisioning, setJitProvisioning] = useState(true);
  const [scimEnabled, setScimEnabled] = useState(false);

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: providers, refetch } = trpc.idp.list.useQuery({ tenantId });
  const createIdp = trpc.idp.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Identity provider created"); resetForm(); },
  });
  const updateIdp = trpc.idp.update.useMutation({ onSuccess: () => { refetch(); toast.success("Provider updated"); } });

  function resetForm() { setName(""); setType("oidc"); setIssuerUrl(""); setClientId(""); setDiscoveryUrl(""); }

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700";
      case "testing": return "bg-blue-100 text-blue-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const typeIcon = (t: string) => {
    switch (t) {
      case "oidc": return "🔐";
      case "saml": return "📜";
      case "ldap": return "📂";
      default: return "🔑";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Identity Providers (F-04)</h1>
          <p className="text-muted-foreground">Configure OIDC, SAML, and LDAP identity providers with JIT provisioning and SCIM</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Provider</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Configure Identity Provider</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Provider Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Corporate SSO" /></div>
              <div><Label>Type</Label>
                <Select value={type} onValueChange={v => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oidc">OpenID Connect (OIDC)</SelectItem>
                    <SelectItem value="saml">SAML 2.0</SelectItem>
                    <SelectItem value="ldap">LDAP / Active Directory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {type === "oidc" && (
                <>
                  <div><Label>Issuer URL</Label><Input value={issuerUrl} onChange={e => setIssuerUrl(e.target.value)} placeholder="https://idp.example.com/realms/main" /></div>
                  <div><Label>Client ID</Label><Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="gravitee-apigw" /></div>
                  <div><Label>Discovery URL (optional)</Label><Input value={discoveryUrl} onChange={e => setDiscoveryUrl(e.target.value)} placeholder="https://idp.example.com/.well-known/openid-configuration" /></div>
                </>
              )}
              {type === "saml" && (
                <div><Label>SAML Metadata URL</Label><Input value={discoveryUrl} onChange={e => setDiscoveryUrl(e.target.value)} placeholder="https://idp.example.com/saml/metadata" /></div>
              )}
              {type === "ldap" && (
                <div><Label>LDAP Server URL</Label><Input value={issuerUrl} onChange={e => setIssuerUrl(e.target.value)} placeholder="ldaps://ldap.example.com:636" /></div>
              )}
              <div className="flex items-center justify-between">
                <Label>JIT Provisioning</Label>
                <Switch checked={jitProvisioning} onCheckedChange={setJitProvisioning} />
              </div>
              <div className="flex items-center justify-between">
                <Label>SCIM Sync</Label>
                <Switch checked={scimEnabled} onCheckedChange={setScimEnabled} />
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || createIdp.isPending}
                onClick={() => createIdp.mutate({ tenantId, name, type, issuerUrl: issuerUrl || undefined, clientId: clientId || undefined, discoveryUrl: discoveryUrl || undefined, jitProvisioning, scimEnabled })}>
                {createIdp.isPending ? "Creating..." : "Add Provider"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers?.map((idp: any) => (
          <Card key={idp.id} className="border-l-4 border-l-amber-400">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{typeIcon(idp.type)}</span>
                  <div>
                    <CardTitle className="text-lg">{idp.name}</CardTitle>
                    <p className="text-sm text-muted-foreground uppercase">{idp.type}</p>
                  </div>
                </div>
                <Badge className={statusColor(idp.status)}>{idp.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {idp.issuerUrl && <div className="text-sm"><span className="text-muted-foreground">Issuer:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{idp.issuerUrl}</code></div>}
              {idp.clientId && <div className="text-sm"><span className="text-muted-foreground">Client ID:</span> <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{idp.clientId}</code></div>}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  {idp.jitProvisioning ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-gray-400" />}
                  <span>JIT Provisioning</span>
                </div>
                <div className="flex items-center gap-1">
                  {idp.scimEnabled ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <AlertCircle className="w-3 h-3 text-gray-400" />}
                  <span>SCIM</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                {idp.status === "inactive" && (
                  <Button size="sm" variant="outline" onClick={() => updateIdp.mutate({ id: idp.id, status: "testing" })}>Test Connection</Button>
                )}
                {idp.status === "testing" && (
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateIdp.mutate({ id: idp.id, status: "active" })}>Activate</Button>
                )}
                {idp.status === "active" && (
                  <Button size="sm" variant="outline" onClick={() => updateIdp.mutate({ id: idp.id, status: "inactive" })}>Deactivate</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!providers || providers.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Fingerprint className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Identity Providers</h3>
            <p className="text-muted-foreground text-sm mb-4">Configure SSO with OIDC, SAML, or LDAP for your tenant users</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Add Provider
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
