import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, Pencil, Trash2, Power, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type PlanForm = { name: string; description: string; rateLimit: string; rateLimitPeriod: "second" | "minute" | "hour" | "day"; quotaLimit: string; quotaPeriod: "day" | "week" | "month"; pricePerMonth: string };

const DEFAULT_FORM: PlanForm = { name: "", description: "", rateLimit: "100", rateLimitPeriod: "minute", quotaLimit: "10000", quotaPeriod: "month", pricePerMonth: "0" };

export default function PlansPage() {
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList = (apis as any[]) || [];
  const [selectedApiId, setSelectedApiId] = useState<number | null>(null);
  const activeApiId = selectedApiId || apiList[0]?.id || 0;
  const { data: plans, refetch } = trpc.plan.list.useQuery({ apiId: activeApiId }, { enabled: activeApiId > 0 });
  const { data: subscriptions } = trpc.subscription.list.useQuery(undefined);
  const subList: any[] = (subscriptions as any)?.data ?? (Array.isArray(subscriptions) ? subscriptions : []);

  const createMutation = trpc.plan.create.useMutation({ onSuccess: () => { refetch(); setCreateOpen(false); setForm(DEFAULT_FORM); toast.success("Plan created"); } });
  const updateMutation = trpc.plan.update.useMutation({ onSuccess: () => { refetch(); setEditPlan(null); toast.success("Plan updated"); } });
  const deleteMutation = trpc.plan.delete.useMutation({ onSuccess: () => { refetch(); setDeletePlan(null); toast.success("Plan deleted"); } });

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const [editPlan, setEditPlan] = useState<any | null>(null);
  const [deletePlan, setDeletePlan] = useState<any | null>(null);

  const planList = (plans as any[]) || [];

  const subCountForPlan = (planId: number) => subList.filter((s: any) => s.planId === planId).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage API subscription plans with rate limits and quotas</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground" disabled={!activeApiId}><Plus className="h-4 w-4 mr-2" />Create Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create New Plan</DialogTitle></DialogHeader>
            <PlanFormFields form={form} setForm={setForm} />
            <Button className="w-full mt-2" onClick={() => {
              if (!form.name || !activeApiId) { toast.error("Name and API required"); return; }
              createMutation.mutate({ apiId: activeApiId, name: form.name, description: form.description || undefined, rateLimit: parseInt(form.rateLimit), rateLimitPeriod: form.rateLimitPeriod, quotaLimit: parseInt(form.quotaLimit), quotaPeriod: form.quotaPeriod, monthlyFee: form.pricePerMonth });
            }} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Plan"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* API Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">API:</Label>
        <Select value={String(activeApiId)} onValueChange={v => setSelectedApiId(parseInt(v))}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Select an API" /></SelectTrigger>
          <SelectContent>
            {apiList.map((api: any) => <SelectItem key={api.id} value={String(api.id)}>{api.name} <span className="text-xs text-muted-foreground">v{api.version}</span></SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {apiList.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">Create an API first, then manage its plans here.</p></CardContent></Card>
      ) : planList.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No plans for this API. Create one to define rate limits and quotas.</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planList.map((plan: any) => {
            const subs = subCountForPlan(plan.id);
            const isActive = plan.status === "active";
            return (
              <Card key={plan.id} className="border border-border/60 hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold">{plan.name}</h3>
                    <Badge variant="secondary" className={isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}>{isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                  {plan.description && <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Rate Limit</span><span className="font-medium">{plan.rateLimit} / {plan.rateLimitPeriod}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Quota</span><span className="font-medium">{plan.quotaLimit?.toLocaleString()} / {plan.quotaPeriod}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-bold text-primary">₹{plan.monthlyFee || "0"}/mo</span></div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Subscribers</span>
                      <span className="font-medium">{subs}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setEditPlan(plan)}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => updateMutation.mutate({ id: plan.id, status: isActive ? "closed" : "active" })} disabled={updateMutation.isPending}>
                      <Power className="h-3 w-3 mr-1" />{isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletePlan(plan)} disabled={subs > 0} title={subs > 0 ? `${subs} active subscriber(s) — cannot delete` : "Delete plan"}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Plan Dialog */}
      {editPlan && (
        <Dialog open={!!editPlan} onOpenChange={() => setEditPlan(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Plan: {editPlan.name}</DialogTitle></DialogHeader>
            <EditPlanForm plan={editPlan} onSave={(data) => updateMutation.mutate({ id: editPlan.id, ...data })} isPending={updateMutation.isPending} />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      {deletePlan && (
        <Dialog open={!!deletePlan} onOpenChange={() => setDeletePlan(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Delete Plan</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground mt-2">Are you sure you want to delete <strong>{deletePlan.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setDeletePlan(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: deletePlan.id })}>
                {deleteMutation.isPending ? "Deleting..." : "Delete Plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PlanFormFields({ form, setForm }: { form: PlanForm; setForm: (f: PlanForm) => void }) {
  return (
    <div className="space-y-4 mt-4">
      <div><Label>Plan Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Basic, Pro, Enterprise" /></div>
      <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Plan description" /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Rate Limit</Label><Input type="number" value={form.rateLimit} onChange={e => setForm({...form, rateLimit: e.target.value})} /></div>
        <div><Label>Rate Period</Label>
          <Select value={form.rateLimitPeriod} onValueChange={v => setForm({...form, rateLimitPeriod: v as any})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="second">Per Second</SelectItem>
              <SelectItem value="minute">Per Minute</SelectItem>
              <SelectItem value="hour">Per Hour</SelectItem>
              <SelectItem value="day">Per Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Quota Limit</Label><Input type="number" value={form.quotaLimit} onChange={e => setForm({...form, quotaLimit: e.target.value})} /></div>
        <div><Label>Quota Period</Label>
          <Select value={form.quotaPeriod} onValueChange={v => setForm({...form, quotaPeriod: v as any})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Price per Month (₹)</Label><Input type="number" value={form.pricePerMonth} onChange={e => setForm({...form, pricePerMonth: e.target.value})} /></div>
    </div>
  );
}

function EditPlanForm({ plan, onSave, isPending }: { plan: any; onSave: (data: any) => void; isPending: boolean }) {
  const [name, setName] = useState(plan.name);
  const [rateLimit, setRateLimit] = useState(String(plan.rateLimit));
  const [quotaLimit, setQuotaLimit] = useState(String(plan.quotaLimit));
  return (
    <div className="space-y-4 mt-4">
      <div><Label>Plan Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Rate Limit</Label><Input type="number" value={rateLimit} onChange={e => setRateLimit(e.target.value)} /></div>
        <div><Label>Quota Limit</Label><Input type="number" value={quotaLimit} onChange={e => setQuotaLimit(e.target.value)} /></div>
      </div>
      <Button className="w-full" disabled={!name || isPending} onClick={() => onSave({ name, rateLimit: parseInt(rateLimit), quotaLimit: parseInt(quotaLimit) })}>
        {isPending ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
