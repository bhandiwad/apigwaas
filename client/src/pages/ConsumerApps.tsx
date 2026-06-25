import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Plus, Copy, ChevronRight, Link2, Ban } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ConsumerAppsPage() {
  const { data: appsResult, isLoading, refetch } = trpc.consumerApp.list.useQuery(undefined);
  const apps: any[] = (appsResult as any)?.data ?? (Array.isArray(appsResult) ? appsResult : []);
  const { data: workspaces } = trpc.workspace.list.useQuery(undefined);
  const { data: subscriptions } = trpc.subscription.list.useQuery(undefined);
  const { data: apis } = trpc.api.list.useQuery({});
  const workspaceList = (workspaces as any[]) || [];
  const subList: any[] = (subscriptions as any)?.data ?? (Array.isArray(subscriptions) ? subscriptions : []);
  const apiList: any[] = (apis as any[]) || [];

  const createMutation = trpc.consumerApp.create.useMutation({
    onSuccess: (data) => { refetch(); setOpen(false); setCredentials(data); toast.success("App created"); },
  });
  const revokeMutation = trpc.consumerApp.revoke.useMutation({
    onSuccess: () => { refetch(); setDetailApp(null); toast.success("App revoked"); },
  });

  const [open, setOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ clientId: string; clientSecret: string } | null>(null);
  const [form, setForm] = useState({ name: "", description: "", ownerEmail: "", workspaceId: "" });
  const [detailApp, setDetailApp] = useState<any | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState(false);

  const appSubscriptions = (app: any) => subList.filter((s: any) => s.consumerAppId === app.id);

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
              <div><Label>Workspace</Label>
                <Select value={form.workspaceId} onValueChange={v => setForm({...form, workspaceId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                  <SelectContent>
                    {workspaceList.map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Application Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Mobile Banking App" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
              <div><Label>Owner Email</Label><Input type="email" value={form.ownerEmail} onChange={e => setForm({...form, ownerEmail: e.target.value})} /></div>
              <Button className="w-full" onClick={() => {
                if (!form.workspaceId) { toast.error("Select a workspace"); return; }
                createMutation.mutate({ workspaceId: parseInt(form.workspaceId), name: form.name, description: form.description || undefined, ownerEmail: form.ownerEmail || undefined });
              }} disabled={!form.name || !form.workspaceId || createMutation.isPending}>
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
      ) : apps.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No consumer applications registered</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => {
            const subs = appSubscriptions(app);
            return (
              <Card key={app.id} className="border border-border/60 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer" onClick={() => setDetailApp(app)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Zap className="h-4 w-4 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold text-sm">{app.name}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{app.clientId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {subs.length > 0 && <Badge variant="outline" className="text-xs"><Link2 className="h-3 w-3 mr-1" />{subs.length} {subs.length === 1 ? "subscription" : "subscriptions"}</Badge>}
                    <Badge variant="secondary" className={app.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{app.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* App Detail Dialog */}
      {detailApp && (
        <Dialog open={!!detailApp} onOpenChange={(o) => { if (!o) { setDetailApp(null); setRevokeConfirm(false); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                {detailApp.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className={detailApp.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}>{detailApp.status}</Badge>
                {detailApp.description && <p className="text-xs text-muted-foreground">{detailApp.description}</p>}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 p-2 bg-muted rounded">
                  <span className="text-muted-foreground w-24 text-xs">Client ID</span>
                  <code className="text-xs flex-1 font-mono">{detailApp.clientId}</code>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(detailApp.clientId); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
                </div>
                {detailApp.ownerEmail && <div className="flex items-center gap-2"><span className="text-muted-foreground text-xs w-24">Owner</span><span className="text-xs">{detailApp.ownerEmail}</span></div>}
                <div className="flex items-center gap-2"><span className="text-muted-foreground text-xs w-24">Registered</span><span className="text-xs">{detailApp.createdAt ? new Date(detailApp.createdAt).toLocaleDateString() : "N/A"}</span></div>
              </div>

              {/* Subscriptions */}
              <div>
                <h4 className="text-sm font-medium mb-2">API Subscriptions</h4>
                {appSubscriptions(detailApp).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No subscriptions yet.</p>
                ) : (
                  <div className="space-y-1">
                    {appSubscriptions(detailApp).map((sub: any) => {
                      const api = apiList.find((a: any) => a.id === sub.apiId);
                      return (
                        <div key={sub.id} className="flex items-center justify-between p-2 rounded border text-xs">
                          <span className="font-medium">{api?.name || `API #${sub.apiId}`}</span>
                          <Badge variant="secondary" className={sub.status === "approved" ? "bg-emerald-100 text-emerald-700" : sub.status === "pending" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}>{sub.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              {detailApp.status === "active" && (
                <div className="pt-3 border-t">
                  {!revokeConfirm ? (
                    <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => setRevokeConfirm(true)}>
                      <Ban className="h-3 w-3 mr-1" />Revoke Application
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-destructive font-medium">This will immediately revoke all API access for this application. Active integrations will break.</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRevokeConfirm(false)}>Cancel</Button>
                        <Button size="sm" variant="destructive" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate({ id: detailApp.id })}>
                          {revokeMutation.isPending ? "Revoking..." : "Confirm Revoke"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
