import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Rocket, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

export default function Deployments() {
  const [open, setOpen] = useState(false);
  const [apiId, setApiId] = useState("");
  const [clusterId, setClusterId] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [strategy, setStrategy] = useState<"rolling" | "blue_green" | "canary">("rolling");

  const { data: deployments, refetch } = trpc.gateway.deployments.useQuery({});
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const { data: tenants } = trpc.tenant.list.useQuery();

  const deploy = trpc.gateway.deploy.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Deployment initiated"); },
  });
  const undeploy = trpc.gateway.undeploy.useMutation({
    onSuccess: () => { refetch(); toast.success("API undeployed"); },
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Deployments</h1>
          <p className="text-muted-foreground">Deploy and manage APIs across gateway clusters</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Rocket className="w-4 h-4 mr-2" />Deploy API</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Deploy API to Cluster</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>API ID</Label><Input type="number" value={apiId} onChange={e => setApiId(e.target.value)} placeholder="Enter API ID" /></div>
              <div><Label>Target Cluster</Label>
                <Select value={clusterId} onValueChange={setClusterId}>
                  <SelectTrigger><SelectValue placeholder="Select cluster" /></SelectTrigger>
                  <SelectContent>
                    {clusters?.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.region})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Version</Label><Input value={version} onChange={e => setVersion(e.target.value)} placeholder="1.0.0" /></div>
              <div><Label>Deployment Strategy</Label>
                <Select value={strategy} onValueChange={v => setStrategy(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rolling">Rolling Update</SelectItem>
                    <SelectItem value="blue_green">Blue/Green</SelectItem>
                    <SelectItem value="canary">Canary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!apiId || !clusterId || deploy.isPending}
                onClick={() => deploy.mutate({ apiId: Number(apiId), clusterId: Number(clusterId), tenantId: tenants?.[0]?.id || 1, version, strategy })}>
                {deploy.isPending ? "Deploying..." : "Deploy"}
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">API</th>
                    <th className="pb-3 font-medium">Cluster</th>
                    <th className="pb-3 font-medium">Version</th>
                    <th className="pb-3 font-medium">Strategy</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Sync</th>
                    <th className="pb-3 font-medium">Deployed At</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deployments.map((d: any) => (
                    <tr key={d.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium">API #{d.apiId}</td>
                      <td className="py-3">Cluster #{d.clusterId}</td>
                      <td className="py-3"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{d.version}</code></td>
                      <td className="py-3 capitalize">{d.strategy?.replace("_", "/")}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-1.5">
                          {statusIcon(d.status)}
                          <Badge className={statusBadge(d.status)}>{d.status}</Badge>
                        </div>
                      </td>
                      <td className="py-3"><Badge variant="outline" className={syncBadge(d.syncStatus)}>{d.syncStatus?.replace("_", " ")}</Badge></td>
                      <td className="py-3 text-muted-foreground">{d.deployedAt ? new Date(d.deployedAt).toLocaleString() : "—"}</td>
                      <td className="py-3">
                        {d.status === "deployed" && (
                          <Button size="sm" variant="destructive" onClick={() => undeploy.mutate({ id: d.id })}>Undeploy</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Rocket className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No deployments yet. Deploy your first API to a gateway cluster.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
