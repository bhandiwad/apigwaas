import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PoliciesPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: policies, isLoading, refetch } = trpc.policy.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.policy.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Policy created"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "rate_limit" as const, phase: "both" as const });

  const typeColors: Record<string, string> = { masking: "bg-purple-100 text-purple-700", rate_limit: "bg-amber-100 text-amber-700", geoip: "bg-blue-100 text-blue-700", vault_secret: "bg-emerald-100 text-emerald-700", cors: "bg-pink-100 text-pink-700", ip_filtering: "bg-orange-100 text-orange-700", jwt_validation: "bg-teal-100 text-teal-700", oauth2: "bg-indigo-100 text-indigo-700" };

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
              <Button className="w-full" onClick={() => createMutation.mutate({ tenantId: defaultTenantId, ...form, configuration: {} })} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-16" />)}</div>
      ) : (policies as any[])?.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No policies configured</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(policies as any[])?.map((policy) => (
            <Card key={policy.id} className="border border-border/60 hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h3 className="font-semibold text-sm">{policy.name}</h3>
                    <p className="text-xs text-muted-foreground">Phase: {policy.phase} · Priority: {policy.priority}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={typeColors[policy.type] || ""}>{policy.type.replace("_", " ")}</Badge>
                  <Badge variant={policy.enabled ? "default" : "outline"} className={policy.enabled ? "bg-emerald-100 text-emerald-700" : ""}>{policy.enabled ? "Active" : "Disabled"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
