import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Shield, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PoliciesPage() {
  const { data: policies, isLoading, refetch } = trpc.policy.list.useQuery({});
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList = (apis as any[]) || [];

  const createMutation = trpc.policy.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Policy created"); } });
  const updateMutation = trpc.policy.update.useMutation({ onSuccess: () => refetch() });
  const deleteMutation = trpc.policy.delete.useMutation({ onSuccess: () => { refetch(); setDeleteId(null); toast.success("Policy deleted"); } });

  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", apiId: "", type: "rate_limit" as const, phase: "both" as const });

  // IP / CIDR access control — enforced at the gateway via the ip-filtering policy.
  const [ipOpen, setIpOpen] = useState(false);
  const [ipForm, setIpForm] = useState({ name: "", apiId: "", mode: "deny" as "allow" | "deny", ips: "" });
  const createIpMutation = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setIpOpen(false); setIpForm({ name: "", apiId: "", mode: "deny", ips: "" }); toast.success("IP filter created — deploy it to enforce"); },
    onError: (e) => toast.error(e.message),
  });
  const deployIp = trpc.policy.deployIpFiltering.useMutation({
    onSuccess: (r: any) => toast.success(`IP filtering enforced (${r.whitelist} allow, ${r.blacklist} deny)`),
    onError: (e) => toast.error(e.message),
  });

  const typeColors: Record<string, string> = {
    masking: "bg-purple-100 text-purple-700", rate_limit: "bg-amber-100 text-amber-700", geoip: "bg-blue-100 text-blue-700",
    vault_secret: "bg-emerald-100 text-emerald-700", cors: "bg-pink-100 text-pink-700", ip_filtering: "bg-orange-100 text-orange-700",
    jwt_validation: "bg-teal-100 text-teal-700", oauth2: "bg-indigo-100 text-indigo-700",
  };

  const policyList = (policies as any[]) || [];
  const ipPolicies = policyList.filter((p: any) => p.type === "ip_filtering");
  const ipApiIds = Array.from(new Set(ipPolicies.map((p: any) => p.configuration?.apiId).filter((x: any) => x != null)));
  const apiName = (id: number) => apiList.find((a: any) => a.id === id)?.name || `API ${id}`;
  const byApi: Record<string, any[]> = {};
  const noApi: any[] = [];
  policyList.forEach((p: any) => {
    if (p.type === "ip_filtering") return; // shown in the dedicated IP section below
    if (p.apiId) {
      if (!byApi[p.apiId]) byApi[p.apiId] = [];
      byApi[p.apiId].push(p);
    } else {
      noApi.push(p);
    }
  });

  const PolicyRow = ({ policy }: { policy: any }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="h-4 w-4 text-primary" /></div>
        <div>
          <h3 className="font-semibold text-sm">{policy.name}</h3>
          <p className="text-xs text-muted-foreground">Phase: {policy.phase} · Priority: {policy.priority}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={typeColors[policy.type] || ""}>{policy.type.replace(/_/g, " ")}</Badge>
        <Switch
          checked={policy.enabled}
          onCheckedChange={(checked) => {
            updateMutation.mutate({ id: policy.id, enabled: checked });
            toast.success(checked ? `"${policy.name}" enabled` : `"${policy.name}" disabled`);
          }}
        />
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7 p-0" onClick={() => setDeleteId(policy.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure data masking, rate limiting, GeoIP, and security policies</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add Policy</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Policy</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Policy Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Global Rate Limit" /></div>
              <div><Label>API (optional — leave blank for global)</Label>
                <Select value={form.apiId || "global"} onValueChange={v => setForm({...form, apiId: v === "global" ? "" : v})}>
                  <SelectTrigger><SelectValue placeholder="All APIs (global)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">All APIs (global)</SelectItem>
                    {apiList.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rate_limit">Rate Limit</SelectItem>
                    <SelectItem value="masking">Data Masking</SelectItem>
                    <SelectItem value="geoip">GeoIP Filtering</SelectItem>
                    <SelectItem value="vault_secret">Vault Secret</SelectItem>
                    <SelectItem value="cors">CORS</SelectItem>
                    <SelectItem value="ip_filtering">IP Filtering</SelectItem>
                    <SelectItem value="jwt_validation">JWT Validation</SelectItem>
                    <SelectItem value="oauth2">OAuth2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Phase</Label>
                <Select value={form.phase} onValueChange={v => setForm({...form, phase: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="request">Request</SelectItem>
                    <SelectItem value="response">Response</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate({ ...form, apiId: form.apiId ? parseInt(form.apiId) : undefined, configuration: {} })} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* IP / CIDR Access Control — enforced at the gateway */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">IP / CIDR Access Control</span>
            </div>
            <Dialog open={ipOpen} onOpenChange={setIpOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add IP Rule</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Create IP/CIDR Filter</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div><Label>Rule Name</Label><Input value={ipForm.name} onChange={e => setIpForm({...ipForm, name: e.target.value})} placeholder="Office-only access" /></div>
                  <div><Label>API</Label>
                    <Select value={ipForm.apiId} onValueChange={v => setIpForm({...ipForm, apiId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select API to enforce on" /></SelectTrigger>
                      <SelectContent>{apiList.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Mode</Label>
                    <Select value={ipForm.mode} onValueChange={v => setIpForm({...ipForm, mode: v as any})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="allow">Allow list (only these IPs/CIDRs)</SelectItem>
                        <SelectItem value="deny">Deny list (block these IPs/CIDRs)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>IPs / CIDRs (comma-separated)</Label><Input value={ipForm.ips} onChange={e => setIpForm({...ipForm, ips: e.target.value})} placeholder="10.0.0.0/8, 203.0.113.4" className="font-mono" /></div>
                  <Button className="w-full" disabled={!ipForm.name || !ipForm.apiId || !ipForm.ips || createIpMutation.isPending}
                    onClick={() => createIpMutation.mutate({ name: ipForm.name, type: "ip_filtering", configuration: { mode: ipForm.mode, ips: ipForm.ips.split(",").map(s => s.trim()).filter(Boolean), apiId: Number(ipForm.apiId) } })}>
                    {createIpMutation.isPending ? "Creating..." : "Create IP Filter"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {ipApiIds.length > 0 ? (
            <div className="space-y-3">
              {ipApiIds.map((aid: any) => (
                <div key={aid} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{apiName(aid)}</span>
                    <Button size="sm" variant="outline" disabled={deployIp.isPending} onClick={() => deployIp.mutate({ apiId: aid })}>
                      {deployIp.isPending ? "Deploying…" : "Deploy to Gateway"}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {ipPolicies.filter((p: any) => p.configuration?.apiId === aid).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={p.configuration?.mode === "allow" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>{p.configuration?.mode === "allow" ? "ALLOW" : "DENY"}</Badge>
                        <span className="font-medium">{p.name}</span>
                        <span className="font-mono text-muted-foreground">{(p.configuration?.ips as string[])?.join(", ")}</span>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive h-6 w-6 p-0 ml-auto" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No IP filters yet. Add an IP/CIDR rule and deploy it to enforce access control at the gateway.</p>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-16" />)}</div>
      ) : policyList.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No policies configured</p></CardContent></Card>
      ) : (
        <div className="space-y-6">
          {/* Per-API policies */}
          {Object.entries(byApi).map(([apiId, apiPolicies]) => {
            const api = apiList.find((a: any) => String(a.id) === apiId);
            return (
              <Card key={apiId}>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <span className="font-medium text-sm">{api?.name || `API #${apiId}`}</span>
                    <Badge variant="outline" className="text-xs">{apiPolicies.length} {apiPolicies.length === 1 ? "policy" : "policies"}</Badge>
                  </div>
                  <div className="space-y-2">
                    {apiPolicies.map((p: any) => <PolicyRow key={p.id} policy={p} />)}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Global policies */}
          {noApi.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm text-muted-foreground">Global Policies</span>
                  <Badge variant="outline" className="text-xs">{noApi.length}</Badge>
                </div>
                <div className="space-y-2">
                  {noApi.map((p: any) => <PolicyRow key={p.id} policy={p} />)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Policy</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mt-2">Are you sure you want to delete this policy? Any APIs using it will lose this protection.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: deleteId })}>
                {deleteMutation.isPending ? "Deleting..." : "Delete Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
