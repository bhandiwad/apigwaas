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
  GitBranch, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  Play, Eye, RefreshCw, GitCommit, Layers
} from "lucide-react";

type EnvKey = "dev" | "staging" | "production";

const ENVS: { key: EnvKey; label: string; color: string; branch: string }[] = [
  { key: "dev",        label: "Development", color: "border-blue-400 bg-blue-50",    branch: "main" },
  { key: "staging",    label: "Staging",     color: "border-amber-400 bg-amber-50",  branch: "release" },
  { key: "production", label: "Production",  color: "border-emerald-400 bg-emerald-50", branch: "production" },
];

type PromotionStatus = "idle" | "running" | "success" | "failed";

interface ApiPromotion {
  apiId: number;
  name: string;
  version: string;
  status: Record<EnvKey, PromotionStatus>;
  lastDeployed: Record<EnvKey, string | null>;
}

export default function GitOpsPipelinePage() {
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList: any[] = (apis as any[]) || [];

  const [promotions, setPromotions] = useState<Record<number, ApiPromotion>>({});
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selectedApiId, setSelectedApiId] = useState<string>("");
  const [fromEnv, setFromEnv] = useState<EnvKey>("dev");
  const [toEnv, setToEnv] = useState<EnvKey>("staging");
  const [diffOpen, setDiffOpen] = useState<{ api: any; env: EnvKey } | null>(null);

  function getPromotion(apiId: number): ApiPromotion {
    return promotions[apiId] || {
      apiId,
      name: apiList.find(a => a.id === apiId)?.name || "",
      version: apiList.find(a => a.id === apiId)?.version || "1.0.0",
      status: { dev: "success", staging: "idle", production: "idle" },
      lastDeployed: { dev: new Date(Date.now() - 3600000).toISOString(), staging: null, production: null },
    };
  }

  function simulatePromotion(apiId: number, targetEnv: EnvKey) {
    setPromotions(prev => ({
      ...prev,
      [apiId]: {
        ...getPromotion(apiId),
        status: { ...getPromotion(apiId).status, [targetEnv]: "running" },
      },
    }));
    setTimeout(() => {
      setPromotions(prev => ({
        ...prev,
        [apiId]: {
          ...getPromotion(apiId),
          status: { ...getPromotion(apiId).status, [targetEnv]: "success" },
          lastDeployed: { ...getPromotion(apiId).lastDeployed, [targetEnv]: new Date().toISOString() },
        },
      }));
      toast.success(`Promotion to ${targetEnv} complete`);
    }, 3000);
  }

  function handlePromote() {
    if (!selectedApiId) return;
    const id = Number(selectedApiId);
    simulatePromotion(id, toEnv);
    setPromoteOpen(false);
    toast.info(`Promoting ${getPromotion(id).name} from ${fromEnv} → ${toEnv}…`);
  }

  const StatusIcon = ({ s }: { s: PromotionStatus }) => {
    if (s === "success") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (s === "running") return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
    if (s === "failed")  return <AlertTriangle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const StatusBadge = ({ s }: { s: PromotionStatus }) => {
    const map: Record<PromotionStatus, string> = {
      success: "bg-emerald-100 text-emerald-700",
      running: "bg-blue-100 text-blue-700",
      failed:  "bg-red-100 text-red-700",
      idle:    "bg-gray-100 text-gray-500",
    };
    return <Badge className={`text-xs ${map[s]}`}>{s}</Badge>;
  };

  // Promoted APIs are ones that user has explicitly promoted, plus show published APIs in dev by default
  const publishedApis = apiList.filter(a => a.status === "published" || a.status === "deprecated" || promotions[a.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">GitOps Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">Promote API configurations across environments via Git branches</p>
        </div>
        <Button onClick={() => setPromoteOpen(true)}>
          <Play className="w-4 h-4 mr-2" />Promote API
        </Button>
      </div>

      {/* Branch / environment overview */}
      <div className="grid grid-cols-3 gap-4">
        {ENVS.map((env, idx) => (
          <div key={env.key} className={`relative rounded-xl border-2 p-4 ${env.color}`}>
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{env.label}</span>
            </div>
            <code className="text-xs text-muted-foreground">branch: {env.branch}</code>
            <div className="mt-3 text-xs text-muted-foreground">
              {publishedApis.length} APIs tracked
            </div>
            {idx < ENVS.length - 1 && (
              <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
            )}
          </div>
        ))}
      </div>

      {/* Pipeline status per API */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4" />Promotion Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {publishedApis.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <GitCommit className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No published APIs yet. Publish an API to start the GitOps pipeline.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 text-left font-medium">API</th>
                    <th className="pb-2 text-left font-medium">Version</th>
                    {ENVS.map(e => (
                      <th key={e.key} className="pb-2 text-left font-medium">{e.label}</th>
                    ))}
                    <th className="pb-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedApis.map((api: any) => {
                    const p = getPromotion(api.id);
                    return (
                      <tr key={api.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 font-medium">{api.name}</td>
                        <td className="py-3"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{api.version}</code></td>
                        {ENVS.map(env => (
                          <td key={env.key} className="py-3">
                            <div className="flex items-center gap-1.5">
                              <StatusIcon s={p.status[env.key]} />
                              <StatusBadge s={p.status[env.key]} />
                            </div>
                            {p.lastDeployed[env.key] && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {new Date(p.lastDeployed[env.key]!).toLocaleTimeString()}
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="py-3">
                          <div className="flex gap-1">
                            {p.status.dev === "success" && p.status.staging !== "success" && p.status.staging !== "running" && (
                              <Button size="sm" variant="outline" className="text-xs h-7"
                                onClick={() => simulatePromotion(api.id, "staging")}>
                                → Staging
                              </Button>
                            )}
                            {p.status.staging === "success" && p.status.production !== "success" && p.status.production !== "running" && (
                              <Button size="sm" className="text-xs h-7 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => simulatePromotion(api.id, "production")}>
                                → Production
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-xs h-7 px-2"
                              onClick={() => setDiffOpen({ api, env: "staging" })}>
                              <Eye className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent pipeline runs */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Pipeline Runs</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {publishedApis.slice(0, 5).map((api: any, i: number) => (
              <div key={api.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{api.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">deployed to dev</span>
                </div>
                <span className="text-xs text-muted-foreground">{i + 1}h ago</span>
                <Badge className="bg-emerald-100 text-emerald-700 text-xs">success</Badge>
              </div>
            ))}
            {publishedApis.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No pipeline runs yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Promote dialog */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promote API</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">API</Label>
              <Select value={selectedApiId} onValueChange={setSelectedApiId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select API…" /></SelectTrigger>
                <SelectContent>
                  {apiList.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name} v{a.version}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">From</Label>
                <Select value={fromEnv} onValueChange={v => setFromEnv(v as EnvKey)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENVS.map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">To</Label>
                <Select value={toEnv} onValueChange={v => setToEnv(v as EnvKey)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENVS.filter(e => e.key !== fromEnv).map(e => <SelectItem key={e.key} value={e.key}>{e.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" disabled={!selectedApiId} onClick={handlePromote}>
              <Play className="w-4 h-4 mr-2" />Start Promotion
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Config diff dialog */}
      <Dialog open={!!diffOpen} onOpenChange={o => { if (!o) setDiffOpen(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Config Diff — {diffOpen?.api?.name}</DialogTitle></DialogHeader>
          <pre className="bg-muted p-4 rounded text-xs font-mono overflow-auto max-h-96">
{`--- dev (current)
+++ staging (target)
@@ API Configuration @@
  name: "${diffOpen?.api?.name}"
  version: "${diffOpen?.api?.version}"
  protocol: "${diffOpen?.api?.protocol}"
- contextPath: "${diffOpen?.api?.contextPath || "/api/dev/v1"}"
+ contextPath: "${(diffOpen?.api?.contextPath || "/api/v1").replace("/dev", "")}"
- backendUrl: "https://dev-internal.svc${diffOpen?.api?.contextPath || "/"}"
+ backendUrl: "https://staging-internal.svc${diffOpen?.api?.contextPath || "/"}"
  timeout: 30000
  rateLimit: 1000/min`}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
