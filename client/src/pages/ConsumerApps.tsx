import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Plus, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ConsumerAppsPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: apps, isLoading, refetch } = trpc.consumerApp.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.consumerApp.create.useMutation({
    onSuccess: (data) => { refetch(); setOpen(false); setCredentials(data); toast.success("App created"); },
  });
  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [form, setForm] = useState({ name: "", description: "", ownerEmail: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Consumer Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">Register and manage API consumer applications with client credentials</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Register App</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Register Consumer Application</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Application Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Mobile Banking App" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div><Label>Owner Email</Label><Input type="email" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate({ tenantId: defaultTenantId, workspaceId: 1, ...form })} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Registering..." : "Register Application"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {credentials && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <p className="font-semibold text-sm text-amber-800 mb-2">Client credentials generated — save these now, the secret won't be shown again.</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2"><Label className="w-24 text-xs">Client ID:</Label><code className="text-xs bg-white px-2 py-1 rounded flex-1">{credentials.clientId}</code><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(credentials.clientId); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button></div>
              <div className="flex items-center gap-2"><Label className="w-24 text-xs">Secret:</Label><code className="text-xs bg-white px-2 py-1 rounded flex-1">{credentials.clientSecret}</code><Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(credentials.clientSecret); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button></div>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setCredentials(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-16" />)}</div>
      ) : (apps as any[])?.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No consumer applications registered</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {(apps as any[])?.map((app) => (
            <Card key={app.id} className="border border-border/60 hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-4 w-4 text-primary" /></div>
                  <div>
                    <h3 className="font-semibold text-sm">{app.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{app.clientId}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={app.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{app.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
