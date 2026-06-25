import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GitBranch, Plus, ArrowRight, Layers, Workflow } from "lucide-react";

export default function Environments() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [gitBranch, setGitBranch] = useState("");
  const [gitFolder, setGitFolder] = useState("");
  const [argoAppName, setArgoAppName] = useState("");
  const [autoPromote, setAutoPromote] = useState(false);

  const [promoteEnv, setPromoteEnv] = useState<any | null>(null);
  const [promoteNextEnv, setPromoteNextEnv] = useState<any | null>(null);
  const [selectedApiIds, setSelectedApiIds] = useState<number[]>([]);

  const { data: environments, refetch } = trpc.env.list.useQuery();
  const { data: apis } = trpc.api.list.useQuery({});
  const createEnv = trpc.env.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Environment created"); resetForm(); },
  });
  const deployMutation = trpc.gateway.deploy.useMutation();

  const apiList = (apis as any[]) || [];

  function resetForm() { setName(""); setSlug(""); setGitBranch(""); setGitFolder(""); setArgoAppName(""); setAutoPromote(false); }

  function openPromote(env: any) {
    const envList = (environments as any[]) || [];
    const idx = envList.findIndex((e: any) => e.id === env.id);
    const next = envList[idx + 1];
    if (!next) { toast.info("This is the last environment — no promotion target"); return; }
    setPromoteEnv(env);
    setPromoteNextEnv(next);
    setSelectedApiIds(apiList.map((a: any) => a.id));
  }

  async function runPromotion() {
    if (!promoteNextEnv?.clusterId) { toast.error("Target environment has no cluster assigned"); return; }
    let count = 0;
    for (const apiId of selectedApiIds) {
      const api = apiList.find((a: any) => a.id === apiId);
      try {
        await deployMutation.mutateAsync({ apiId, clusterIds: [promoteNextEnv.clusterId], version: api?.version || "1.0.0" });
        count++;
      } catch {
        toast.error(`Failed to deploy API #${apiId}`);
      }
    }
    toast.success(`Promoted ${count} API${count !== 1 ? "s" : ""} to ${promoteNextEnv.name}`);
    setPromoteEnv(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Environments & APIOps</h1>
          <p className="text-muted-foreground">GitOps promotion pipeline with ArgoCD integration</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add Environment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Environment</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Environment Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Staging" /></div>
              <div><Label>Slug</Label><Input value={slug} onChange={e => setSlug(e.target.value)} placeholder="staging" /></div>
              <div><Label>Git Branch</Label><Input value={gitBranch} onChange={e => setGitBranch(e.target.value)} placeholder="main" /></div>
              <div><Label>Git Folder</Label><Input value={gitFolder} onChange={e => setGitFolder(e.target.value)} placeholder="environments/staging/" /></div>
              <div><Label>ArgoCD App Name</Label><Input value={argoAppName} onChange={e => setArgoAppName(e.target.value)} placeholder="apigw-staging" /></div>
              <div className="flex items-center justify-between">
                <Label>Auto-Promote on Success</Label>
                <Switch checked={autoPromote} onCheckedChange={setAutoPromote} />
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || !slug || createEnv.isPending}
                onClick={() => createEnv.mutate({ name, slug, gitBranch: gitBranch || undefined, gitFolder: gitFolder || undefined, argoAppName: argoAppName || undefined, autoPromote })}>
                {createEnv.isPending ? "Creating..." : "Create Environment"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pipeline Visualization */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Workflow className="w-5 h-5 text-amber-600" />Promotion Pipeline</CardTitle></CardHeader>
        <CardContent>
          {environments && environments.length > 0 ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {environments.map((env: any, idx: number) => (
                <div key={env.id} className="flex items-center gap-2">
                  <div className="min-w-[180px] border-2 border-amber-200 rounded-lg p-4 bg-amber-50">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold">{env.name}</span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {env.gitBranch && <div className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{env.gitBranch}</div>}
                      {env.argoAppName && <div>ArgoCD: {env.argoAppName}</div>}
                      {env.autoPromote && <Badge className="bg-green-100 text-green-700 text-xs">Auto-promote</Badge>}
                    </div>
                  </div>
                  {idx < environments.length - 1 && <ArrowRight className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p>Define environments to create your promotion pipeline (e.g., Dev → Staging → Production)</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Environment Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {environments?.map((env: any) => (
          <Card key={env.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{env.name}</CardTitle>
                <Badge variant="outline">{env.slug}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {env.gitBranch && <div><span className="text-muted-foreground">Branch:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{env.gitBranch}</code></div>}
              {env.gitFolder && <div><span className="text-muted-foreground">Folder:</span> <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{env.gitFolder}</code></div>}
              {env.argoAppName && <div><span className="text-muted-foreground">ArgoCD:</span> {env.argoAppName}</div>}
              {env.clusterId && <div><span className="text-muted-foreground">Cluster:</span> #{env.clusterId}</div>}
              <div className="flex items-center gap-2 pt-2">
                <Badge className={env.autoPromote ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                  {env.autoPromote ? "Auto-promote enabled" : "Manual promotion"}
                </Badge>
              </div>
              <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => openPromote(env)}>
                Promote <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Promote Dialog */}
      <Dialog open={!!promoteEnv} onOpenChange={open => { if (!open) setPromoteEnv(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promote to {promoteNextEnv?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">{promoteEnv?.name}</Badge>
              <ArrowRight className="w-4 h-4 text-amber-500" />
              <Badge className="bg-amber-100 text-amber-700">{promoteNextEnv?.name}</Badge>
            </div>
            {!promoteNextEnv?.clusterId && (
              <p className="text-sm text-red-600">Target environment has no cluster — assign a cluster first.</p>
            )}
            <div>
              <Label className="text-sm mb-2 block">APIs to promote</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {apiList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No APIs found</p>
                ) : apiList.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <Checkbox id={`promote-api-${a.id}`} checked={selectedApiIds.includes(a.id)}
                      onCheckedChange={() => setSelectedApiIds(prev => prev.includes(a.id) ? prev.filter(id => id !== a.id) : [...prev, a.id])} />
                    <label htmlFor={`promote-api-${a.id}`} className="text-sm cursor-pointer flex-1">
                      {a.name} <span className="text-muted-foreground">v{a.version}</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              disabled={selectedApiIds.length === 0 || !promoteNextEnv?.clusterId || deployMutation.isPending}
              onClick={runPromotion}>
              {deployMutation.isPending ? "Promoting..." : `Promote ${selectedApiIds.length} API${selectedApiIds.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {(!environments || environments.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Environments Configured</h3>
            <p className="text-muted-foreground text-sm mb-4">Set up your GitOps promotion pipeline with environments linked to Git branches and ArgoCD</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Create First Environment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
