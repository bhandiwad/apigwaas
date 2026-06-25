import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Mail, Trash2, ShieldCheck, BarChart3, Settings2, Plus, RefreshCw, Copy, Check, X, Edit2, Shield, Layers, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const roleColors: Record<string, string> = {
  owner:     "bg-purple-100 text-purple-700",
  admin:     "bg-blue-100 text-blue-700",
  developer: "bg-amber-100 text-amber-700",
  viewer:    "bg-gray-100 text-gray-600",
};

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

function QuotaBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((current / limit) * 100)) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{current} / {limit}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{pct}% used</p>
    </div>
  );
}

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  const tenantId = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: members, refetch: refetchMembers } = trpc.tenant.members.useQuery({ tenantId }, { enabled: !isNaN(tenantId) });
  const { data: invites, refetch: refetchInvites } = trpc.tenant.pendingInvites.useQuery({ tenantId }, { enabled: !isNaN(tenantId) });
  const { data: quota } = trpc.tenant.quotaUsage.useQuery({ tenantId }, { enabled: !isNaN(tenantId) });
  const { data: workspaces } = trpc.workspace.listByTenant.useQuery({ tenantId }, { enabled: !isNaN(tenantId) });
  const { data: tenants, isLoading: tenantsLoading } = trpc.tenant.list.useQuery();
  const me = trpc.auth.me.useQuery();

  const tenant = (tenants ?? []).find((t: any) => t.id === tenantId);

  const removeMember = trpc.tenant.removeMember.useMutation({ onSuccess: () => { refetchMembers(); toast.success("Member removed"); } });
  const changeMemberRole = trpc.tenant.changeMemberRole.useMutation({ onSuccess: () => { refetchMembers(); toast.success("Role updated"); } });
  const inviteMutation = trpc.tenant.invite.useMutation({
    onSuccess: (data) => {
      refetchInvites();
      setInviteOpen(false);
      toast.success("Invite sent");
      if (data.inviteUrl) setLastInviteUrl(data.inviteUrl);
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeInvite = trpc.tenant.revokeInvite.useMutation({ onSuccess: () => { refetchInvites(); toast.success("Invite revoked"); } });
  const updateSettings = trpc.tenant.updateSettings.useMutation({ onSuccess: () => toast.success("Settings saved") });
  const updateTenantMutation = trpc.tenant.update.useMutation({
    onSuccess: () => {
      utils.tenant.list.invalidate();
      setEditOpen(false);
      toast.success("Tenant updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", tenantRole: "developer" as "admin" | "developer" | "viewer" });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; tier: string; status: string; gstin: string; pan: string; contactEmail: string; kybVerified: boolean } | null>(null);

  const [domainInput, setDomainInput] = useState("");
  const [settings, setSettings] = useState<{ allowSelfRegistration: boolean; selfRegDefaultRole: "developer" | "viewer"; allowedEmailDomains: string[] } | null>(null);

  if (tenant && !settings) {
    setSettings({
      allowSelfRegistration: tenant.allowSelfRegistration ?? false,
      selfRegDefaultRole: (tenant.selfRegDefaultRole ?? "developer") as "developer" | "viewer",
      allowedEmailDomains: Array.isArray(tenant.allowedEmailDomains) ? tenant.allowedEmailDomains as string[] : [],
    });
  }

  if (tenant && !editForm) {
    setEditForm({
      name: tenant.name ?? "",
      tier: tenant.tier ?? "starter",
      status: tenant.status ?? "active",
      gstin: tenant.gstin ?? "",
      pan: tenant.pan ?? "",
      contactEmail: tenant.contactEmail ?? "",
      kybVerified: tenant.kybVerified ?? false,
    });
  }

  const myRole = me.data?.tenantRole;
  const isPlatformAdmin = me.data?.role === "admin";
  const isOwner = myRole === "owner" || isPlatformAdmin;
  const isAdmin = isOwner || myRole === "admin";

  async function copyInviteUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (tenantsLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/tenants")}>← Back to Tenants</Button>
        <p className="text-muted-foreground">Tenant not found or you don't have access.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate("/tenants")} className="text-xs text-muted-foreground hover:underline">Tenants</button>
            <span className="text-xs text-muted-foreground">/</span>
            <span className="text-xs text-foreground font-medium">{tenant.name}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className={`text-xs ${tierColors[tenant.tier] || ""}`}>{tenant.tier}</Badge>
            <Badge variant="secondary" className={`text-xs ${statusColors[tenant.status] || ""}`}>{tenant.status}</Badge>
            <span className="text-xs text-muted-foreground">{tenant.slug}</span>
            {tenant.kybVerified && <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700">KYB Verified</Badge>}
          </div>
        </div>
        {isPlatformAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit2 className="h-4 w-4 mr-1.5" />Edit Tenant
          </Button>
        )}
      </div>

      <Tabs defaultValue="workspaces">
        <TabsList>
          <TabsTrigger value="workspaces"><Layers className="h-3.5 w-3.5 mr-1.5" />Workspaces</TabsTrigger>
          <TabsTrigger value="members"><Users className="h-3.5 w-3.5 mr-1.5" />Members</TabsTrigger>
          <TabsTrigger value="invites"><Mail className="h-3.5 w-3.5 mr-1.5" />Invites</TabsTrigger>
          <TabsTrigger value="quota"><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Quota</TabsTrigger>
          <TabsTrigger value="settings"><Settings2 className="h-3.5 w-3.5 mr-1.5" />Settings</TabsTrigger>
          {isPlatformAdmin && <TabsTrigger value="admin"><Shield className="h-3.5 w-3.5 mr-1.5" />Admin</TabsTrigger>}
        </TabsList>

        {/* ── Workspaces ── */}
        <TabsContent value="workspaces" className="mt-4">
          {!workspaces || workspaces.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <Layers className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No workspaces yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(workspaces as any[]).map((ws) => (
                <Card
                  key={ws.id}
                  onClick={() => navigate(`/apis?workspaceId=${ws.id}&workspaceName=${encodeURIComponent(ws.name)}`)}
                  className="border border-border/60 hover:shadow-md hover:border-primary/40 transition-all cursor-pointer"
                >
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Layers className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{ws.name}</h3>
                          <p className="text-xs text-muted-foreground">{ws.slug}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                    {ws.description && (
                      <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{ws.description}</p>
                    )}
                    <div className="mt-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${ws.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                        {ws.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Members ── */}
        <TabsContent value="members" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{(members ?? []).length} member{(members ?? []).length !== 1 ? "s" : ""}</p>
            {isAdmin && (
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Invite Member
              </Button>
            )}
          </div>

          <Card className="border border-border/60">
            <CardContent className="p-0">
              {(members ?? []).length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No members yet</div>
              ) : (
                <div className="divide-y">
                  {(members ?? []).map((m: any) => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                          {m.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.name || m.email}</p>
                          {m.name && <p className="text-xs text-muted-foreground">{m.email}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAdmin && m.id !== me.data?.id ? (
                          <Select
                            value={m.tenantRole ?? "developer"}
                            onValueChange={(v) => changeMemberRole.mutate({ userId: m.id, tenantRole: v as any, tenantId })}
                            disabled={!isOwner && m.tenantRole === "owner"}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="developer">Developer</SelectItem>
                              <SelectItem value="viewer">Viewer</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className={`text-xs ${roleColors[m.tenantRole ?? "developer"]}`}>
                            {m.tenantRole ?? "developer"}
                          </Badge>
                        )}
                        {isAdmin && m.id !== me.data?.id && m.tenantRole !== "owner" && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                            onClick={() => removeMember.mutate({ userId: m.id, tenantId })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Invites ── */}
        <TabsContent value="invites" className="mt-4 space-y-4">
          {lastInviteUrl && (
            <Card className="border border-primary/40 bg-primary/5">
              <CardContent className="p-3 flex items-center gap-3">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium mb-0.5">Invite link (share this directly if email isn't configured)</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{lastInviteUrl}</p>
                </div>
                <Button variant="outline" size="sm" className="h-7 shrink-0" onClick={() => copyInviteUrl(lastInviteUrl)}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border border-border/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pending Invites</CardTitle></CardHeader>
            <CardContent className="p-0">
              {(invites ?? []).length === 0 ? (
                <div className="px-4 pb-4 text-sm text-muted-foreground">No pending invites</div>
              ) : (
                <div className="divide-y">
                  {(invites ?? []).map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className={`text-xs ${roleColors[inv.tenantRole]}`}>{inv.tenantRole}</Badge>
                          <span className="text-xs text-muted-foreground">
                            Expires {new Date(inv.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost" size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                          onClick={() => revokeInvite.mutate({ id: inv.id, tenantId })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Quota ── */}
        <TabsContent value="quota" className="mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Resource Usage</CardTitle>
                <Badge variant="secondary" className={`text-xs capitalize ${tierColors[tenant.tier] || ""}`}>{tenant.tier} plan</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {quota ? (
                <>
                  <QuotaBar label="Workspaces" current={quota.workspaces.current} limit={quota.workspaces.limit} />
                  <QuotaBar label="APIs" current={quota.apis.current} limit={quota.apis.limit} />
                  <QuotaBar label="Consumer Apps" current={quota.consumerApps.current} limit={quota.consumerApps.limit} />
                  <div className="pt-2 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">
                      Call volume and data transfer limits are enforced at the gateway level.
                      Monthly included: {tenant.includedCallsPerMonth?.toLocaleString()} calls · {tenant.dataTransferLimitGb} GB transfer.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Loading quota…</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings ── */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {!isOwner ? (
            <p className="text-sm text-muted-foreground">Only the tenant owner can change these settings.</p>
          ) : settings && (
            <>
              <Card className="border border-border/60">
                <CardHeader className="pb-3"><CardTitle className="text-base">Self-Registration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Allow self-registration</p>
                      <p className="text-xs text-muted-foreground">Users can sign up at /login?tenant={tenant.slug}</p>
                    </div>
                    <Switch
                      checked={settings.allowSelfRegistration}
                      onCheckedChange={(v) => setSettings({ ...settings, allowSelfRegistration: v })}
                    />
                  </div>

                  {settings.allowSelfRegistration && (
                    <>
                      <div className="space-y-1">
                        <Label>Default role for self-registered users</Label>
                        <Select
                          value={settings.selfRegDefaultRole}
                          onValueChange={(v) => setSettings({ ...settings, selfRegDefaultRole: v as "developer" | "viewer" })}
                        >
                          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Allowed email domains (leave empty to allow all)</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="company.com"
                            value={domainInput}
                            onChange={e => setDomainInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const d = domainInput.trim().toLowerCase();
                                if (d && !settings.allowedEmailDomains.includes(d)) {
                                  setSettings({ ...settings, allowedEmailDomains: [...settings.allowedEmailDomains, d] });
                                }
                                setDomainInput("");
                              }
                            }}
                          />
                          <Button
                            type="button" variant="outline" size="sm"
                            onClick={() => {
                              const d = domainInput.trim().toLowerCase();
                              if (d && !settings.allowedEmailDomains.includes(d)) {
                                setSettings({ ...settings, allowedEmailDomains: [...settings.allowedEmailDomains, d] });
                              }
                              setDomainInput("");
                            }}
                          >Add</Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {settings.allowedEmailDomains.map(d => (
                            <Badge key={d} variant="secondary" className="text-xs gap-1">
                              {d}
                              <button onClick={() => setSettings({ ...settings, allowedEmailDomains: settings.allowedEmailDomains.filter(x => x !== d) })}>
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    onClick={() => updateSettings.mutate({ ...settings, tenantId })}
                    disabled={updateSettings.isPending}
                  >
                    {updateSettings.isPending ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── Admin (platform admin only) ── */}
        {isPlatformAdmin && (
          <TabsContent value="admin" className="mt-4 space-y-4">
            <Card className="border border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tenant Details</CardTitle>
                <p className="text-xs text-muted-foreground">Platform admin — direct edit of all tenant fields</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {editForm && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label>Contact Email</Label>
                        <Input type="email" value={editForm.contactEmail} onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>Tier</Label>
                        <Select value={editForm.tier} onValueChange={v => setEditForm({ ...editForm, tier: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="starter">Starter</SelectItem>
                            <SelectItem value="business">Business</SelectItem>
                            <SelectItem value="enterprise">Enterprise</SelectItem>
                            <SelectItem value="sovereign">Sovereign</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="provisioning">Provisioning</SelectItem>
                            <SelectItem value="suspended">Suspended</SelectItem>
                            <SelectItem value="offboarding">Offboarding</SelectItem>
                            <SelectItem value="terminated">Terminated</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label>GSTIN</Label>
                        <Input value={editForm.gstin} onChange={e => setEditForm({ ...editForm, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
                      </div>
                      <div className="space-y-1">
                        <Label>PAN</Label>
                        <Input value={editForm.pan} onChange={e => setEditForm({ ...editForm, pan: e.target.value })} placeholder="AAAAA0000A" />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <Switch
                        checked={editForm.kybVerified}
                        onCheckedChange={v => setEditForm({ ...editForm, kybVerified: v })}
                        id="kyb-toggle"
                      />
                      <Label htmlFor="kyb-toggle" className="cursor-pointer">KYB Verified</Label>
                    </div>
                    <Button
                      onClick={() => updateTenantMutation.mutate({
                        id: tenantId,
                        name: editForm.name || undefined,
                        tier: editForm.tier as any,
                        status: editForm.status as any,
                        gstin: editForm.gstin || undefined,
                        pan: editForm.pan || undefined,
                        kybVerified: editForm.kybVerified,
                      })}
                      disabled={updateTenantMutation.isPending}
                    >
                      {updateTenantMutation.isPending ? <><RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />Saving…</> : "Save Changes"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border border-red-200 bg-red-50/30">
              <CardHeader className="pb-3"><CardTitle className="text-base text-red-700">Danger Zone</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Suspend tenant</p>
                    <p className="text-xs text-muted-foreground">Blocks all gateway traffic for this tenant immediately</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    disabled={tenant.status === "suspended"}
                    onClick={() => {
                      if (confirm(`Suspend ${tenant.name}? All API traffic will be blocked.`)) {
                        updateTenantMutation.mutate({ id: tenantId, status: "suspended" });
                      }
                    }}
                  >
                    Suspend
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Reactivate tenant</p>
                    <p className="text-xs text-muted-foreground">Restore gateway traffic after suspension</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={tenant.status === "active"}
                    onClick={() => updateTenantMutation.mutate({ id: tenantId, status: "active" })}
                  >
                    Reactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Email address</Label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteForm.email}
                onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={inviteForm.tenantRole} onValueChange={v => setInviteForm({ ...inviteForm, tenantRole: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — can manage members and all resources</SelectItem>
                  <SelectItem value="developer">Developer — can create, deploy and manage APIs</SelectItem>
                  <SelectItem value="viewer">Viewer — read-only access</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={() => inviteMutation.mutate({ ...inviteForm, tenantId })}
              disabled={!inviteForm.email || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Sending…" : "Send Invite"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              An email will be sent with a 48-hour invite link. If email isn't configured, copy the link from the Invites tab.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Superadmin edit dialog (accessible via Edit button in header) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Tenant</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </div>
                <div>
                  <Label>Contact Email</Label>
                  <Input type="email" value={editForm.contactEmail} onChange={e => setEditForm({ ...editForm, contactEmail: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tier</Label>
                  <Select value={editForm.tier} onValueChange={v => setEditForm({ ...editForm, tier: v })}>
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
                  <Label>Status</Label>
                  <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="provisioning">Provisioning</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="offboarding">Offboarding</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>GSTIN</Label>
                  <Input value={editForm.gstin} onChange={e => setEditForm({ ...editForm, gstin: e.target.value })} placeholder="22AAAAA0000A1Z5" />
                </div>
                <div>
                  <Label>PAN</Label>
                  <Input value={editForm.pan} onChange={e => setEditForm({ ...editForm, pan: e.target.value })} placeholder="AAAAA0000A" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={editForm.kybVerified} onCheckedChange={v => setEditForm({ ...editForm, kybVerified: v })} id="kyb-edit" />
                <Label htmlFor="kyb-edit" className="cursor-pointer">KYB Verified</Label>
              </div>
              <Button
                className="w-full"
                onClick={() => updateTenantMutation.mutate({
                  id: tenantId,
                  name: editForm.name || undefined,
                  tier: editForm.tier as any,
                  status: editForm.status as any,
                  gstin: editForm.gstin || undefined,
                  pan: editForm.pan || undefined,
                  kybVerified: editForm.kybVerified,
                })}
                disabled={updateTenantMutation.isPending}
              >
                {updateTenantMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
