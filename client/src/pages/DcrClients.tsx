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
import { Key, Plus, RotateCcw, Copy, Shield, Ban } from "lucide-react";

export default function DcrClients() {
  const [open, setOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [grantTypes, setGrantTypes] = useState("client_credentials");
  const [tokenEndpointAuthMethod, setTokenEndpointAuthMethod] = useState("client_secret_basic");
  const [scope, setScope] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string; registrationAccessToken: string } | null>(null);

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: clients, refetch } = trpc.dcr.clients.useQuery({ tenantId });
  const register = trpc.dcr.register.useMutation({
    onSuccess: (data) => { refetch(); setCredentials({ clientId: data.clientId, clientSecret: data.clientSecret, registrationAccessToken: data.registrationAccessToken }); toast.success("Client registered via DCR"); },
  });
  const rotateSecret = trpc.dcr.rotateSecret.useMutation({
    onSuccess: (data) => { refetch(); toast.success("Secret rotated: " + data.clientSecret.slice(0, 8) + "..."); },
  });
  const updateStatus = trpc.dcr.updateStatus.useMutation({ onSuccess: () => { refetch(); toast.success("Status updated"); } });

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700";
      case "suspended": return "bg-yellow-100 text-yellow-700";
      case "revoked": return "bg-red-100 text-red-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dynamic Client Registration (F-06)</h1>
          <p className="text-muted-foreground">RFC 7591/7592 compliant client registration and management</p>
        </div>
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setCredentials(null); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Register Client</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{credentials ? "Client Registered Successfully" : "Register New Client (RFC 7591)"}</DialogTitle></DialogHeader>
            {credentials ? (
              <div className="space-y-4 pt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-green-800 mb-2">Save these credentials now — they won't be shown again.</p>
                </div>
                <div>
                  <Label>Client ID</Label>
                  <div className="flex gap-2"><Input readOnly value={credentials.clientId} className="font-mono text-xs" /><Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials.clientId)}><Copy className="w-3 h-3" /></Button></div>
                </div>
                <div>
                  <Label>Client Secret</Label>
                  <div className="flex gap-2"><Input readOnly value={credentials.clientSecret} className="font-mono text-xs" /><Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials.clientSecret)}><Copy className="w-3 h-3" /></Button></div>
                </div>
                <div>
                  <Label>Registration Access Token (RFC 7592)</Label>
                  <div className="flex gap-2"><Input readOnly value={credentials.registrationAccessToken} className="font-mono text-xs" /><Button size="sm" variant="outline" onClick={() => copyToClipboard(credentials.registrationAccessToken)}><Copy className="w-3 h-3" /></Button></div>
                </div>
                <Button className="w-full" variant="outline" onClick={() => { setOpen(false); setCredentials(null); setClientName(""); }}>Done</Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div><Label>Client Name</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="my-service-client" /></div>
                <div><Label>Grant Types</Label>
                  <Select value={grantTypes} onValueChange={setGrantTypes}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_credentials">Client Credentials</SelectItem>
                      <SelectItem value="authorization_code">Authorization Code</SelectItem>
                      <SelectItem value="authorization_code,refresh_token">Auth Code + Refresh Token</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Token Endpoint Auth Method</Label>
                  <Select value={tokenEndpointAuthMethod} onValueChange={setTokenEndpointAuthMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_secret_basic">client_secret_basic</SelectItem>
                      <SelectItem value="client_secret_post">client_secret_post</SelectItem>
                      <SelectItem value="private_key_jwt">private_key_jwt</SelectItem>
                      <SelectItem value="none">none (public client)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Redirect URIs (comma-separated)</Label><Input value={redirectUris} onChange={e => setRedirectUris(e.target.value)} placeholder="https://app.example.com/callback" /></div>
                <div><Label>Scope</Label><Input value={scope} onChange={e => setScope(e.target.value)} placeholder="read write admin" /></div>
                <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!clientName || register.isPending}
                  onClick={() => register.mutate({ tenantId, clientName, grantTypes: grantTypes.split(","), tokenEndpointAuthMethod, scope: scope || undefined, redirectUris: redirectUris ? redirectUris.split(",").map(u => u.trim()) : undefined })}>
                  {register.isPending ? "Registering..." : "Register Client"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* RFC Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">RFC 7591 / RFC 7592 Compliance</p>
              <p className="text-sm text-blue-700 mt-1">Clients can self-register via the <code className="bg-blue-100 px-1 rounded">/register</code> endpoint. Registration access tokens enable clients to update their own metadata per RFC 7592.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card>
        <CardHeader><CardTitle>Registered Clients</CardTitle></CardHeader>
        <CardContent>
          {clients && clients.length > 0 ? (
            <div className="space-y-3">
              {clients.map((client: any) => (
                <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <Key className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium">{client.clientName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">{client.clientId}</code>
                        <Badge className={statusColor(client.status)}>{client.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Auth: {client.tokenEndpointAuthMethod} • Grants: {(client.grantTypes as string[])?.join(", ")}
                        {client.lastRotatedAt && <> • Last rotated: {new Date(client.lastRotatedAt).toLocaleDateString()}</>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => rotateSecret.mutate({ id: client.id })} title="Rotate Secret">
                      <RotateCcw className="w-3 h-3 mr-1" />Rotate
                    </Button>
                    {client.status === "active" && (
                      <Button size="sm" variant="outline" className="text-yellow-600" onClick={() => updateStatus.mutate({ id: client.id, status: "suspended" })}>
                        <Ban className="w-3 h-3 mr-1" />Suspend
                      </Button>
                    )}
                    {client.status === "suspended" && (
                      <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateStatus.mutate({ id: client.id, status: "active" })}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No DCR clients registered. Use the button above or the /register endpoint.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
