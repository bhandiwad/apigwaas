import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Plus, Search, Copy, Key, CheckCircle, XCircle, Ban, RefreshCw, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTenantContext } from "@/contexts/TenantContext";
import { useLocation } from "wouter";

export default function SubscriptionsPage() {
  const [, navigate] = useLocation();
  const { effectiveTenantId } = useTenantContext();
  const { data: subscriptions, isLoading, refetch } = trpc.subscription.list.useQuery({ tenantId: effectiveTenantId });
  const { data: consumerApps } = trpc.consumerApp.list.useQuery({ tenantId: effectiveTenantId });
  const { data: apis } = trpc.api.list.useQuery({});

  const [rotatedKey, setRotatedKey] = useState<string | null>(null);
  const [newSubKey, setNewSubKey] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  const approveMutation = trpc.subscription.approve.useMutation({
    onSuccess: (data) => { refetch(); if (data.apiKey) { setNewSubKey(data.apiKey); } toast.success("Subscription approved"); },
  });
  const rejectMutation = trpc.subscription.reject.useMutation({
    onSuccess: () => { refetch(); toast.success("Subscription rejected"); },
  });
  const revokeMutation = trpc.subscription.revoke.useMutation({
    onSuccess: () => { refetch(); setSelectedSub(null); toast.success("Subscription revoked"); },
  });
  const rotateKeyMutation = trpc.subscription.rotateKey.useMutation({
    onSuccess: (data) => { refetch(); setRotatedKey(data.apiKey ?? null); toast.success("API key rotated"); },
  });

  const [search, setSearch] = useState("");

  const appList: any[] = (consumerApps as any)?.data ?? (Array.isArray(consumerApps) ? consumerApps : []);
  const apiList: any[] = (apis as any[]) || [];
  const subList: any[] = (subscriptions as any)?.data ?? (Array.isArray(subscriptions) ? subscriptions : []);

  const filtered = subList.filter((s: any) => {
    const app = appList.find((a: any) => a.id === s.consumerAppId);
    const api = apiList.find((a: any) => a.id === s.apiId);
    return (app?.name || "").toLowerCase().includes(search.toLowerCase()) || (api?.name || "").toLowerCase().includes(search.toLowerCase());
  });

  const statusColors: Record<string, string> = { approved: "bg-emerald-100 text-emerald-700", pending: "bg-yellow-100 text-yellow-700", rejected: "bg-red-100 text-red-700", revoked: "bg-gray-100 text-gray-700", expired: "bg-orange-100 text-orange-700" };

  const summaryByStatus = (s: string) => subList.filter((x: any) => x.status === s).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage consumer app subscriptions to API plans</p>
        </div>
        <Button className="bg-primary text-primary-foreground" onClick={() => navigate("/subscribe")}><Plus className="h-4 w-4 mr-2" />New Subscription</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[["approved", "text-emerald-600"], ["pending", "text-yellow-600"], ["rejected", "text-red-600"], ["revoked", "text-gray-600"]].map(([s, c]) => (
          <Card key={s}><CardContent className="pt-4"><div className="text-xs text-muted-foreground capitalize">{s}</div><div className={`text-2xl font-bold ${c}`}>{summaryByStatus(s)}</div></CardContent></Card>
        ))}
      </div>

      {(newSubKey || rotatedKey) && (
        <Card className="border-2 border-amber-300 bg-amber-50">
          <CardContent className="p-4">
            <p className="font-semibold text-sm text-amber-800 mb-2 flex items-center gap-2"><Key className="h-4 w-4" />{rotatedKey ? "New API key (rotated)" : "API key generated"} — save this now, it won't be shown again.</p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-white px-2 py-1 rounded flex-1 font-mono break-all">{rotatedKey || newSubKey}</code>
              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(rotatedKey || newSubKey || ""); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setRotatedKey(null); setNewSubKey(null); }}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by app or API..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Link2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No subscriptions found.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub: any) => {
            const app = appList.find((a: any) => a.id === sub.consumerAppId);
            const api = apiList.find((a: any) => a.id === sub.apiId);
            return (
              <Card key={sub.id} className="border border-border/60 hover:shadow-sm hover:border-primary/40 transition-all cursor-pointer" onClick={() => setSelectedSub(sub)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Link2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{app?.name || `App #${sub.consumerAppId}`}</h3>
                        <span className="text-xs text-muted-foreground">→</span>
                        <span className="text-sm text-muted-foreground">{api?.name || `API #${sub.apiId}`}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created: {sub.createdAt ? new Date(sub.createdAt).toLocaleDateString() : "N/A"}
                        {sub.approvedAt && ` · Approved: ${new Date(sub.approvedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.status === "pending" && (
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="sm" variant="outline" className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-7 px-2" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ id: sub.id })}>
                          <CheckCircle className="h-3 w-3 mr-1" />Approve
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50 h-7 px-2" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: sub.id })}>
                          <XCircle className="h-3 w-3 mr-1" />Reject
                        </Button>
                      </div>
                    )}
                    <Badge variant="secondary" className={statusColors[sub.status] || ""}>{sub.status}</Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Subscription Detail Dialog */}
      {selectedSub && (() => {
        const app = appList.find((a: any) => a.id === selectedSub.consumerAppId);
        const api = apiList.find((a: any) => a.id === selectedSub.apiId);
        return (
          <Dialog open={!!selectedSub} onOpenChange={(o) => { if (!o) setSelectedSub(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Subscription Details</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">App</span><span className="font-medium">{app?.name || `#${selectedSub.consumerAppId}`}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">API</span><span className="font-medium">{api?.name || `#${selectedSub.apiId}`}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="secondary" className={statusColors[selectedSub.status] || ""}>{selectedSub.status}</Badge></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Created</span><span>{selectedSub.createdAt ? new Date(selectedSub.createdAt).toLocaleDateString() : "N/A"}</span></div>
                {selectedSub.approvedAt && <div className="flex justify-between"><span className="text-muted-foreground">Approved</span><span>{new Date(selectedSub.approvedAt).toLocaleDateString()}</span></div>}
                {selectedSub.apiKey && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="text-muted-foreground text-xs w-16">API Key</span>
                    <code className="text-xs font-mono flex-1">{"•".repeat(16)}{selectedSub.apiKey.slice(-8)}</code>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { navigator.clipboard.writeText(selectedSub.apiKey); toast.success("Copied"); }}><Copy className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
              {selectedSub.status === "approved" && (
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button size="sm" variant="outline" className="flex-1" disabled={rotateKeyMutation.isPending} onClick={() => rotateKeyMutation.mutate({ id: selectedSub.id })}>
                    <RefreshCw className="h-3 w-3 mr-1" />{rotateKeyMutation.isPending ? "Rotating..." : "Rotate Key"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30" disabled={revokeMutation.isPending} onClick={() => revokeMutation.mutate({ id: selectedSub.id })}>
                    <Ban className="h-3 w-3 mr-1" />{revokeMutation.isPending ? "Revoking..." : "Revoke"}
                  </Button>
                </div>
              )}
              {selectedSub.status === "pending" && (
                <div className="flex gap-2 mt-4 pt-3 border-t">
                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={approveMutation.isPending} onClick={() => approveMutation.mutate({ id: selectedSub.id })}>
                    <CheckCircle className="h-3 w-3 mr-1" />{approveMutation.isPending ? "Approving..." : "Approve"}
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 text-destructive border-destructive/30" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate({ id: selectedSub.id })}>
                    <XCircle className="h-3 w-3 mr-1" />{rejectMutation.isPending ? "Rejecting..." : "Reject"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
