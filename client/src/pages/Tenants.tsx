import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Search, ChevronRight, Mail } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const tierLimitLabels: Record<string, string> = {
  starter: "1 workspace · 5 APIs · 50 apps · 1M calls/mo",
  business: "3 workspaces · 25 APIs · 500 apps · 10M calls/mo",
  enterprise: "10 workspaces · 200 APIs · 10K apps · 100M calls/mo",
  sovereign: "Unlimited workspaces, APIs, apps & calls",
};

export default function TenantsPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { data: tenants, isLoading, refetch } = trpc.tenant.list.useQuery();

  const createMutation = trpc.tenant.create.useMutation({
    onSuccess: async (data) => {
      refetch();
      utils.auth.me.invalidate();

      // If first-admin email provided, send invite atomically after tenant creation
      if (form.firstAdminEmail) {
        try {
          await inviteMutateAsync({
            email: form.firstAdminEmail,
            tenantRole: "admin",
            tenantId: data.id,
          });
          toast.success(`Tenant created and invite sent to ${form.firstAdminEmail}`);
        } catch {
          toast.success("Tenant created");
          toast.error("Failed to send invite — send it manually from the tenant page");
        }
      } else {
        toast.success("Tenant created");
      }
      setOpen(false);
      navigate(`/tenants/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const { mutateAsync: inviteMutateAsync } = trpc.tenant.invite.useMutation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    tier: "starter" as "starter" | "business" | "enterprise" | "sovereign",
    gstin: "",
    pan: "",
    contactEmail: "",
    region: "mumbai",
    firstAdminEmail: "",
  });

  const filtered = (tenants || []).filter((t: any) => t.name.toLowerCase().includes(search.toLowerCase()));

  const tierColors: Record<string, string> = {
    starter: "bg-blue-100 text-blue-700",
    business: "bg-amber-100 text-amber-700",
    enterprise: "bg-purple-100 text-purple-700",
    sovereign: "bg-emerald-100 text-emerald-700",
  };
  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    provisioning: "bg-amber-100 text-amber-700",
    suspended: "bg-red-100 text-red-700",
    offboarding: "bg-gray-100 text-gray-700",
    terminated: "bg-gray-200 text-gray-500",
  };

  function resetForm() {
    setForm({ name: "", tier: "starter", gstin: "", pan: "", contactEmail: "", region: "mumbai", firstAdminEmail: "" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage organisations and their configurations</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add Tenant</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Tenant</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Organisation Name</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Acme Corp" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tier</Label>
                  <Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v as typeof form.tier })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="sovereign">Sovereign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Region</Label>
                  <Input value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} />
                </div>
              </div>

              {form.tier && (
                <p className="text-xs text-muted-foreground px-0.5">{tierLimitLabels[form.tier]}</p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GSTIN</Label>
                  <Input value={form.gstin} onChange={e => setForm({ ...form, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div>
                  <Label>PAN</Label>
                  <Input value={form.pan} onChange={e => setForm({ ...form, pan: e.target.value })} placeholder="AAAAA0000A" />
                </div>
              </div>

              <div>
                <Label>Billing / Contact Email</Label>
                <Input type="email" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} placeholder="billing@acme.com" />
              </div>

              <div className="border-t border-border/40 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Invite first admin (optional)</Label>
                </div>
                <Input
                  type="email"
                  value={form.firstAdminEmail}
                  onChange={e => setForm({ ...form, firstAdminEmail: e.target.value })}
                  placeholder="admin@acme.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A 48-hour invite link will be sent immediately after tenant creation.
                </p>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  const { firstAdminEmail, ...tenantData } = form;
                  createMutation.mutate(tenantData);
                }}
                disabled={!form.name || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Tenant"}
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
          {[1, 2, 3].map(i => <Card key={i} className="animate-pulse h-32" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No tenants found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((tenant: any) => (
            <Card
              key={tenant.id}
              onClick={() => navigate(`/tenants/${tenant.id}`)}
              className="border border-border/60 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
            >
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
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
