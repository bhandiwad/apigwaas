import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Download, Search, Shield, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight, Activity, Radio, Terminal, Filter, X,
} from "lucide-react";

// ─── Platform Events (Audit Trail) ──────────────────────────────────────────

const actionTypeColors: Record<string, string> = {
  create:  "bg-emerald-100 text-emerald-700",
  update:  "bg-blue-100 text-blue-700",
  delete:  "bg-red-100 text-red-700",
  deploy:  "bg-amber-100 text-amber-700",
  export:  "bg-gray-100 text-gray-700",
  login:   "bg-purple-100 text-purple-700",
  approve: "bg-teal-100 text-teal-700",
  reject:  "bg-orange-100 text-orange-700",
  revoke:  "bg-red-100 text-red-700",
};

function AuditEventDetail({ event, onClose }: { event: any; onClose: () => void }) {
  const rawFields: [string, any][] = [
    ["ID", event.id],
    ["Timestamp", event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"],
    ["Action", event.action],
    ["Action Type", event.actionType],
    ["Target Type", event.targetType],
    ["Target ID", event.targetId],
    ["Target Name", event.targetName],
    ["Actor", event.actorName || event.actorEmail || "—"],
    ["Actor ID", event.actorId],
    ["Source IP", event.sourceIp],
    ["User Agent", event.userAgent],
    ["Correlation ID", event.correlationId],
    ["Tenant ID", event.tenantId],
  ];
  const fields = rawFields.filter(([, v]) => v != null && v !== "—" && v !== "");

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Event Detail
            <code className="text-xs font-mono text-muted-foreground ml-1">#{event.id}</code>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {/* Core fields grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {fields.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="font-mono text-xs break-all mt-0.5">{String(value)}</div>
              </div>
            ))}
          </div>

          {/* Before / After state */}
          {(event.beforeState || event.afterState) && (
            <div className="grid grid-cols-2 gap-3">
              {event.beforeState && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Before</div>
                  <pre className="bg-gray-950 text-gray-200 text-xs rounded p-3 overflow-auto max-h-48 font-mono">
                    {JSON.stringify(event.beforeState, null, 2)}
                  </pre>
                </div>
              )}
              {event.afterState && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">After</div>
                  <pre className="bg-gray-950 text-gray-200 text-xs rounded p-3 overflow-auto max-h-48 font-mono">
                    {JSON.stringify(event.afterState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Metadata */}
          {event.metadata && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Metadata</div>
              <pre className="bg-gray-950 text-gray-200 text-xs rounded p-3 overflow-auto max-h-32 font-mono">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlatformEvents() {
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const { data: logs, isLoading, refetch } = trpc.audit.list.useQuery({ limit: 200 });
  const exportMutation = trpc.audit.export.useMutation();

  const events: any[] = (logs as any)?.events || [];
  const uniqueTypes = Array.from(new Set(events.map((e: any) => e.actionType).filter(Boolean))) as string[];

  const filtered = events.filter((e: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.action?.toLowerCase().includes(q) || e.actorName?.toLowerCase().includes(q) || e.targetType?.toLowerCase().includes(q) || e.targetName?.toLowerCase().includes(q);
    const matchType = actionType === "all" || e.actionType === actionType;
    return matchSearch && matchType;
  });

  async function handleExport(format: "csv" | "jsonl") {
    try {
      const result = await exportMutation.mutateAsync({ format });
      const blob = new Blob([result.content], { type: format === "csv" ? "text/csv" : "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.recordCount} records exported — SHA-256: ${result.signature.slice(0, 16)}…`);
    } catch {
      toast.error("Export failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search action, actor, resource…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={actionType} onValueChange={setActionType}>
          <SelectTrigger className="w-36"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {uniqueTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={exportMutation.isPending}><Download className="h-3.5 w-3.5 mr-1.5" />CSV</Button>
        <Button variant="outline" size="sm" onClick={() => handleExport("jsonl")} disabled={exportMutation.isPending}><Download className="h-3.5 w-3.5 mr-1.5" />JSONL</Button>
      </div>
      <div className="text-xs text-muted-foreground">{filtered.length} events</div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" />Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Shield className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>No events found</p></div>
          ) : (
            <div className="divide-y">
              {filtered.map((e: any) => (
                <button
                  key={e.id}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/20 text-sm text-left cursor-pointer"
                  onClick={() => setSelectedEvent(e)}
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="text-muted-foreground font-mono text-xs w-36 shrink-0">
                    {e.createdAt ? new Date(e.createdAt).toLocaleString() : "—"}
                  </span>
                  <Badge className={`text-xs shrink-0 ${actionTypeColors[e.actionType] || "bg-gray-100 text-gray-600"}`}>{e.actionType || "—"}</Badge>
                  <span className="font-medium text-foreground min-w-0 break-words flex-1">{e.action}</span>
                  {e.targetName && <span className="text-muted-foreground truncate">{e.targetName}</span>}
                  {e.actorName && <span className="text-xs text-muted-foreground shrink-0">by {e.actorName}</span>}
                  {(e.sourceIp || e.metadata || e.beforeState) && (
                    <span className="text-xs text-muted-foreground/50 shrink-0">+details</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedEvent && <AuditEventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}

// ─── Deployment Operation Logs ───────────────────────────────────────────────

type LogEntry = { ts: string; action: string; result: "ok" | "warn" | "error"; detail: string };

function opIcon(result: string) {
  if (result === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />;
  if (result === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
}

function DeploymentLogs() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: deployments, isLoading, refetch } = trpc.audit.deploymentLogs.useQuery({ limit: 100 });
  const { data: apis } = trpc.api.list.useQuery({});
  const { data: clusters } = trpc.gateway.clusters.useQuery();

  const apiList = (apis as any[]) || [];
  const clusterList = (clusters as any[]) || [];
  const allDeps = (deployments as any[]) || [];
  const filtered = statusFilter === "all" ? allDeps : allDeps.filter((d: any) => d.status === statusFilter);

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { deployed: "bg-green-100 text-green-700", deploying: "bg-blue-100 text-blue-700", failed: "bg-red-100 text-red-700", pending: "bg-yellow-100 text-yellow-700", undeployed: "bg-gray-100 text-gray-600" };
    return m[s] || "bg-gray-100 text-gray-600";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="deployed">Deployed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="deploying">Deploying</SelectItem>
            <SelectItem value="undeployed">Undeployed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} deployments</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" />Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">No deployment records</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => {
            const api = apiList.find((a: any) => a.id === d.apiId);
            const cluster = clusterList.find((c: any) => c.id === d.clusterId);
            const opLog: LogEntry[] = d.operationLog || [];
            const isExpanded = expandedId === d.id;
            const hasErrors = opLog.some(e => e.result === "error");

            return (
              <div key={d.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : d.id)}
                >
                  <span className="text-muted-foreground shrink-0">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{api?.name ?? `API #${d.apiId}`}</span>
                      <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{d.version}</code>
                      <Badge className={statusBadge(d.status)}>{d.status}</Badge>
                      {hasErrors && d.status !== "deployed" && <Badge className="bg-red-50 text-red-600 border border-red-200">has errors</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{cluster?.name ?? `Cluster #${d.clusterId}`} · env:{cluster?.graviteeEnvId ?? "—"}</span>
                      <span className="capitalize">{d.strategy}</span>
                      <span>{d.createdAt ? new Date(d.createdAt).toLocaleString() : "—"}</span>
                    </div>
                    {d.errorMessage && !isExpanded && (
                      <div className="mt-1 text-xs text-red-600 truncate">{d.errorMessage}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{opLog.length} steps</span>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    {/* Error message banner */}
                    {d.errorMessage && (
                      <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-sm text-red-700">
                        <span className="font-medium">Error: </span>{d.errorMessage}
                      </div>
                    )}
                    {/* Operation log — terminal style */}
                    <div className="bg-gray-950 font-mono text-xs px-4 py-3">
                      <div className="text-gray-500 mb-3 text-[10px] uppercase tracking-widest">
                        Operation Log · Deployment #{d.id} · {d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}
                      </div>
                      {opLog.length === 0 ? (
                        <div className="text-gray-500">No operation log recorded for this deployment.</div>
                      ) : opLog.map((entry, i) => (
                        <div key={i} className="flex gap-3 py-0.5 group">
                          <span className="text-gray-600 w-20 shrink-0 tabular-nums">
                            {new Date(entry.ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </span>
                          <span className={`w-14 shrink-0 font-bold ${entry.result === "ok" ? "text-green-400" : entry.result === "warn" ? "text-yellow-400" : "text-red-400"}`}>
                            {entry.result === "ok" ? "[ OK ] " : entry.result === "warn" ? "[WARN]" : "[FAIL]"}
                          </span>
                          <span className="text-cyan-400 w-40 shrink-0 truncate">{entry.action}</span>
                          <span className="text-gray-200 break-all">{entry.detail}</span>
                        </div>
                      ))}
                    </div>
                    {/* Metadata footer */}
                    <div className="px-4 py-2 bg-muted/30 border-t text-xs text-muted-foreground flex flex-wrap gap-4">
                      <span>Deployment ID: <code className="font-mono">#{d.id}</code></span>
                      <span>Strategy: <strong>{d.strategy}</strong></span>
                      <span>Sync: <strong>{d.syncStatus?.replace("_", " ")}</strong></span>
                      {d.deployedAt && <span>Deployed at: <strong>{new Date(d.deployedAt).toLocaleString()}</strong></span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Gateway Traffic Logs ────────────────────────────────────────────────────

function GatewayTrafficLogs() {
  const [selectedApiId, setSelectedApiId] = useState("");
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList = ((apis as any[]) || []).filter((a: any) => a.graviteeApiId);

  const selectedApi = apiList.find((a: any) => String(a.id) === selectedApiId);
  const { data: logsData, isLoading, refetch } = trpc.audit.gatewayLogs.useQuery(
    { graviteeApiId: selectedApi?.graviteeApiId ?? "" },
    { enabled: !!selectedApi?.graviteeApiId }
  );

  const logEntries: any[] = (logsData as any)?.data || [];

  const statusColor = (code: number) => {
    if (code < 300) return "text-green-600";
    if (code < 400) return "text-blue-600";
    if (code < 500) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-72">
          <Label className="text-xs text-muted-foreground mb-1 block">Select API to view gateway traffic</Label>
          <Select value={selectedApiId} onValueChange={setSelectedApiId}>
            <SelectTrigger><SelectValue placeholder="Select a published API…" /></SelectTrigger>
            <SelectContent>
              {apiList.map((a: any) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedApi && (
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-5"><RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh</Button>
        )}
      </div>

      {!selectedApi ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Radio className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Select an API to view its gateway traffic logs</p>
            <p className="text-xs mt-1">Only APIs synced to Gravitee appear here</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><RefreshCw className="h-5 w-5 animate-spin mr-2" />Fetching logs from Gravitee…</div>
      ) : !(logsData as any)?.connected ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-6 text-sm text-amber-800 text-center">
            Gravitee is not reachable — gateway traffic logs unavailable
          </CardContent>
        </Card>
      ) : logEntries.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No traffic logs for this API yet</p>
            <p className="text-xs mt-1">Logs appear after the API receives requests through the gateway</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Gateway Traffic — {selectedApi.name}
              <code className="text-xs font-mono text-muted-foreground ml-2">{selectedApi.graviteeApiId}</code>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b bg-muted/30 text-left">
                    <th className="px-3 py-2 font-medium">Timestamp</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Latency</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {logEntries.map((log: any, i: number) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-1.5 text-muted-foreground">{log.timestamp ? new Date(log.timestamp).toLocaleString() : "—"}</td>
                      <td className="px-3 py-1.5 font-bold text-blue-600">{log.method || log.httpMethod || "—"}</td>
                      <td className="px-3 py-1.5 truncate max-w-xs">{log.path || log.uri || "—"}</td>
                      <td className={`px-3 py-1.5 font-bold ${statusColor(log.status || log.responseStatus || 0)}`}>{log.status || log.responseStatus || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{log.responseTime != null ? `${log.responseTime}ms` : "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{log.clientIdentifier || log.user || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Logs Page ──────────────────────────────────────────────────────────

export default function LogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform audit trail, deployment operation logs, and gateway traffic</p>
      </div>

      <Tabs defaultValue="platform">
        <TabsList>
          <TabsTrigger value="platform" className="gap-1.5"><Shield className="h-3.5 w-3.5" />Platform Events</TabsTrigger>
          <TabsTrigger value="deployments" className="gap-1.5"><Terminal className="h-3.5 w-3.5" />Deployment Logs</TabsTrigger>
          <TabsTrigger value="gateway" className="gap-1.5"><Activity className="h-3.5 w-3.5" />Gateway Traffic</TabsTrigger>
        </TabsList>
        <TabsContent value="platform" className="mt-4"><PlatformEvents /></TabsContent>
        <TabsContent value="deployments" className="mt-4"><DeploymentLogs /></TabsContent>
        <TabsContent value="gateway" className="mt-4"><GatewayTrafficLogs /></TabsContent>
      </Tabs>
    </div>
  );
}
