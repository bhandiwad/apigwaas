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

  const typeColors: Record<string, string> = {
    masking: "bg-purple-100 text-purple-700", rate_limit: "bg-amber-100 text-amber-700", geoip: "bg-blue-100 text-blue-700",
    vault_secret: "bg-emerald-100 text-emerald-700", cors: "bg-pink-100 text-pink-700", ip_filtering: "bg-orange-100 text-orange-700",
    jwt_validation: "bg-teal-100 text-teal-700", oauth2: "bg-indigo-100 text-indigo-700",
  };

  const policyList = (policies as any[]) || [];
  const byApi: Record<string, any[]> = {};
  const noApi: any[] = [];
  policyList.forEach((p: any) => {
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
