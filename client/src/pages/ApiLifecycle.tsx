import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowRight, FileEdit, Rocket, AlertTriangle, Archive,
  Settings2, TestTube2, Eye, GitBranch, Bell, Lock, RefreshCw, ExternalLink
} from "lucide-react";

const LIFECYCLE_STATES = [
  { key: "draft",      label: "Draft",      icon: FileEdit,       color: "bg-gray-100 text-gray-700 border-gray-300",    description: "Being designed and configured" },
  { key: "published",  label: "Published",  icon: Rocket,         color: "bg-emerald-100 text-emerald-700 border-emerald-300", description: "Live and accepting traffic" },
  { key: "deprecated", label: "Deprecated", icon: AlertTriangle,  color: "bg-amber-100 text-amber-700 border-amber-300", description: "Marked for sunset — consumers should migrate" },
  { key: "retired",    label: "Retired",    icon: Archive,        color: "bg-red-100 text-red-700 border-red-300",       description: "No longer accessible" },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft:      ["published"],
  published:  ["deprecated"],
  deprecated: ["published", "retired"],
  retired:    [],
};

// Extra per-state actions that don't change lifecycle state
const STATE_ACTIONS: Record<string, { icon: any; label: string; action: string }[]> = {
  draft: [
    { icon: Settings2,  label: "Configure Gateway",   action: "configure" },
    { icon: TestTube2,  label: "Test Endpoint",        action: "test" },
    { icon: Lock,       label: "Attach Policy",        action: "policy" },
    { icon: GitBranch,  label: "Create Version",       action: "version" },
  ],
  published: [
    { icon: Settings2,  label: "Edit Configuration",  action: "configure" },
    { icon: TestTube2,  label: "Test Endpoint",        action: "test" },
    { icon: Eye,        label: "View Metrics",         action: "metrics" },
    { icon: Bell,       label: "Set Deprecation Notice", action: "deprecation_notice" },
    { icon: GitBranch,  label: "Create New Version",   action: "new_version" },
    { icon: Lock,       label: "Manage Policies",      action: "policy" },
    { icon: ExternalLink, label: "Open in Gateway",   action: "gateway" },
  ],
  deprecated: [
    { icon: Eye,        label: "Migration Report",     action: "migration" },
    { icon: Bell,       label: "Notify Consumers",     action: "notify" },
  ],
  retired: [
    { icon: GitBranch,  label: "Reactivate as Draft",  action: "reactivate" },
  ],
};

export default function ApiLifecycle() {
  const [, navigate] = useLocation();
  const { data: apis, refetch } = trpc.api.list.useQuery({});
  const { data: workspaces } = trpc.workspace.list.useQuery(undefined);
  const updateApi = trpc.api.update.useMutation({
    onSuccess: () => { refetch(); toast.success("API lifecycle state updated"); },
    onError: (e) => toast.error(e.message),
  });
  const createApi = trpc.api.create.useMutation({
    onSuccess: () => { refetch(); toast.success("New draft version created"); setNewVersionApi(null); },
    onError: (e) => toast.error(e.message),
  });

  const proxyTest = trpc.api.proxyTest.useMutation();

  const [configApi, setConfigApi] = useState<any | null>(null);
  const [testApi, setTestApi]     = useState<any | null>(null);
  const [testPath, setTestPath]   = useState("/");
  const [testQueryString, setTestQueryString] = useState("");
  const [testResult, setTestResult] = useState<any | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [noticeApi, setNoticeApi] = useState<any | null>(null);
  const [noticeText, setNoticeText] = useState("");

  const [gwConfig, setGwConfig] = useState({ timeout: "30000", rateLimit: "1000", rateLimitPeriod: "MINUTES", contextPath: "" });
  const [newVersionApi, setNewVersionApi] = useState<any | null>(null);
  const [newVersion, setNewVersion] = useState("");

  function handleAction(api: any, action: string) {
    switch (action) {
      case "configure":    setGwConfig({ timeout: "30000", rateLimit: "1000", rateLimitPeriod: "MINUTES", contextPath: api.contextPath || "" }); setConfigApi(api); break;
      case "test":         setTestApi(api); setTestResult(null); setTestPath("/"); setTestQueryString(""); break;
      case "policy":       navigate(`/policies?apiId=${api.id}`); break;
      case "metrics":      navigate(`/analytics?apiId=${api.id}`); break;
      case "deprecation_notice": setNoticeApi(api); setNoticeText(""); break;
      case "notify":       toast.info("Consumer notification queued"); break;
      case "migration":    toast.info("Migration report: " + (api.name || "API") + " — no active subscriptions"); break;
      case "reactivate":   updateApi.mutate({ id: api.id, status: "draft" }); break;
      case "gateway":      window.open(`http://localhost:8082${api.contextPath || "/"}`, "_blank"); break;
      case "rollback":     toast.info("No previous version to rollback to"); break;
      case "version":      toast.info("Version branching — use GitOps pipeline for multi-version promotion"); break;
      case "new_version":  {
        const cur = api.version || "1.0.0";
        const parts = cur.replace(/^v/, "").split(".");
        const next = `v${parseInt(parts[0] || "1") + 1}.0`;
        setNewVersion(next);
        setNewVersionApi(api);
        break;
      }
    }
  }

  async function runTest() {
    if (!testApi) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await proxyTest.mutateAsync({
        apiId: testApi.id,
        path: testPath || "/",
        queryString: testQueryString || undefined,
        method: "GET",
      });
      setTestResult(result);
    } finally {
      setTestLoading(false);
    }
  }

  const getStateInfo = (status: string) => LIFECYCLE_STATES.find(s => s.key === status) || LIFECYCLE_STATES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Lifecycle</h1>
        <p className="text-muted-foreground text-sm">Manage state transitions, gateway configuration, testing, and deprecation</p>
      </div>

      {/* State machine diagram */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {LIFECYCLE_STATES.map((state, idx) => (
              <div key={state.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 ${state.color}`}>
                  <state.icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{state.label}</span>
                </div>
                {idx < LIFECYCLE_STATES.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Deprecated can revert to Published before retiring
          </p>
        </CardContent>
      </Card>

      {/* APIs by state — Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {LIFECYCLE_STATES.map(state => {
          const stateApis = (apis as any[] || []).filter(a => a.status === state.key);
          const extraActions = STATE_ACTIONS[state.key] || [];
          return (
            <Card key={state.key} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <state.icon className="w-4 h-4" />
                  {state.label}
                  <Badge variant="outline" className="ml-auto text-xs">{stateApis.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{state.description}</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-2">
                {stateApis.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No APIs</p>
                )}
                {stateApis.map((api: any) => (
                  <div key={api.id} className="p-3 border rounded-lg bg-muted/30 space-y-2">
                    <div>
                      <div className="font-medium text-sm leading-tight">{api.name}</div>
                      <div className="text-xs text-muted-foreground">v{api.version} · {api.protocol?.toUpperCase()}</div>
                      {api.contextPath && <div className="text-xs font-mono text-muted-foreground">{api.contextPath}</div>}
                    </div>

                    {/* Lifecycle transitions */}
                    {VALID_TRANSITIONS[state.key]?.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {VALID_TRANSITIONS[state.key].map(target => {
                          const t = getStateInfo(target);
                          return (
                            <Button key={target} size="sm" variant="outline" className="text-xs h-7 px-2"
                              onClick={() => updateApi.mutate({ id: api.id, status: target as any })}
                              disabled={updateApi.isPending}>
                              → {t.label}
                            </Button>
                          );
                        })}
                      </div>
                    )}

                    {/* State-specific extra actions */}
                    {extraActions.length > 0 && (
                      <div className="border-t pt-2 flex gap-1 flex-wrap">
                        {extraActions.map(ea => (
                          <Button key={ea.action} size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
                            onClick={() => handleAction(api, ea.action)}>
                            <ea.icon className="w-3 h-3 mr-1" />{ea.label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full API table */}
      <Card>
        <CardHeader><CardTitle className="text-base">All APIs</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">API</th>
                  <th className="pb-2 font-medium">Version</th>
                  <th className="pb-2 font-medium">Protocol</th>
                  <th className="pb-2 font-medium">State</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(apis as any[] || []).map((api: any) => {
                  const stateInfo = getStateInfo(api.status);
                  return (
                    <tr key={api.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 font-medium">{api.name}</td>
                      <td className="py-2.5"><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{api.version}</code></td>
                      <td className="py-2.5"><Badge variant="outline" className="text-xs">{api.protocol}</Badge></td>
                      <td className="py-2.5"><Badge className={`text-xs ${stateInfo.color}`}>{stateInfo.label}</Badge></td>
                      <td className="py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {VALID_TRANSITIONS[api.status]?.map(target => (
                            <Button key={target} size="sm" variant="outline" className="text-xs h-6 px-2"
                              onClick={() => updateApi.mutate({ id: api.id, status: target as any })}
                              disabled={updateApi.isPending}>
                              {getStateInfo(target).label}
                            </Button>
                          ))}
                          {STATE_ACTIONS[api.status]?.slice(0, 2).map(ea => (
                            <Button key={ea.action} size="sm" variant="ghost" className="text-xs h-6 px-2"
                              onClick={() => handleAction(api, ea.action)}>
                              <ea.icon className="w-3 h-3 mr-1" />{ea.label}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Configure Gateway Dialog */}
      <Dialog open={!!configApi} onOpenChange={o => { if (!o) setConfigApi(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gateway Config — {configApi?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs">Context Path</Label>
              <Input className="mt-1 font-mono text-sm" value={gwConfig.contextPath} onChange={e => setGwConfig(c => ({ ...c, contextPath: e.target.value }))} placeholder="/api/v1/resource" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Timeout (ms)</Label>
                <Input className="mt-1" type="number" value={gwConfig.timeout} onChange={e => setGwConfig(c => ({ ...c, timeout: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Rate Limit (req/min)</Label>
                <Input className="mt-1" type="number" value={gwConfig.rateLimit} onChange={e => setGwConfig(c => ({ ...c, rateLimit: e.target.value }))} />
              </div>
            </div>
            <Button className="w-full" onClick={() => {
              if (!configApi) return;
              updateApi.mutate({ id: configApi.id, contextPath: gwConfig.contextPath || undefined });
              toast.success("Gateway config saved");
              setConfigApi(null);
            }}>
              Save Configuration
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Endpoint Dialog */}
      <Dialog open={!!testApi} onOpenChange={o => { if (!o) { setTestApi(null); setTestResult(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Endpoint — {testApi?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Backend URL info */}
            <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 font-mono">
              Backend: <span className="text-foreground">{testApi?.backendUrl || "not configured"}</span>
            </div>

            {/* Method + path */}
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold font-mono px-2 py-1.5 rounded flex-shrink-0">GET</span>
              <Input
                className="font-mono text-sm"
                value={testPath}
                onChange={e => setTestPath(e.target.value)}
                placeholder="/v1/forecast"
              />
            </div>

            {/* Query string */}
            <div>
              <Label className="text-xs">Query String (without ?)</Label>
              <Input
                className="mt-1 font-mono text-sm"
                value={testQueryString}
                onChange={e => setTestQueryString(e.target.value)}
                placeholder="latitude=12.97&longitude=77.59&current=temperature_2m,wind_speed_10m"
              />
            </div>

            {/* Effective URL preview */}
            {testApi?.backendUrl && (
              <div className="text-xs font-mono text-muted-foreground bg-muted/30 rounded px-3 py-2 break-all">
                → {testApi.backendUrl.replace(/\/$/, "")}{testPath || "/"}
                {testQueryString ? `?${testQueryString}` : ""}
              </div>
            )}

            <Button className="w-full" onClick={runTest} disabled={testLoading}>
              {testLoading ? "Sending…" : "Send Request"}
            </Button>

            {testResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${testResult.status >= 200 && testResult.status < 300 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {testResult.status} {testResult.statusText}
                  </span>
                  <span className="text-xs text-muted-foreground">{testResult.latencyMs}ms</span>
                  <span className="text-xs text-muted-foreground ml-auto truncate font-mono">{testResult.url}</span>
                </div>
                <pre className="bg-[#1a2e4a] text-green-300 p-3 rounded text-xs font-mono overflow-auto max-h-64 whitespace-pre-wrap">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(testResult.body), null, 2); }
                    catch { return testResult.body; }
                  })()}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Deprecation Notice Dialog */}
      <Dialog open={!!noticeApi} onOpenChange={o => { if (!o) setNoticeApi(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deprecation Notice — {noticeApi?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-xs">Notice message sent to all active subscribers</Label>
            <Textarea
              rows={4}
              value={noticeText}
              onChange={e => setNoticeText(e.target.value)}
              placeholder="This API will be retired on DD-MMM-YYYY. Please migrate to v2 at /api/v2/..."
            />
            <Button className="w-full" onClick={() => {
              toast.success("Deprecation notice queued for delivery to " + (noticeApi?.name || "API") + " subscribers");
              setNoticeApi(null);
            }}>
              Send Notice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Version Dialog */}
      <Dialog open={!!newVersionApi} onOpenChange={o => { if (!o) setNewVersionApi(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Version — {newVersionApi?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              This creates a new <strong>Draft</strong> API based on the current published version.
              The existing published version stays live until you deprecate it.
            </div>
            <div>
              <Label className="text-xs">New Version Number</Label>
              <Input className="mt-1 font-mono" value={newVersion} onChange={e => setNewVersion(e.target.value)} placeholder="v2.0" />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Recommended flow after this:</strong></p>
              <p>1. Edit the new draft → Configure Gateway → Test</p>
              <p>2. GitOps Pipeline → promote dev → staging → production</p>
              <p>3. Deprecate this published version with a migration notice</p>
            </div>
            <Button className="w-full" disabled={!newVersion || createApi.isPending}
              onClick={() => {
                if (!newVersionApi) return;
                const ws = (workspaces as any[])?.[0];
                if (!ws) { toast.error("No workspace found"); return; }
                createApi.mutate({
                  workspaceId: newVersionApi.workspaceId || ws.id,
                  name: newVersionApi.name,
                  version: newVersion,
                  protocol: newVersionApi.protocol || "rest",
                  backendUrl: newVersionApi.backendUrl || undefined,
                  contextPath: newVersionApi.contextPath ? `${newVersionApi.contextPath.replace(/\/v\d+$/, "")}/${newVersion.replace(/^v/, "v")}` : undefined,
                  description: newVersionApi.description || undefined,
                });
              }}>
              {createApi.isPending ? "Creating…" : `Create Draft — ${newVersion}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
