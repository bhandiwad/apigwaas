import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  GitBranch, CheckCircle2, Clock, AlertTriangle, XCircle, ArrowRight,
  Play, RefreshCw, GitCommit, Layers, Server
} from "lucide-react";

// A "deployment status" is derived from the real api_deployments records (server/db).
type DeployStatus = "pending" | "deploying" | "deployed" | "failed" | "undeploying" | "undeployed" | "not_deployed";

export default function GitOpsPipelinePage() {
  const utils = trpc.useUtils();
  const { data: apis } = trpc.api.list.useQuery({});
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const { data: deployments } = trpc.gateway.deployments.useQuery({});

  const apiList: any[] = (apis as any[]) || [];
  const clusterList: any[] = (clusters as any[]) || [];
  // Ordered by createdAt DESC by the server, so the first match per (api, cluster) is the latest.
  const deploymentList: any[] = (deployments as any[]) || [];

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selectedApiId, setSelectedApiId] = useState<string>("");
  const [targetClusterId, setTargetClusterId] = useState<string>("");

  const deploy = trpc.gateway.deploy.useMutation({
    onSuccess: (results) => {
      // Real refresh of the deployment records after a genuine deploy.
      utils.gateway.deployments.invalidate();
      const count = Array.isArray(results) ? results.length : 1;
      toast.success(`Deployed to ${count} cluster${count !== 1 ? "s" : ""}`);
    },
    onError: (err) => toast.error(err.message),
  });

  // Latest real deployment record for a given API on a given cluster (or undefined if never deployed).
  function latestDeployment(apiId: number, clusterId: number): any | undefined {
    return deploymentList.find((d) => d.apiId === apiId && d.clusterId === clusterId);
  }

  function statusFor(apiId: number, clusterId: number): DeployStatus {
    return (latestDeployment(apiId, clusterId)?.status as DeployStatus) || "not_deployed";
  }

  function isDeploying(apiId: number, clusterId: number): boolean {
    const v = deploy.variables as any;
    return (
      deploy.isPending &&
      !!v &&
      v.apiId === apiId &&
      Array.isArray(v.clusterIds) &&
      v.clusterIds.includes(clusterId)
    );
  }

  // The real deploy: pushes the API (at its current version) to a specific cluster via Gravitee.
  function deployTo(apiId: number, clusterId: number) {
    const api = apiList.find((a) => a.id === apiId);
    deploy.mutate({
      apiId,
      clusterIds: [clusterId],
      version: api?.version || "1.0.0",
      strategy: "rolling",
    });
  }

  function handlePromote() {
    if (!selectedApiId || !targetClusterId) return;
    deployTo(Number(selectedApiId), Number(targetClusterId));
    setPromoteOpen(false);
    setSelectedApiId("");
    setTargetClusterId("");
  }

  const StatusIcon = ({ s, spinning }: { s: DeployStatus; spinning?: boolean }) => {
    if (spinning || s === "deploying" || s === "undeploying")
      return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    if (s === "deployed") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (s === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    if (s === "pending") return <Clock className="w-4 h-4 text-amber-500" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const StatusBadge = ({ s, spinning }: { s: DeployStatus; spinning?: boolean }) => {
    if (spinning) return <Badge className="text-xs bg-blue-100 text-blue-700">deploying</Badge>;
    const map: Record<DeployStatus, string> = {
      deployed: "bg-emerald-100 text-emerald-700",
      deploying: "bg-blue-100 text-blue-700",
      undeploying: "bg-blue-100 text-blue-700",
      pending: "bg-amber-100 text-amber-700",
      failed: "bg-red-100 text-red-700",
      undeployed: "bg-gray-100 text-gray-500",
      not_deployed: "bg-gray-100 text-gray-400",
    };
    const label = s === "not_deployed" ? "not deployed" : s;
    return <Badge className={`text-xs ${map[s]}`}>{label}</Badge>;
  };

  const clusterStatusColor = (s: string) =>
    s === "healthy" ? "bg-emerald-100 text-emerald-700"
      : s === "offline" ? "bg-red-100 text-red-700"
      : "bg-gray-100 text-gray-600";

  // Show APIs that are published (deployable) or already have a deployment record somewhere.
  const trackedApis = apiList.filter(
    (a) => a.status === "published" || deploymentList.some((d) => d.apiId === a.id)
  );

  // Recent real deployment records (server already sorts newest-first).
  const recentRuns = deploymentList.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitOps Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Promote APIs across your registered gateway clusters</p>
        </div>
        <Button onClick={() => setPromoteOpen(true)} disabled={clusterList.length === 0}>
          <Play className="w-4 h-4 mr-2" />Promote API
        </Button>
      </div>

      {/* Honest banner when there aren't enough clusters to model a promotion pipeline */}
      {clusterList.length < 2 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Multi-stage promotion needs at least two gateway clusters (e.g. staging + production).</p>
            <p className="mt-0.5">Register clusters under Gateway → Clusters.
              {clusterList.length === 1 && " You can still deploy to the cluster you have registered below."}
            </p>
          </div>
        </div>
      )}

      {/* Environment overview — the REAL registered clusters */}
      {clusterList.length > 0 && (
        <div className="flex flex-wrap items-stretch gap-4">
          {clusterList.map((c: any, idx: number) => (
            <div key={c.id} className="relative flex-1 min-w-[220px] rounded-xl border-2 border-muted bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Server className="w-4 h-4 text-muted-foreground" />
                <span className="font-semibold text-sm">{c.name}</span>
                <Badge className={`ml-auto text-xs ${clusterStatusColor(c.status)}`}>{c.status}</Badge>
              </div>
              <code className="text-xs text-muted-foreground">
                {c.region} · env:{c.graviteeEnvId || "DEFAULT"} · {c.tier}
              </code>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{c.nodeCount ?? 0} nodes</span>
                {c.gatewayVersion && <span>v{c.gatewayVersion}</span>}
              </div>
              {idx < clusterList.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-API deployment status across each real cluster */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" />Deployment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clusterList.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <Server className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No gateway clusters registered. Register a cluster under Gateway → Clusters to deploy APIs.</p>
            </div>
          ) : trackedApis.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <GitCommit className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No published APIs yet. Publish an API to start deploying it across clusters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">API</th>
                    <th className="pb-2 text-left font-medium">Version</th>
                    {clusterList.map((c: any) => (
                      <th key={c.id} className="pb-2 text-left font-medium">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trackedApis.map((api: any) => (
                    <tr key={api.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{api.name}</td>
                      <td className="py-3"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{api.version || "—"}</code></td>
                      {clusterList.map((c: any) => {
                        const dep = latestDeployment(api.id, c.id);
                        const s = statusFor(api.id, c.id);
                        const spinning = isDeploying(api.id, c.id);
                        return (
                          <td key={c.id} className="py-3 align-top">
                            <div className="flex items-center gap-1.5">
                              <StatusIcon s={s} spinning={spinning} />
                              <StatusBadge s={s} spinning={spinning} />
                            </div>
                            {dep && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                v{dep.version}
                                {dep.deployedAt
                                  ? ` · ${new Date(dep.deployedAt).toLocaleString()}`
                                  : dep.createdAt
                                  ? ` · ${new Date(dep.createdAt).toLocaleString()}`
                                  : ""}
                              </div>
                            )}
                            {dep?.status === "failed" && dep.errorMessage && (
                              <div className="text-xs text-red-600 mt-0.5 max-w-[220px] truncate" title={dep.errorMessage}>
                                {dep.errorMessage}
                              </div>
                            )}
                            <Button
                              size="sm"
                              variant={s === "deployed" ? "outline" : "default"}
                              className="text-xs h-7 mt-1.5"
                              disabled={spinning}
                              onClick={() => deployTo(api.id, c.id)}
                            >
                              {spinning ? "Deploying…" : s === "not_deployed" ? "Deploy" : `Promote to ${c.name}`}
                            </Button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent deployment records (real data) */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Deployments</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recentRuns.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No deployments yet</p>
            )}
            {recentRuns.map((d: any) => {
              const api = apiList.find((a) => a.id === d.apiId);
              const cluster = clusterList.find((c) => c.id === d.clusterId);
              const s = d.status as DeployStatus;
              return (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                  <StatusIcon s={s} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{api?.name ?? `API #${d.apiId}`}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      → {cluster?.name ?? `Cluster #${d.clusterId}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {d.deployedAt
                      ? new Date(d.deployedAt).toLocaleString()
                      : d.createdAt
                      ? new Date(d.createdAt).toLocaleString()
                      : "—"}
                  </span>
                  <StatusBadge s={s} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Promote dialog — choose an API and a real target cluster */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promote API</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">API</Label>
              <Select value={selectedApiId} onValueChange={setSelectedApiId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select API…" /></SelectTrigger>
                <SelectContent>
                  {apiList
                    .filter((a: any) => a.status === "published")
                    .map((a: any) => (
                      <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.version ? ` v${a.version}` : ""}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {apiList.filter((a: any) => a.status === "published").length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Only published APIs can be deployed.</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Target cluster</Label>
              <Select value={targetClusterId} onValueChange={setTargetClusterId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select cluster…" /></SelectTrigger>
                <SelectContent>
                  {clusterList.map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name} · {c.region} · env:{c.graviteeEnvId || "DEFAULT"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={!selectedApiId || !targetClusterId || deploy.isPending}
              onClick={handlePromote}
            >
              <Play className="w-4 h-4 mr-2" />{deploy.isPending ? "Deploying…" : "Deploy"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
