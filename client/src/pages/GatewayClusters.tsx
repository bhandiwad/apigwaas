import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Server, Plus, Globe } from "lucide-react";

export default function GatewayClusters() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("ap-south-1");
  const [tier, setTier] = useState<"shared" | "dedicated" | "sovereign">("shared");
  const [maxNodes, setMaxNodes] = useState(10);
  const [graviteeVersion, setGraviteeVersion] = useState("4.4.0");
  const [graviteeEnvId, setGraviteeEnvId] = useState("DEFAULT");
  const [graviteeOrgId, setGraviteeOrgId] = useState("DEFAULT");
  const [managementUrl, setManagementUrl] = useState("");

  const { data: clusters, refetch } = trpc.gateway.clusters.useQuery();
  const createCluster = trpc.gateway.createCluster.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Cluster created"); resetForm(); },
  });

  function resetForm() { setName(""); setDescription(""); setRegion("ap-south-1"); setTier("shared"); setMaxNodes(10); setGraviteeEnvId("DEFAULT"); setGraviteeOrgId("DEFAULT"); setManagementUrl(""); }

  const statusColor = (s: string) => {
    switch (s) {
      case "healthy": return "bg-green-100 text-green-700 border-green-300";
      case "degraded": return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "offline": return "bg-red-100 text-red-700 border-red-300";
      default: return "bg-blue-100 text-blue-700 border-blue-300";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gateway Clusters</h1>
          <p className="text-muted-foreground">Manage Gravitee gateway clusters across regions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Cluster</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Gateway Cluster</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Cluster Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="prod-mumbai-01" /></div>
              <div><Label>Description (optional)</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Production gateway cluster" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Region</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ap-south-1">Mumbai (ap-south-1)</SelectItem>
                      <SelectItem value="ap-south-2">Hyderabad (ap-south-2)</SelectItem>
                      <SelectItem value="ap-southeast-1">Singapore (ap-southeast-1)</SelectItem>
                      <SelectItem value="eu-west-1">Ireland (eu-west-1)</SelectItem>
                      <SelectItem value="us-east-1">N. Virginia (us-east-1)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Tier</Label>
                  <Select value={tier} onValueChange={v => setTier(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="shared">Shared</SelectItem>
                      <SelectItem value="dedicated">Dedicated</SelectItem>
                      <SelectItem value="sovereign">Sovereign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Gravitee Management URL</Label><Input value={managementUrl} onChange={e => setManagementUrl(e.target.value)} placeholder="http://gateway-host:8083" className="font-mono text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Gravitee Org ID</Label><Input value={graviteeOrgId} onChange={e => setGraviteeOrgId(e.target.value)} placeholder="DEFAULT" className="font-mono text-sm" /></div>
                <div><Label>Gravitee Env ID</Label><Input value={graviteeEnvId} onChange={e => setGraviteeEnvId(e.target.value)} placeholder="DEFAULT" className="font-mono text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Max Nodes</Label><Input type="number" value={maxNodes} onChange={e => setMaxNodes(Number(e.target.value))} /></div>
                <div><Label>Gravitee Version</Label><Input value={graviteeVersion} onChange={e => setGraviteeVersion(e.target.value)} placeholder="4.4.32" /></div>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => createCluster.mutate({ name, description, region, tier, maxNodes, graviteeVersion, graviteeEnvId, graviteeOrgId, managementUrl: managementUrl || undefined })}
                disabled={!name || !managementUrl || createCluster.isPending}>
                {createCluster.isPending ? "Creating..." : "Register Cluster"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cluster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {clusters?.map((cluster: any) => (
          <Card key={cluster.id} className="border-l-4 border-l-amber-400">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-amber-600" />
                  <CardTitle className="text-lg">{cluster.name}</CardTitle>
                </div>
                <Badge className={statusColor(cluster.status)}>{cluster.status}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Globe className="w-3 h-3" />{cluster.region}
                <span className="mx-1">•</span>
                <span className="capitalize">{cluster.tier}</span>
                {cluster.graviteeVersion && <><span className="mx-1">•</span>v{cluster.graviteeVersion}</>}
              </div>
              {cluster.managementUrl && (
                <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                  env:{cluster.graviteeEnvId || "DEFAULT"} · {cluster.managementUrl}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Live Nodes</div>
                  <div className="font-semibold text-amber-600">{cluster.nodeCount ?? 0}/{cluster.maxNodes}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Gateway</div>
                  <div className="font-semibold text-blue-600 truncate" title={cluster.gatewayVersion || ""}>
                    {cluster.gatewayVersion ? `v${String(cluster.gatewayVersion).split(" ")[0]}` : "—"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-xs text-muted-foreground">Tags</div>
                  <div className="font-semibold text-blue-600">{(cluster.shardingTags as any[])?.length || 0}</div>
                </div>
              </div>

              {cluster.stoppedNodeCount > 0 && (
                <div className="text-xs text-amber-600">{cluster.stoppedNodeCount} stopped node{cluster.stoppedNodeCount > 1 ? "s" : ""} still reporting</div>
              )}

              {/* Live gateway instances reported by Gravitee */}
              {cluster.liveInstances?.length > 0 ? (
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Live Instances</div>
                  {cluster.liveInstances.map((inst: any) => (
                    <div key={inst.id} className="flex items-center justify-between text-xs border rounded px-2 py-1">
                      <span className="font-mono truncate">{inst.hostname || inst.id}</span>
                      <Badge className={inst.state === "STARTED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>{inst.state}</Badge>
                    </div>
                  ))}
                </div>
              ) : cluster.syncSource === "gravitee" ? (
                <div className="text-xs text-muted-foreground">No live gateway nodes reporting to this cluster.</div>
              ) : (
                <div className="text-xs text-muted-foreground">Gateway unreachable — live node status unavailable.</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {(!clusters || clusters.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Gateway Clusters</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first Gravitee gateway cluster to start deploying APIs</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Create Cluster
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
