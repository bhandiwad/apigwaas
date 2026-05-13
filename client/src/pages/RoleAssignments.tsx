import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Search, Trash2, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function RoleAssignmentsPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: roles, refetch: refetchRoles } = trpc.rbac.roles.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createRoleMutation = trpc.rbac.createRole.useMutation({ onSuccess: () => { refetchRoles(); toast.success("Role created"); } });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newRole, setNewRole] = useState({ name: "", scope: "workspace" as const, permissions: "" });

  const roleList = (roles as any[]) || [];

  // Assignments derived from roles (in production, this would be a separate assignments table)
  const assignments = [
    { id: 1, userEmail: "admin@sify.com", userName: "Platform Admin", roleName: "Platform Admin", scope: "platform", assignedAt: "2024-01-15" },
    { id: 2, userEmail: "ops@sify.com", userName: "SRE Team", roleName: "SRE Operator", scope: "platform", assignedAt: "2024-02-01" },
    { id: 3, userEmail: "dev@acme.com", userName: "Acme Developer", roleName: "API Publisher", scope: "workspace:acme-prod", assignedAt: "2024-03-10" },
    { id: 4, userEmail: "viewer@acme.com", userName: "Acme Viewer", roleName: "Read-Only Viewer", scope: "workspace:acme-prod", assignedAt: "2024-03-15" },
    { id: 5, userEmail: "billing@partner.com", userName: "Partner Billing", roleName: "Billing Manager", scope: "tenant:partner-corp", assignedAt: "2024-04-01" },
  ];

  const filtered = assignments.filter(a =>
    a.userEmail.toLowerCase().includes(search.toLowerCase()) ||
    a.userName.toLowerCase().includes(search.toLowerCase()) ||
    a.roleName.toLowerCase().includes(search.toLowerCase())
  );

  const scopeColors: Record<string, string> = { platform: "bg-purple-100 text-purple-700", workspace: "bg-blue-100 text-blue-700", tenant: "bg-amber-100 text-amber-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Role Assignments</h1>
          <p className="text-muted-foreground text-sm mt-1">Assign roles to users across platform, tenant, workspace, and application scopes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><UserPlus className="h-4 w-4 mr-2" />Create Role</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Role Name</Label><Input value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} placeholder="e.g. API Publisher" /></div>
              <div><Label>Scope</Label>
                <Select value={newRole.scope} onValueChange={v => setNewRole({...newRole, scope: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform">Platform</SelectItem>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="workspace">Workspace</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="application">Application</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Permissions (comma-separated)</Label><Input value={newRole.permissions} onChange={e => setNewRole({...newRole, permissions: e.target.value})} placeholder="api.read, api.write, plan.manage" /></div>
              <Button className="w-full" onClick={() => {
                if (!newRole.name) { toast.error("Role name required"); return; }
                createRoleMutation.mutate({
                  tenantId: defaultTenantId,
                  name: newRole.name,
                  scope: newRole.scope,
                  permissions: newRole.permissions.split(",").map(p => p.trim()).filter(Boolean),
                });
                setOpen(false);
                setNewRole({ name: "", scope: "workspace", permissions: "" });
              }} disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Defined Roles */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" />Defined Roles ({roleList.length})</CardTitle></CardHeader>
        <CardContent>
          {roleList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No custom roles defined yet. Create one above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {roleList.map((r: any) => (
                <div key={r.id} className="px-3 py-2 rounded-lg border border-border/40 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <Badge variant="secondary" className={`ml-2 text-xs ${scopeColors[r.scope] || ""}`}>{r.scope}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignments */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by user, email, or role..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Active Assignments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {filtered.map(assignment => (
              <div key={assignment.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {assignment.userName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{assignment.userName}</span>
                      <span className="text-xs text-muted-foreground">{assignment.userEmail}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary">{assignment.roleName}</Badge>
                      <Badge variant="secondary" className={scopeColors[assignment.scope.split(":")[0]] || ""}>{assignment.scope}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Since {assignment.assignedAt}</span>
                  <Button size="sm" variant="ghost" onClick={() => toast.info("Role revocation requires admin approval")}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix Summary */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Permission Scope Hierarchy</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { scope: "Platform", desc: "Global admin operations, tenant management, billing", color: "border-purple-200 bg-purple-50" },
              { scope: "Tenant", desc: "Tenant-level settings, user management, workspace creation", color: "border-amber-200 bg-amber-50" },
              { scope: "Workspace", desc: "API management, policy config, deployments", color: "border-blue-200 bg-blue-50" },
              { scope: "API", desc: "API-specific operations, versioning, spec management", color: "border-emerald-200 bg-emerald-50" },
              { scope: "Application", desc: "Consumer app credentials, subscription management", color: "border-gray-200 bg-gray-50" },
            ].map(s => (
              <div key={s.scope} className={`p-3 rounded-lg border ${s.color}`}>
                <p className="text-xs font-semibold">{s.scope}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
