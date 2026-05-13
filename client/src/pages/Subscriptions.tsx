import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SubscriptionsPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: subscriptions, isLoading, refetch } = trpc.subscription.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: consumerApps } = trpc.consumerApp.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: apis } = trpc.api.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const firstApiId = (apis as any[])?.[0]?.id || 0;
  const { data: plans } = trpc.plan.list.useQuery({ apiId: firstApiId }, { enabled: firstApiId > 0 });
  const createMutation = trpc.subscription.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Subscription created"); } });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ consumerAppId: "", planId: "", apiId: "" });

  const planList = (plans as any[]) || [];
  const appList = (consumerApps as any[]) || [];
  const apiList = (apis as any[]) || [];
  const subList = (subscriptions as any[]) || [];
  const filtered = subList.filter((s: any) => {
    const app = appList.find((a: any) => a.id === s.consumerAppId);
    const plan = planList.find((p: any) => p.id === s.planId);
    return (app?.name || "").toLowerCase().includes(search.toLowerCase()) || (plan?.name || "").toLowerCase().includes(search.toLowerCase());
  });

  const statusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", suspended: "bg-amber-100 text-amber-700", cancelled: "bg-red-100 text-red-700", pending: "bg-blue-100 text-blue-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage consumer app subscriptions to API plans</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />New Subscription</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Subscription</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Consumer App</Label>
                <Select value={form.consumerAppId} onValueChange={v => setForm({...form, consumerAppId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select app" /></SelectTrigger>
                  <SelectContent>
                    {appList.map((app: any) => <SelectItem key={app.id} value={String(app.id)}>{app.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>API</Label>
                <Select value={form.apiId} onValueChange={v => setForm({...form, apiId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select API" /></SelectTrigger>
                  <SelectContent>
                    {apiList.map((api: any) => <SelectItem key={api.id} value={String(api.id)}>{api.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Plan</Label>
                <Select value={form.planId} onValueChange={v => setForm({...form, planId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {planList.map((plan: any) => <SelectItem key={plan.id} value={String(plan.id)}>{plan.name} — {plan.rateLimit} req/s</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => {
                if (!form.consumerAppId || !form.planId || !form.apiId) { toast.error("All fields required"); return; }
                createMutation.mutate({ tenantId: defaultTenantId, consumerAppId: parseInt(form.consumerAppId), planId: parseInt(form.planId), apiId: parseInt(form.apiId) });
              }} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Subscription"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search subscriptions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Link2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No subscriptions found. Create one to connect a consumer app to an API plan.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub: any) => {
            const app = appList.find((a: any) => a.id === sub.consumerAppId);
            const plan = planList.find((p: any) => p.id === sub.planId);
            const api = apiList.find((a: any) => a.id === sub.apiId);
            return (
              <Card key={sub.id} className="border border-border/60 hover:shadow-sm transition-shadow">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Link2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{app?.name || `App #${sub.consumerAppId}`}</h3>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm text-muted-foreground">{api?.name || `API #${sub.apiId}`}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Plan: {plan?.name || `Plan #${sub.planId}`} · Created: {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "N/A"}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={statusColors[sub.status] || ""}>{sub.status}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
