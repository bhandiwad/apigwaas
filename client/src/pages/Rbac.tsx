import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Plus, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RbacPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: roles, isLoading, refetch } = trpc.rbac.roles.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.rbac.createRole.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Role created"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const scopeColors: Record<string, string> = { platform: "bg-red-100 text-red-700", workspace: "bg-blue-100 text-blue-700", api: "bg-emerald-100 text-emerald-700", application: "bg-purple-100 text-purple-700" };

  const permissionMatrix = [
    { scope: "Platform", permissions: ["tenant.manage", "billing.view", "audit.export", "compliance.manage"] },
    { scope: "Workspace", permissions: ["workspace.create", "workspace.delete", "api.publish", "policy.manage"] },
    { scope: "API", permissions: ["api.create", "api.update", "api.deprecate", "subscription.approve"] },
    { scope: "Application", permissions: ["app.register", "app.rotate_keys", "app.subscribe", "app.view_metrics"] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Roles & Access Control</h1>
          <p className="text-muted-foreground text-sm mt-1">Multi-tenant RBAC with custom role definitions and permission matrix</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Create Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Role Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="API Publisher" /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Can publish and manage APIs" /></div>
              <Button className="w-full" onClick={() => createMutation.mutate({ tenantId: defaultTenantId, ...form, scope: "workspace", permissions: [] })} disabled={!form.name || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Permission Matrix */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Permission Matrix</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {permissionMatrix.map((scope) => (
              <div key={scope.scope}>
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">{scope.scope} Scope</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-6">
                  {scope.permissions.map((p) => (
                    <Badge key={p} variant="outline" className="text-xs font-mono">{p}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Roles List */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Custom Roles</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center text-muted-foreground py-8">Loading roles...</div>
          ) : (roles as any[])?.length === 0 ? (
            <div className="text-center py-8"><Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-muted-foreground text-sm">No custom roles defined</p></div>
          ) : (
            <div className="space-y-2">
              {(roles as any[])?.map((role) => (
                <div key={role.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center"><Shield className="h-4 w-4 text-primary" /></div>
                    <div>
                      <p className="text-sm font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground">{role.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={scopeColors[role.scope] || ""}>{role.scope}</Badge>
                    {role.isSystem && <Badge variant="outline" className="text-xs">System</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
