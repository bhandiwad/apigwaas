import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTenantContext } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check, Copy, Loader2, Rocket, FileJson, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type PlanKey = "keyless" | "apikey" | "jwt" | "oauth2";
const PLANS: { key: PlanKey; label: string; desc: string; enabled: boolean; note?: string }[] = [
  { key: "keyless", label: "Keyless", desc: "Open access, no credentials. For public or internal APIs.", enabled: true },
  { key: "apikey", label: "API Key", desc: "Consumers subscribe and call with an API key header.", enabled: true },
  { key: "jwt", label: "JWT", desc: "Validate a JWT issued by your identity provider.", enabled: false, note: "Requires an Identity Provider" },
  { key: "oauth2", label: "OAuth2", desc: "Token introspection via your OAuth2 server.", enabled: false, note: "Requires an Identity Provider" },
];

function slugPath(name: string): string {
  const s = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s ? `/${s}/v1` : "";
}

const STEPS = ["Basics", "Backend & plan", "Review"];

export default function ApiCreateWizard() {
  const [, navigate] = useLocation();
  const { workspaceId: ctxWorkspaceId, effectiveTenantId, workspaces } = useTenantContext();
  const { data: status } = trpc.gateway.connectionStatus.useQuery();
  const isLive = (status as any)?.mode === "live";
  const GATEWAY_BASE = ((status as any)?.gatewayBaseUrl || "http://localhost:8082").replace(/\/$/, "");

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    contextPath: "",
    contextPathTouched: false,
    version: "1.0.0",
    protocol: "rest" as "rest" | "graphql" | "grpc" | "websocket" | "kafka" | "mqtt",
    workspaceId: ctxWorkspaceId ? String(ctxWorkspaceId) : "",
    description: "",
    backendUrl: "",
    plan: "apikey" as PlanKey,
    rateLimit: 100,
    rateLimitPeriod: "minute" as "second" | "minute" | "hour" | "day",
    quotaLimit: 10000,
    quotaPeriod: "month" as "day" | "week" | "month",
    autoApprove: true,
  });
  const [showLimits, setShowLimits] = useState(false);
  const [prefillOpen, setPrefillOpen] = useState(false);
  const [prefillText, setPrefillText] = useState("");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }));

  // Default workspace once context loads.
  useEffect(() => {
    if (!form.workspaceId && workspaces.length > 0) set("workspaceId", String(workspaces[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  // Auto-slug the context path from the name until the user edits it.
  useEffect(() => {
    if (!form.contextPathTouched) set("contextPath", slugPath(form.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.name]);

  // Debounced context-path availability check.
  const [debouncedPath, setDebouncedPath] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedPath(form.contextPath), 350);
    return () => clearTimeout(t);
  }, [form.contextPath]);
  const pathCheck = trpc.api.checkContextPath.useQuery(
    { contextPath: debouncedPath, tenantId: effectiveTenantId },
    { enabled: debouncedPath.length > 1 },
  );

  const createApi = trpc.api.create.useMutation();
  const createPlan = trpc.plan.create.useMutation();
  const deployApi = trpc.gateway.deploy.useMutation();
  const [submitting, setSubmitting] = useState<null | "draft" | "deploy">(null);

  const gatewayUrl = form.contextPath ? `${GATEWAY_BASE}${form.contextPath.replace(/\/$/, "")}` : `${GATEWAY_BASE}/…`;
  const curl = useMemo(() => {
    if (form.plan === "apikey") return `curl -H "X-Gravitee-Api-Key: <your-key>" \\\n  ${gatewayUrl}/`;
    return `curl ${gatewayUrl}/`;
  }, [form.plan, gatewayUrl]);
  const configPreview = useMemo(() => JSON.stringify({
    name: form.name || undefined,
    version: form.version,
    protocol: form.protocol,
    contextPath: form.contextPath || undefined,
    backendUrl: form.backendUrl || undefined,
    plan: { type: form.plan, rateLimit: `${form.rateLimit}/${form.rateLimitPeriod}`, quota: `${form.quotaLimit}/${form.quotaPeriod}`, autoApprove: form.autoApprove },
  }, null, 2), [form]);

  const backendRequired = ["rest", "graphql", "grpc"].includes(form.protocol);
  const pathAvailable = pathCheck.data?.available ?? null;
  const step1Valid = form.name.trim() && form.contextPath.length > 1 && form.workspaceId && pathAvailable !== false;
  const step2Valid = !backendRequired || form.backendUrl.trim();

  function prefillFromSpec() {
    try {
      const spec = JSON.parse(prefillText);
      const info = spec.info || {};
      setForm(f => ({
        ...f,
        name: info.title || f.name,
        version: info.version || f.version,
        description: info.description || f.description,
        backendUrl: spec.servers?.[0]?.url || f.backendUrl,
        contextPathTouched: true,
        contextPath: spec.servers?.[0]?.url ? new URL(spec.servers[0].url, "http://x").pathname : f.contextPath,
      }));
      setPrefillOpen(false);
      toast.success("Prefilled from spec");
    } catch {
      toast.error("Invalid JSON. For a full import use APIs → Import OpenAPI.");
    }
  }

  async function submit(mode: "draft" | "deploy") {
    setSubmitting(mode);
    try {
      const created = await createApi.mutateAsync({
        workspaceId: Number(form.workspaceId),
        name: form.name.trim(),
        version: form.version,
        protocol: form.protocol,
        backendUrl: form.backendUrl.trim() || undefined,
        contextPath: form.contextPath || undefined,
        description: form.description || undefined,
      });
      const apiId = created.id!;
      // An API-key plan is created up front; keyless plans are created by the
      // gateway on deploy, so we skip plan.create for them.
      if (form.plan === "apikey") {
        await createPlan.mutateAsync({
          apiId, name: "Default", rateLimit: form.rateLimit, rateLimitPeriod: form.rateLimitPeriod,
          quotaLimit: form.quotaLimit, quotaPeriod: form.quotaPeriod, autoApprove: form.autoApprove,
        });
      }
      if (mode === "deploy") {
        await deployApi.mutateAsync({ apiId, clusterIds: "all", version: form.version, strategy: "rolling" });
      }
      toast.success(mode === "deploy" ? "API created and deployed" : "Draft API created");
      navigate(`/apis/${apiId}?created=1`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/apis")}><ArrowLeft className="h-4 w-4 mr-1" />APIs</Button>
        <h1 className="text-2xl font-bold tracking-tight">New API</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">{i < step ? <Check className="h-3 w-3" /> : i + 1}</span>
              {label}
            </div>
            {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* ─── Steps ─── */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            {step === 0 && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Basics</h2>
                  <Button variant="outline" size="sm" onClick={() => setPrefillOpen(o => !o)}><FileJson className="h-4 w-4 mr-1" />Prefill from OpenAPI</Button>
                </div>
                {prefillOpen && (
                  <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
                    <Textarea rows={5} value={prefillText} onChange={e => setPrefillText(e.target.value)} placeholder="Paste an OpenAPI 3.x JSON spec to prefill these fields…" className="font-mono text-xs" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">For a full native import (routes + flows), use APIs → Import OpenAPI.</span>
                      <Button size="sm" disabled={!prefillText.trim()} onClick={prefillFromSpec}>Prefill</Button>
                    </div>
                  </div>
                )}
                <div><Label>Name *</Label><Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Payments API" autoFocus /></div>
                <div>
                  <Label>Context path *</Label>
                  <Input value={form.contextPath} onChange={e => { set("contextPath", e.target.value); set("contextPathTouched", true); }} placeholder="/payments/v1" className="font-mono" />
                  <div className="h-4 mt-1 text-xs">
                    {debouncedPath.length > 1 && pathCheck.isFetching && <span className="text-muted-foreground">Checking…</span>}
                    {pathAvailable === true && <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Available</span>}
                    {pathAvailable === false && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{pathCheck.data?.conflictName ? `Already used by "${pathCheck.data.conflictName}"` : "Not a valid path"}</span>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Version</Label><Input value={form.version} onChange={e => set("version", e.target.value)} /></div>
                  <div><Label>Protocol</Label>
                    <Select value={form.protocol} onValueChange={v => set("protocol", v as typeof form.protocol)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["rest", "graphql", "grpc", "websocket", "kafka", "mqtt"].map(p => <SelectItem key={p} value={p}>{p.toUpperCase()}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Workspace</Label>
                  <Select value={form.workspaceId} onValueChange={v => set("workspaceId", v)}>
                    <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent>{workspaces.map(w => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="What this API does" /></div>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="font-semibold">Backend & plan</h2>
                <div><Label>Backend URL {backendRequired && "*"}</Label><Input value={form.backendUrl} onChange={e => set("backendUrl", e.target.value)} placeholder="https://api.internal.svc/v1" className="font-mono" /></div>
                <div>
                  <Label className="mb-2 block">Access plan</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {PLANS.map(p => {
                      const selected = form.plan === p.key;
                      const card = (
                        <button key={p.key} type="button" disabled={!p.enabled} onClick={() => p.enabled && set("plan", p.key)}
                          className={`text-left rounded-lg border p-3 transition-colors w-full ${selected ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:bg-muted/40"} ${!p.enabled ? "opacity-50 cursor-not-allowed" : ""}`}>
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{p.label}</span>
                            {selected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
                          {p.note && <p className="text-[11px] text-amber-600 mt-1">{p.note}</p>}
                        </button>
                      );
                      return p.note ? (
                        <Tooltip key={p.key}><TooltipTrigger asChild><div>{card}</div></TooltipTrigger><TooltipContent>{p.note}</TooltipContent></Tooltip>
                      ) : card;
                    })}
                  </div>
                </div>
                <div>
                  <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setShowLimits(s => !s)}>
                    {showLimits ? "▾" : "▸"} Limits (rate limit & quota)
                  </button>
                  {showLimits && (
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div><Label>Rate limit</Label><Input type="number" value={form.rateLimit} onChange={e => set("rateLimit", Number(e.target.value))} /></div>
                      <div><Label>Per</Label>
                        <Select value={form.rateLimitPeriod} onValueChange={v => set("rateLimitPeriod", v as typeof form.rateLimitPeriod)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["second", "minute", "hour", "day"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Quota</Label><Input type="number" value={form.quotaLimit} onChange={e => set("quotaLimit", Number(e.target.value))} /></div>
                      <div><Label>Per</Label>
                        <Select value={form.quotaPeriod} onValueChange={v => set("quotaPeriod", v as typeof form.quotaPeriod)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{["day", "week", "month"].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div><p className="text-sm font-medium">Auto-approve subscriptions</p><p className="text-xs text-muted-foreground">New subscriptions get a key immediately.</p></div>
                  <Switch checked={form.autoApprove} onCheckedChange={v => set("autoApprove", v)} />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="font-semibold">Review & create</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[["Name", form.name], ["Context path", form.contextPath], ["Version", form.version], ["Protocol", form.protocol.toUpperCase()],
                    ["Workspace", workspaces.find(w => String(w.id) === form.workspaceId)?.name ?? "—"], ["Backend", form.backendUrl || "—"],
                    ["Plan", PLANS.find(p => p.key === form.plan)?.label ?? ""], ["Limits", `${form.rateLimit}/${form.rateLimitPeriod} · ${form.quotaLimit}/${form.quotaPeriod}`]].map(([k, v]) => (
                    <div key={k}><div className="text-xs text-muted-foreground">{k}</div><div className="font-medium break-all">{v}</div></div>
                  ))}
                </div>
                <Separator />
                <div className="flex flex-wrap gap-3">
                  <Button variant="outline" disabled={!!submitting} onClick={() => submit("draft")}>
                    {submitting === "draft" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}Create draft
                  </Button>
                  {isLive ? (
                    <Button disabled={!!submitting} onClick={() => submit("deploy")}>
                      {submitting === "deploy" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}Create & deploy
                    </Button>
                  ) : (
                    <Tooltip><TooltipTrigger asChild><span><Button disabled>Create & deploy</Button></span></TooltipTrigger><TooltipContent>Connect Gravitee to deploy to the gateway</TooltipContent></Tooltip>
                  )}
                </div>
              </>
            )}

            {/* Footer nav */}
            <Separator />
            <div className="flex justify-between">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
              {step < 2 && (
                <Button disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)} onClick={() => setStep(s => s + 1)}>
                  Next<ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Right rail ─── */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Gateway URL</span>
                <Badge variant="outline" className="text-[10px]">{isLive ? "live" : "local"}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono break-all flex-1">{gatewayUrl}</code>
                <Copy className="h-3.5 w-3.5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(gatewayUrl); toast.success("Copied"); }} />
              </div>
              <Separator />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Try it</span>
              <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap">{curl}</pre>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 space-y-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">As config</span>
              <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto">{configPreview}</pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
