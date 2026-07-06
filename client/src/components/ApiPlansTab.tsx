import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, KeyRound } from "lucide-react";
import { SyncBadge } from "@/components/SyncBadge";
import { toast } from "sonner";

export function ApiPlansTab({ apiId }: { apiId: number }) {
  const { data: plans, refetch, isLoading } = trpc.plan.list.useQuery({ apiId });
  const create = trpc.plan.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); setForm({ name: "", rateLimit: 100, quotaLimit: 10000, autoApprove: true }); toast.success("Plan created"); }, onError: (e) => toast.error(e.message) });
  const update = trpc.plan.update.useMutation({ onSuccess: () => refetch(), onError: (e) => toast.error(e.message) });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", rateLimit: 100, quotaLimit: 10000, autoApprove: true });
  const rows = (plans ?? []) as any[];

  const tone = (s: string) => s === "active" ? "bg-emerald-100 text-emerald-700" : s === "closed" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700";

  return (
    <div className="space-y-3 mt-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New plan</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New plan</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Gold" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Rate limit / min</Label><Input type="number" value={form.rateLimit} onChange={e => setForm({ ...form, rateLimit: Number(e.target.value) })} /></div>
                <div><Label>Quota / month</Label><Input type="number" value={form.quotaLimit} onChange={e => setForm({ ...form, quotaLimit: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div><p className="text-sm font-medium">Auto-approve</p><p className="text-xs text-muted-foreground">Issue keys immediately on subscribe.</p></div>
                <Switch checked={form.autoApprove} onCheckedChange={v => setForm({ ...form, autoApprove: v })} />
              </div>
              <Button className="w-full" disabled={!form.name || create.isPending}
                onClick={() => create.mutate({ apiId, name: form.name, rateLimit: form.rateLimit, rateLimitPeriod: "minute", quotaLimit: form.quotaLimit, quotaPeriod: "month", autoApprove: form.autoApprove })}>
                {create.isPending ? "Creating…" : "Create plan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <Card key={i} className="animate-pulse h-16" />)}</div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No plans yet. Add one so consumers can subscribe.</p>
        </CardContent></Card>
      ) : rows.map((p) => (
        <Card key={p.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.rateLimit}/{p.rateLimitPeriod ?? "min"} · {p.quotaLimit}/{p.quotaPeriod ?? "month"}{typeof p.subscriptionCount === "number" ? ` · ${p.subscriptionCount} subs` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <SyncBadge status={p.graviteeApiId ? "synced" : "local_only"} />
              <Badge className={tone(p.status)}>{p.status}</Badge>
              {p.status !== "closed" && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: p.id, status: "closed" })}>Close</Button>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
