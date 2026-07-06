import { useEffect, useMemo, useState } from "react";
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
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const GATEWAY_FALLBACK = "http://localhost:8082";
const STEPS = ["API & plan", "Consumer app", "Subscribe"];

export default function SubscribeWizard() {
  const [, navigate] = useLocation();
  const searchStr = useSearch();
  const qs = searchStr ? new URLSearchParams(searchStr) : null;
  const qsApiId = qs ? Number(qs.get("apiId")) || 0 : 0;
  const qsAppId = qs ? qs.get("appId") || "" : "";
  const { effectiveTenantId, workspaceId, workspaces } = useTenantContext();

  const { data: status } = trpc.gateway.connectionStatus.useQuery();
  const gatewayBase = ((status as any)?.gatewayBaseUrl || GATEWAY_FALLBACK).replace(/\/$/, "");
  const { data: apis } = trpc.api.list.useQuery({ tenantId: effectiveTenantId });
  const apiList = (apis ?? []) as any[];
  const { data: appsResult } = trpc.consumerApp.list.useQuery({ tenantId: effectiveTenantId });
  const appList = ((appsResult as any)?.data ?? (Array.isArray(appsResult) ? appsResult : [])) as any[];

  const [step, setStep] = useState(0);
  const [apiId, setApiId] = useState<number>(qsApiId);
  const [planId, setPlanId] = useState<number>(0);
  const [appMode, setAppMode] = useState<"existing" | "new">("existing");
  const [appId, setAppId] = useState<string>(qsAppId);
  const [newApp, setNewApp] = useState({ name: "", description: "" });
  const [result, setResult] = useState<null | { status: string; apiKey: string | null }>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: plans } = trpc.plan.list.useQuery({ apiId }, { enabled: apiId > 0 });
  const planList = (plans ?? []) as any[];
  const api = apiList.find(a => a.id === apiId);
  const plan = planList.find(p => p.id === planId);

  useEffect(() => { if (appMode === "existing" && !appId && appList.length > 0) setAppId(String(appList[0].id)); }, [appList, appMode, appId]);

  const createApp = trpc.consumerApp.create.useMutation();
  const subscribe = trpc.subscription.create.useMutation();

  const gatewayUrl = api?.contextPath ? `${gatewayBase}${String(api.contextPath).replace(/\/$/, "")}` : `${gatewayBase}/…`;
  const curl = useMemo(() => {
    const key = result?.apiKey || "<your-key>";
    return `curl -H "X-Gravitee-Api-Key: ${key}" \\\n  ${gatewayUrl}/`;
  }, [result?.apiKey, gatewayUrl]);

  const step1Valid = apiId > 0 && planId > 0;
  const step2Valid = appMode === "existing" ? !!appId : !!newApp.name.trim();

  async function submit() {
    setSubmitting(true);
    try {
      let consumerAppId: number;
      if (appMode === "new") {
        const wsId = workspaceId ?? workspaces[0]?.id;
        if (!wsId) { toast.error("Create a workspace first"); setSubmitting(false); return; }
        const created = await createApp.mutateAsync({ workspaceId: wsId, name: newApp.name.trim(), description: newApp.description || undefined });
        consumerAppId = created.id!;
      } else {
        consumerAppId = Number(appId);
      }
      const sub = await subscribe.mutateAsync({ consumerAppId, planId, apiId });
      setResult({ status: (sub as any).status, apiKey: (sub as any).apiKey ?? null });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Success screen ───
  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
          <div>
            <h1 className="text-xl font-bold">{result.status === "approved" ? "Subscribed" : "Subscription submitted"}</h1>
            <p className="text-sm text-muted-foreground">{result.status === "approved" ? `${appMode === "new" ? newApp.name : appList.find(a => String(a.id) === appId)?.name} → ${api?.name} · ${plan?.name}` : "Waiting for approval from the API owner."}</p>
          </div>
        </div>
        {result.apiKey ? (
          <Card><CardContent className="pt-4 space-y-3">
            <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Your API key</span></div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted/50 rounded p-2 flex-1 break-all">{result.apiKey}</code>
              <Copy className="h-4 w-4 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(result.apiKey!); toast.success("Copied"); }} />
            </div>
            <p className="text-xs text-muted-foreground">Store it now — call the API by sending it as the <code>X-Gravitee-Api-Key</code> header.</p>
            <Separator />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try it</span>
            <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{curl}</pre>
          </CardContent></Card>
        ) : (
          <Card><CardContent className="pt-4 text-sm text-muted-foreground">The API owner will review this subscription. You'll get an API key once it's approved.</CardContent></Card>
        )}
        <div className="flex gap-2">
          <Button onClick={() => navigate("/subscriptions")}>Done</Button>
          <Button variant="outline" onClick={() => { setResult(null); setStep(0); setPlanId(0); }}>Subscribe another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/subscriptions")}><ArrowLeft className="h-4 w-4 mr-1" />Subscriptions</Button>
        <h1 className="text-2xl font-bold tracking-tight">New subscription</h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card><CardContent className="pt-6 space-y-5">
          {step === 0 && (
            <>
              <h2 className="font-semibold">Choose an API & plan</h2>
              <div><Label>API</Label>
                <Select value={apiId ? String(apiId) : ""} onValueChange={v => { setApiId(Number(v)); setPlanId(0); }}>
                  <SelectTrigger><SelectValue placeholder="Select an API" /></SelectTrigger>
                  <SelectContent>{apiList.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name} <span className="text-muted-foreground">v{a.version}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-2 block">Plan</Label>
                {apiId === 0 ? <p className="text-sm text-muted-foreground">Select an API first.</p>
                  : planList.length === 0 ? <p className="text-sm text-muted-foreground">This API has no plans yet. Add one on the API's Plans tab.</p>
                  : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {planList.map(p => {
                        const sel = planId === p.id;
                        return (
                          <button key={p.id} type="button" onClick={() => setPlanId(p.id)}
                            className={`text-left rounded-lg border p-3 transition-colors ${sel ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{p.name}</span>
                              {sel && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{p.rateLimit}/{p.rateLimitPeriod ?? "min"} · {p.quotaLimit}/{p.quotaPeriod ?? "month"}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">{p.autoApprove ? "Auto-approve" : "Manual approval"}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-semibold">Consumer app</h2>
              <div className="flex gap-2">
                <Button size="sm" variant={appMode === "existing" ? "default" : "outline"} onClick={() => setAppMode("existing")}>Existing app</Button>
                <Button size="sm" variant={appMode === "new" ? "default" : "outline"} onClick={() => setAppMode("new")}>New app</Button>
              </div>
              {appMode === "existing" ? (
                appList.length === 0 ? <p className="text-sm text-muted-foreground">No consumer apps yet — create one.</p> : (
                  <div><Label>App</Label>
                    <Select value={appId} onValueChange={setAppId}>
                      <SelectTrigger><SelectValue placeholder="Select an app" /></SelectTrigger>
                      <SelectContent>{appList.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div><Label>App name *</Label><Input value={newApp.name} onChange={e => setNewApp({ ...newApp, name: e.target.value })} placeholder="Acme Mobile" /></div>
                  <div><Label>Description</Label><Input value={newApp.description} onChange={e => setNewApp({ ...newApp, description: e.target.value })} placeholder="What this app is" /></div>
                  <p className="text-xs text-muted-foreground">A client ID & secret are generated when the app is created.</p>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold">Review & subscribe</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><div className="text-xs text-muted-foreground">API</div><div className="font-medium">{api?.name}</div></div>
                <div><div className="text-xs text-muted-foreground">Plan</div><div className="font-medium">{plan?.name}</div></div>
                <div><div className="text-xs text-muted-foreground">Consumer app</div><div className="font-medium">{appMode === "new" ? newApp.name : appList.find(a => String(a.id) === appId)?.name}</div></div>
                <div><div className="text-xs text-muted-foreground">Approval</div><div className="font-medium">{plan?.autoApprove ? "Auto — key issued now" : "Manual — pending review"}</div></div>
              </div>
              <Separator />
              <Button disabled={submitting} onClick={submit}>
                {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}Subscribe
              </Button>
            </>
          )}

          <Separator />
          <div className="flex justify-between">
            <Button variant="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
            {step < 2 && <Button disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)} onClick={() => setStep(s => s + 1)}>Next<ArrowRight className="h-4 w-4 ml-1" /></Button>}
          </div>
        </CardContent></Card>

        <Card><CardContent className="pt-4 space-y-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gateway URL</span>
          <code className="text-xs font-mono break-all block">{gatewayUrl}</code>
          <Separator />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Call it (once subscribed)</span>
          <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{curl}</pre>
        </CardContent></Card>
      </div>
    </div>
  );
}
