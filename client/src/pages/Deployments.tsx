import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Rocket, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, PowerOff, Globe, ChevronDown, ChevronRight, FileText } from "lucide-react";

export default function Deployments() {
  const [open, setOpen] = useState(false);
  const [retireTarget, setRetireTarget] = useState<any | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [apiId, setApiId] = useState("");
  const [selectedClusterIds, setSelectedClusterIds] = useState<number[]>([]);
  const [deployToAll, setDeployToAll] = useState(false);
  const [version, setVersion] = useState("1.0.0");
  const [strategy, setStrategy] = useState<"rolling" | "blue_green" | "canary">("rolling");
  // Confirmation state when API has no graviteeApiId and will be auto-published
  const [confirmPublish, setConfirmPublish] = useState<{ apiName: string; clusterIds: number[] | "all"; version: string; strategy: "rolling" | "blue_green" | "canary" } | null>(null);

  const { data: deployments, refetch } = trpc.gateway.deployments.useQuery({});
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList = (apis as any[]) ?? [];
  const clusterList = (clusters as any[]) ?? [];

  const deploy = trpc.gateway.deploy.useMutation({
    onSuccess: (results) => {
      refetch();
      setOpen(false);
      const count = Array.isArray(results) ? results.length : 1;
      toast.success(`Deployed to ${count} cluster${count !== 1 ? "s" : ""}`);
      resetForm();
    },
    onError: (err) => toast.error(err.message),
  });
  const undeploy = trpc.gateway.undeploy.useMutation({
    onSuccess: () => { refetch(); toast.success("API retired from cluster"); },
  });

  function resetForm() {
    setApiId(""); setSelectedClusterIds([]); setDeployToAll(false); setVersion("1.0.0"); setStrategy("rolling");
  }

  function toggleCluster(id: number) {
    setSelectedClusterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleDeploy() {
    if (!apiId) { toast.error("Select an API"); return; }
    const clusterIds = deployToAll ? "all" : selectedClusterIds;
    if (clusterIds !== "all" && selectedClusterIds.length === 0) { toast.error("Select at least one cluster"); return; }

    const selectedApi = apiList.find((a: any) => String(a.id) === apiId);
    if (selectedApi && !selectedApi.graviteeApiId) {
      // API not yet in Gravitee — ask for confirmation before auto-publishing
      setOpen(false);
      setConfirmPublish({ apiName: selectedApi.name, clusterIds, version, strategy });
      return;
    }
    deploy.mutate({ apiId: Number(apiId), clusterIds, version, strategy });
  }

  function confirmAndDeploy() {
    if (!confirmPublish) return;
    deploy.mutate({ apiId: Number(apiId), clusterIds: confirmPublish.clusterIds, version: confirmPublish.version, strategy: confirmPublish.strategy });
    setConfirmPublish(null);
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case "deployed": return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case "deploying": case "syncing": return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
      case "failed": return <XCircle className="w-4 h-4 text-red-600" />;
      case "pending": return <Clock className="w-4 h-4 text-yellow-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-400" />;
    }
  };

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      deployed: "bg-green-100 text-green-700",
      deploying: "bg-blue-100 text-blue-700",
      failed: "bg-red-100 text-red-700",
      pending: "bg-yellow-100 text-yellow-700",
      undeployed: "bg-gray-100 text-gray-700",
    };
    return colors[s] || "bg-gray-100 text-gray-700";
  };

  const syncBadge = (s: string) => {
    const colors: Record<string, string> = {
      synced: "bg-green-50 text-green-600 border-green-200",
      out_of_sync: "bg-orange-50 text-orange-600 border-orange-200",
      syncing: "bg-blue-50 text-blue-600 border-blue-200",
      error: "bg-red-50 text-red-600 border-red-200",
    };
    return colors[s] || "bg-gray-50 text-gray-600";
  };

  const canDeploy = !!apiId && (deployToAll || selectedClusterIds.length > 0) && !deploy.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Deployments</h1>
          <p className="text-muted-foreground">Deploy and manage APIs across gateway clusters</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Rocket className="w-4 h-4 mr-2" />Deploy API</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Deploy API to Gateway</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              {/* API selection */}
              <div>
                <Label>API</Label>
                <Select value={apiId} onValueChange={setApiId}>
                  <SelectTrigger><SelectValue placeholder="Select API..." /></SelectTrigger>
                  <SelectContent>
                    {apiList.filter((a: any) => a.status === "published").map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name} {a.version && `(v${a.version})`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {apiList.filter((a: any) => a.status !== "published").length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Only published APIs can be deployed</p>
                )}
              </div>

              {/* Target clusters */}
              <div>
                <Label>Target Clusters</Label>
                <div className="mt-2 space-y-2 border rounded-lg p-3">
                  {/* Deploy to All option */}
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Checkbox
                      id="deploy-all"
                      checked={deployToAll}
                      onCheckedChange={checked => { setDeployToAll(!!checked); if (checked) setSelectedClusterIds([]); }}
                    />
                    <label htmlFor="deploy-all" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-amber-500" />
                      Deploy to All Clusters
                    </label>
                  </div>
                  {/* Individual cluster checkboxes */}
                  {clusterList.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-1">No clusters registered</p>
                  ) : clusterList.map((c: any) => (
                    <div key={c.id} className={`flex items-center gap-2 ${deployToAll ? "opacity-40" : ""}`}>
                      <Checkbox
                        id={`cluster-${c.id}`}
                        checked={deployToAll || selectedClusterIds.includes(c.id)}
                        disabled={deployToAll}
                        onCheckedChange={() => toggleCluster(c.id)}
                      />
                      <label htmlFor={`cluster-${c.id}`} className="flex-1 text-sm cursor-pointer">
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">
                          {c.region} · env:{c.graviteeEnvId || "DEFAULT"} · {c.tier}
                        </span>
                      </label>
                      <Badge className={c.status === "healthy" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Version + Strategy */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Version</Label>
                  <Input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0" />
                </div>
                <div>
                  <Label>Strategy</Label>
                  <Select value={strategy} onValueChange={v => setStrategy(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rolling">Rolling</SelectItem>
                      <SelectItem value="blue_green">Blue/Green</SelectItem>
                      <SelectItem value="canary">Canary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Strategy hint */}
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                {strategy === "rolling" && "Rolling: instances updated one by one, zero downtime."}
                {strategy === "blue_green" && "Blue/Green: new version deployed alongside old; traffic switched atomically."}
                {strategy === "canary" && "Canary: new version receives a small traffic slice first; full rollout after validation."}
              </div>

              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!canDeploy} onClick={handleDeploy}>
                {deploy.isPending
                  ? "Deploying..."
                  : `Deploy to ${deployToAll ? "All Clusters" : `${selectedClusterIds.length} Cluster${selectedClusterIds.length !== 1 ? "s" : ""}`}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total Deployments</div>
            <div className="text-2xl font-bold text-amber-600">{deployments?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Active</div>
            <div className="text-2xl font-bold text-green-600">{deployments?.filter((d: any) => d.status === "deployed").length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Deploying</div>
            <div className="text-2xl font-bold text-blue-600">{deployments?.filter((d: any) => d.status === "deploying").length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Failed</div>
            <div className="text-2xl font-bold text-red-600">{deployments?.filter((d: any) => d.status === "failed").length || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Deployments Table */}
      <Card>
        <CardHeader><CardTitle>Deployment History</CardTitle></CardHeader>
        <CardContent>
          {deployments && deployments.length > 0 ? (
            <div className="space-y-2">
              {deployments.map((d: any) => {
                const api = apiList.find((a: any) => a.id === d.apiId);
                const cluster = clusterList.find((c: any) => c.id === d.clusterId);
                const opLog: any[] = d.operationLog || [];
                const isExpanded = expandedLog === d.id;
                return (
                  <div key={d.id} className="border rounded-lg overflow-hidden">
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                      <div className="flex items-center gap-1.5 w-8">
                        {statusIcon(d.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{api?.name ?? `API #${d.apiId}`}</span>
                          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{d.version}</code>
                          <Badge className={statusBadge(d.status)}>{d.status}</Badge>
                          <Badge variant="outline" className={syncBadge(d.syncStatus)}>{d.syncStatus?.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span>{cluster?.name ?? `Cluster #${d.clusterId}`} · env:{cluster?.graviteeEnvId ?? "—"}</span>
                          <span className="capitalize">{d.strategy?.replace("_", "/")}</span>
                          <span>{d.deployedAt ? new Date(d.deployedAt).toLocaleString() : d.createdAt ? `Started ${new Date(d.createdAt).toLocaleString()}` : "—"}</span>
                        </div>
                        {/* Inline error message */}
                        {d.status === "failed" && d.errorMessage && (
                          <div className="mt-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
                            <span className="font-medium">Error: </span>{d.errorMessage}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Operation log toggle */}
                        {opLog.length > 0 && (
                          <Button size="sm" variant="ghost" className="text-muted-foreground h-7 px-2" onClick={() => setExpandedLog(isExpanded ? null : d.id)}>
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </Button>
                        )}
                        {d.status === "deployed" && (
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5 h-7" onClick={() => setRetireTarget(d)}>
                            <PowerOff className="h-3 w-3 mr-1" />Retire
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expandable operation log */}
                    {isExpanded && opLog.length > 0 && (
                      <div className="border-t bg-gray-950 px-4 py-3 font-mono text-xs">
                        <div className="text-gray-400 mb-2 uppercase tracking-wide text-[10px]">Operation Log — Deployment #{d.id}</div>
                        {opLog.map((entry: any, i: number) => (
                          <div key={i} className="flex gap-3 py-0.5">
                            <span className="text-gray-500 shrink-0">{new Date(entry.ts).toLocaleTimeString()}</span>
                            <span className={`shrink-0 w-12 ${entry.result === "ok" ? "text-green-400" : entry.result === "warn" ? "text-yellow-400" : "text-red-400"}`}>
                              {entry.result === "ok" ? "[ OK ]" : entry.result === "warn" ? "[WARN]" : "[FAIL]"}
                            </span>
                            <span className="text-amber-300 shrink-0">{entry.action}</span>
                            <span className="text-gray-300 break-all">{entry.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Rocket className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No deployments yet. Deploy your first API to a gateway cluster.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retire Confirmation Dialog */}
      {retireTarget && (
        <Dialog open={!!retireTarget} onOpenChange={() => setRetireTarget(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" />Retire Deployment</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-sm">You are about to retire <strong>{apiList.find((a: any) => a.id === retireTarget.apiId)?.name ?? `API #${retireTarget.apiId}`}</strong> from <strong>{clusterList.find((c: any) => c.id === retireTarget.clusterId)?.name ?? `Cluster #${retireTarget.clusterId}`}</strong>.</p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-medium mb-1">Before retiring, confirm:</p>
                <ul className="space-y-1 text-xs list-disc list-inside">
                  <li>All consumer applications using this API have been notified</li>
                  <li>No active traffic is being served through this deployment</li>
                  <li>Downstream systems have migrated to alternative endpoints</li>
                </ul>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setRetireTarget(null)}>Cancel</Button>
                <Button variant="destructive" className="flex-1" disabled={undeploy.isPending} onClick={() => { undeploy.mutate({ id: retireTarget.id }); setRetireTarget(null); }}>
                  <PowerOff className="h-3 w-3 mr-1" />{undeploy.isPending ? "Retiring..." : "Confirm Retire"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Auto-publish confirmation dialog */}
      <Dialog open={!!confirmPublish} onOpenChange={open => { if (!open) setConfirmPublish(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Publish to Gravitee before deploying?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 text-sm">
            <p>
              <strong>{confirmPublish?.apiName}</strong> has not been registered in Gravitee yet.
              Deploying it will first create it in Gravitee (with its plans), then push it to the gateway.
            </p>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs space-y-1">
              <p className="font-medium">This will:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Create the API definition in Gravitee Management</li>
                <li>Publish its plans (or create a default keyless plan if none exist)</li>
                <li>Deploy to the selected cluster and start traffic</li>
              </ul>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setConfirmPublish(null); setOpen(true); }}>Back</Button>
              <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" disabled={deploy.isPending} onClick={confirmAndDeploy}>
                <Rocket className="h-3 w-3 mr-1.5" />{deploy.isPending ? "Publishing & Deploying…" : "Publish & Deploy"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
