import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function WorkspacesPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: workspaces, isLoading, refetch } = trpc.workspace.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.workspace.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Workspace created"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const statusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", archived: "bg-gray-100 text-gray-600", deleted: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage workspace environments within your tenant</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />New Workspace</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Workspace</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Production" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Production environment" /></div>
              <Button className="w-full" onClick={() => createMutation.mutate({ tenantId: defaultTenantId, ...form })} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Workspace"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-28" />)}</div>
      ) : (workspaces as any[])?.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Layers className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No workspaces yet</p></CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(workspaces as any[])?.map((ws) => (
            <Card key={ws.id} className="border border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Layers className="h-4 w-4 text-primary" /></div>
                  <div><h3 className="font-semibold text-sm">{ws.name}</h3><p className="text-xs text-muted-foreground">{ws.slug}</p></div>
                </div>
                <Badge variant="secondary" className={statusColors[ws.status] || ""}>{ws.status}</Badge>
                {ws.description && <p className="text-xs text-muted-foreground mt-2">{ws.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
