import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useTenantContext } from "@/contexts/TenantContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  FileEdit, Rocket, AlertTriangle, Archive, Check, X, Copy,
  Settings2, TestTube2, Shield, BarChart3, ArrowRight, RotateCcw, Loader2,
} from "lucide-react";

type StageKey = "draft" | "published" | "deprecated" | "retired";
const STAGES: { key: StageKey; label: string; icon: any; blurb: string }[] = [
  { key: "draft", label: "Draft", icon: FileEdit, blurb: "Being designed and configured." },
  { key: "published", label: "Published", icon: Rocket, blurb: "Live on the gateway and accepting traffic." },
  { key: "deprecated", label: "Deprecated", icon: AlertTriangle, blurb: "Marked for sunset — consumers should migrate. Still callable." },
  { key: "retired", label: "Retired", icon: Archive, blurb: "Taken out of active use." },
];
const STAGE_INDEX: Record<StageKey, number> = { draft: 0, published: 1, deprecated: 2, retired: 3 };

export default function ApiLifecycle() {
  const [, navigate] = useLocation();
  const { workspaceId, effectiveTenantId } = useTenantContext();
  const utils = trpc.useUtils();
  const { data: apis } = trpc.api.list.useQuery({ workspaceId: workspaceId ?? undefined, tenantId: effectiveTenantId });
  const { data: status } = trpc.gateway.connectionStatus.useQuery();
  const gatewayBase = ((status as any)?.gatewayBaseUrl || "http://localhost:8082").replace(/\/$/, "");

  const apiList = (apis ?? []) as any[];
  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (!selectedId && apiList.length > 0) setSelectedId(String(apiList[0].id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiList.length]);
  const api = apiList.find(a => String(a.id) === selectedId);
  const apiId = api?.id as number | undefined;

  const { data: plans } = trpc.plan.list.useQuery({ apiId: apiId! }, { enabled: !!apiId });
  const planList = (plans ?? []) as any[];

  const [confirm, setConfirm] = useState<StageKey | null>(null);
  const [retireText, setRetireText] = useState("");
  const update = trpc.api.update.useMutation({
    onSuccess: (_, vars) => {
      utils.api.list.invalidate();
      const msg: Record<string, string> = { published: "API published", deprecated: "API deprecated", retired: "API retired", draft: "API reactivated as draft" };
      toast.success(msg[String(vars.status)] ?? "Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const stage = (api?.status ?? "draft") as StageKey;
  const currentIdx = STAGE_INDEX[stage];

  // Draft → publish readiness.
  const checklist = useMemo(() => [
    { ok: !!api?.backendUrl, label: "Backend URL configured", hint: "Required so the gateway knows where to route." },
    { ok: !!api?.contextPath, label: "Context path set", hint: "The gateway route, e.g. /payments/v1." },
    { ok: planList.length > 0, label: `${planList.length || "No"} plan${planList.length === 1 ? "" : "s"}`, hint: "Optional — a keyless plan is created on publish if none exist.", optional: true },
  ], [api?.backendUrl, api?.contextPath, planList.length]);
  const canPublish = !!api?.backendUrl && !!api?.contextPath;

  const gatewayUrl = api?.contextPath ? `${gatewayBase}${String(api.contextPath).replace(/\/$/, "")}` : null;

  function doTransition(target: StageKey) {
    if (!apiId) return;
    update.mutate({ id: apiId, status: target });
    setConfirm(null);
  }

  const secondary = [
    { icon: Settings2, label: "Configure", to: `/apis/${apiId}` },
    { icon: TestTube2, label: "Test", to: `/apis/${apiId}?tab=test` },
    { icon: Shield, label: "Policies", to: `/apis/${apiId}?tab=design` },
    { icon: BarChart3, label: "Analytics", to: `/analytics?apiId=${apiId}` },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">API Lifecycle</h1>
        <p className="text-muted-foreground text-sm mt-1">Walk an API from draft to retirement, one guided step at a time.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <Select value={selectedId} onValueChange={v => { setSelectedId(v); setConfirm(null); }}>
            <SelectTrigger className="w-full sm:w-96"><SelectValue placeholder="Select an API…" /></SelectTrigger>
            <SelectContent>
              {apiList.map(a => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name} <span className="text-muted-foreground">v{a.version} · {a.status}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!api ? (
        <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground text-sm">
          {apiList.length === 0 ? "No APIs yet. Create one to manage its lifecycle." : "Select an API above."}
        </CardContent></Card>
      ) : (
        <>
          {/* Stepper */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                {STAGES.map((s, i) => {
                  const done = i < currentIdx;
                  const active = i === currentIdx;
                  const Icon = s.icon;
                  return (
                    <div key={s.key} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-2 shrink-0">
                        <div className={`h-11 w-11 rounded-full flex items-center justify-center border-2 transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : done ? "border-primary/40 bg-primary/10 text-primary" : "border-muted bg-muted/40 text-muted-foreground"}`}>
                          {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                        </div>
                        <span className={`text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                      </div>
                      {i < STAGES.length - 1 && <div className={`h-0.5 flex-1 mx-2 -mt-6 ${i < currentIdx ? "bg-primary/40" : "bg-muted"}`} />}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Current stage + next action */}
          <Card>
            <CardContent className="pt-5 space-y-5">
              <div className="flex items-center gap-2">
                <Badge className="capitalize">{stage}</Badge>
                <span className="text-sm text-muted-foreground">{STAGES[currentIdx].blurb}</span>
              </div>

              {stage === "draft" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Ready to publish?</p>
                  {checklist.map(c => (
                    <div key={c.label} className="flex items-start gap-2 text-sm">
                      {c.ok ? <Check className="h-4 w-4 text-emerald-600 mt-0.5" /> : <X className={`h-4 w-4 mt-0.5 ${c.optional ? "text-muted-foreground" : "text-red-500"}`} />}
                      <div>
                        <span className={c.ok ? "" : c.optional ? "text-muted-foreground" : "text-foreground"}>{c.label}</span>
                        <span className="text-xs text-muted-foreground block">{c.hint}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {gatewayUrl && (stage === "published" || stage === "deprecated") && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Gateway URL</span>
                    <Copy className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => { navigator.clipboard.writeText(gatewayUrl); toast.success("Copied"); }} />
                  </div>
                  <code className="text-xs font-mono break-all">{gatewayUrl}</code>
                </div>
              )}

              {/* Primary action(s) */}
              <div className="flex flex-wrap gap-2">
                {stage === "draft" && (
                  <Button disabled={!canPublish || update.isPending} onClick={() => setConfirm("published")}>
                    {update.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}Publish to gateway<ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
                {stage === "published" && (
                  <Button variant="outline" disabled={update.isPending} onClick={() => setConfirm("deprecated")}>
                    <AlertTriangle className="h-4 w-4 mr-1" />Deprecate
                  </Button>
                )}
                {stage === "deprecated" && (
                  <>
                    <Button disabled={update.isPending} onClick={() => setConfirm("published")}><Rocket className="h-4 w-4 mr-1" />Re-publish</Button>
                    <Button variant="outline" className="text-destructive hover:text-destructive" disabled={update.isPending} onClick={() => { setRetireText(""); setConfirm("retired"); }}><Archive className="h-4 w-4 mr-1" />Retire</Button>
                  </>
                )}
                {stage === "retired" && (
                  <Button variant="outline" disabled={update.isPending} onClick={() => setConfirm("draft")}><RotateCcw className="h-4 w-4 mr-1" />Reactivate as draft</Button>
                )}
              </div>

              {!canPublish && stage === "draft" && (
                <p className="text-xs text-amber-600">Set a backend URL and context path (Configure) before publishing.</p>
              )}

              {/* Secondary actions */}
              <div className="flex flex-wrap gap-2 pt-1 border-t">
                {secondary.map(s => (
                  <Button key={s.label} size="sm" variant="ghost" className="text-muted-foreground" onClick={() => navigate(s.to)}>
                    <s.icon className="h-3.5 w-3.5 mr-1" />{s.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "published" ? "Publish API" : confirm === "deprecated" ? "Deprecate API" : confirm === "retired" ? "Retire API" : "Reactivate API"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "published" && "This deploys the API to the gateway and makes it callable."}
              {confirm === "deprecated" && "Consumers will be warned. The API stays callable until retired."}
              {confirm === "retired" && <>This takes <span className="font-medium">{api?.name}</span> out of active use. Type its name to confirm.</>}
              {confirm === "draft" && "This moves the API back to draft so you can edit and re-publish it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === "retired" && (
            <Input value={retireText} onChange={e => setRetireText(e.target.value)} placeholder={api?.name} className="font-mono" autoFocus />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={update.isPending || (confirm === "retired" && retireText !== api?.name)} onClick={() => confirm && doTransition(confirm)}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
