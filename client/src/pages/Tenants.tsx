import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function TenantsPage() {
  const { data: tenants, isLoading, refetch } = trpc.tenant.list.useQuery();
  const createMutation = trpc.tenant.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Tenant created"); } });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", tier: "starter" as const, gstin: "", pan: "", contactEmail: "", region: "mumbai" });

  const filtered = (tenants || []).filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase()));

  const tierColors: Record<string, string> = { starter: "bg-blue-100 text-blue-700", business: "bg-amber-100 text-amber-700", enterprise: "bg-purple-100 text-purple-700", sovereign: "bg-emerald-100 text-emerald-700" };
  const statusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", provisioning: "bg-amber-100 text-amber-700", suspended: "bg-red-100 text-red-700", offboarding: "bg-gray-100 text-gray-700", terminated: "bg-gray-200 text-gray-500" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage organizations and their tier configurations</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add Tenant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Tenant</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Organization Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Acme Corp" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Tier</Label>
                  <Select value={form.tier} onValueChange={v => setForm({...form, tier: v as any})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="sovereign">Sovereign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Region</Label><Input value={form.region} onChange={e => setForm({...form, region: e.target.value})} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>GSTIN</Label><Input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} placeholder="22AAAAA0000A1Z5" /></div>
                <div><Label>PAN</Label><Input value={form.pan} onChange={e => setForm({...form, pan: e.target.value})} placeholder="AAAAA0000A" /></div>
              </div>
              <div><Label>Contact Email</Label><Input type="email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Tenant"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search tenants..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i} className="animate-pulse h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No tenants found</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tenant: any) => (
            <Card key={tenant.id} className="border border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{tenant.name}</h3>
                      <p className="text-xs text-muted-foreground">{tenant.slug}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className={tierColors[tenant.tier] || ""}>{tenant.tier}</Badge>
                  <Badge variant="secondary" className={statusColors[tenant.status] || ""}>{tenant.status}</Badge>
                  <Badge variant="outline" className="text-xs">{tenant.region}</Badge>
                </div>
                <div className="mt-3 text-xs text-muted-foreground space-y-0.5">
                  {tenant.gstin && <p>GSTIN: {tenant.gstin}</p>}
                  {tenant.contactEmail && <p>{tenant.contactEmail}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
