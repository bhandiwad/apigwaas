import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTenantContext } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SyncBadge } from "@/components/SyncBadge";
import { ArrowLeft, ArrowRight, Check, Rocket, Loader2, CheckCircle2, Server } from "lucide-react";
import { toast } from "sonner";

const STEPS = ["API", "Target & strategy", "Deploy"];
const STRATEGIES = [
  { key: "rolling", label: "Rolling", desc: "Replace instances gradually. Safe default." },
  { key: "blue_green", label: "Blue-green", desc: "Stand up the new version, then switch over." },
  { key: "canary", label: "Canary", desc: "Route a slice of traffic to the new version first." },
] as const;

export default function DeployWizard() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const qsApiId = searchStr ? Number(new URLSearchParams(searchStr).get("apiId")) || 0 : 0;
  const { effectiveTenantId } = useTenantContext();

  const { data: apis } = trpc.api.list.useQuery({ tenantId: effectiveTenantId });
  const apiList = (apis ?? []) as any[];
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const clusterList = (clusters ?? []) as any[];

  const [step, setStep] = useState(0);
  const [apiId, setApiId] = useState<number>(qsApiId);
  const [allClusters, setAllClusters] = useState(true);
  const [clusterIds, setClusterIds] = useState<number[]>([]);
  const [strategy, setStrategy] = useState<(typeof STRATEGIES)[number]["key"]>("rolling");
  const [version, setVersion] = useState("");
  const [result, setResult] = useState<null | { count: number }>(null);

  const api = apiList.find(a => a.id === apiId);
  useEffect(() => { if (api && !version) setVersion(api.version || "1.0.0"); }, [api, version]);

  const deploy = trpc.gateway.deploy.useMutation({
    onSuccess: (r: any) => { setResult({ count: Array.isArray(r) ? r.length : 1 }); },
    onError: (e) => toast.error(e.message),
  });

  function toggleCluster(id: number) {
    setClusterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const step2Valid = allClusters || clusterIds.length > 0;

  function submit() {
    deploy.mutate({ apiId, clusterIds: allClusters ? "all" : clusterIds, version: version || "1.0.0", strategy });
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-bold">Deployment started</h1>
            <p className="text-sm text-muted-foreground">{api?.name} v{version} → {result.count} cluster{result.count === 1 ? "" : "s"} · {STRATEGIES.find(s => s.key === strategy)?.label}</p>
          </div>
        </div>
        <Card><CardContent className="pt-4 text-sm text-muted-foreground">Track status and history on the Deployments page.</CardContent></Card>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/deployments")}>View deployments</Button>
          <Button variant="outline" onClick={() => { setResult(null); setStep(0); }}>Deploy another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/deployments")}><ArrowLeft className="h-4 w-4 mr-1" />Deployments</Button>
        <h1 className="text-2xl font-bold tracking-tight">Deploy API</h1>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>{label}
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <Card><CardContent className="pt-6 space-y-5">
          {step === 0 && (
            <>
              <h2 className="font-semibold">Which API?</h2>
              <div><Label>API</Label>
                <Select value={apiId ? String(apiId) : ""} onValueChange={v => { setApiId(Number(v)); setVersion(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select an API" /></SelectTrigger>
                  <SelectContent>{apiList.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name} <span className="text-muted-foreground">v{a.version}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              {api && (
                <div className="flex items-center gap-2 text-sm">
                  <SyncBadge status={api.syncStatus} />
                  {!api.graviteeApiId && <span className="text-xs text-amber-600">Not on the gateway yet — it'll be published as part of this deploy.</span>}
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-semibold">Target & strategy</h2>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Clusters</Label>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={allClusters} onChange={e => setAllClusters(e.target.checked)} /> All registered clusters
                  </label>
                </div>
                {allClusters ? (
                  <p className="text-sm text-muted-foreground">Deploying to all {clusterList.length} registered cluster{clusterList.length === 1 ? "" : "s"}.</p>
                ) : clusterList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clusters registered.</p>
                ) : (
                  <div className="space-y-1.5">
                    {clusterList.map(c => (
                      <button key={c.id} type="button" onClick={() => toggleCluster(c.id)}
                        className={`w-full flex items-center gap-2 rounded-lg border p-2.5 text-left transition-colors ${clusterIds.includes(c.id) ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium flex-1">{c.name}</span>
                        <span className="text-xs text-muted-foreground">{c.region}</span>
                        {clusterIds.includes(c.id) && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label className="mb-2 block">Strategy</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {STRATEGIES.map(s => (
                    <button key={s.key} type="button" onClick={() => setStrategy(s.key)}
                      className={`text-left rounded-lg border p-3 transition-colors ${strategy === s.key ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                      <div className="flex items-center justify-between"><span className="font-medium text-sm">{s.label}</span>{strategy === s.key && <Check className="h-4 w-4 text-primary" />}</div>
                      <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="w-40"><Label>Version</Label><Input value={version} onChange={e => setVersion(e.target.value)} /></div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold">Review & deploy</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><div className="text-xs text-muted-foreground">API</div><div className="font-medium">{api?.name}</div></div>
                <div><div className="text-xs text-muted-foreground">Version</div><div className="font-medium">{version}</div></div>
                <div><div className="text-xs text-muted-foreground">Targets</div><div className="font-medium">{allClusters ? `All clusters (${clusterList.length})` : `${clusterIds.length} selected`}</div></div>
                <div><div className="text-xs text-muted-foreground">Strategy</div><div className="font-medium">{STRATEGIES.find(s => s.key === strategy)?.label}</div></div>
              </div>
              {api && !api.graviteeApiId && <p className="text-xs text-amber-600">This API isn't on the gateway yet — deploying will publish it (creating a default plan) first.</p>}
              <Separator />
              <Button disabled={deploy.isPending} onClick={submit}>
                {deploy.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}Deploy
              </Button>
            </>
          )}

          <Separator />
          <div className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {step < 2 && <Button disabled={(step === 0 && !apiId) || (step === 1 && !step2Valid)} onClick={() => setStep(s => s + 1)}>Next<ArrowRight className="h-4 w-4 ml-1" /></Button>}
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4 space-y-2 text-sm">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Summary</span>
          <div className="flex justify-between"><span className="text-muted-foreground">API</span><span className="font-medium">{api?.name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span className="font-medium">{version || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Targets</span><span className="font-medium">{allClusters ? "All" : clusterIds.length || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Strategy</span><Badge variant="outline" className="text-[10px]">{strategy}</Badge></div>
        </CardContent></Card>
      </div>
    </div>
  );
}
