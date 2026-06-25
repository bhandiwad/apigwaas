import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Search, Shield, Clock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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

function EventDetail({ event, onClose }: { event: any; onClose: () => void }) {
  const rawFields: [string, any][] = [
    ["ID", event.id],
    ["Timestamp", event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"],
    ["Action", event.action],
    ["Action Type", event.actionType],
    ["Target Type", event.targetType],
    ["Target ID", event.targetId],
    ["Target Name", event.targetName],
    ["Actor", event.actorName || event.actorEmail || "System"],
    ["Actor Email", event.actorEmail],
    ["Actor ID", event.actorId],
    ["Source IP", event.sourceIp],
    ["User Agent", event.userAgent],
    ["Correlation ID", event.correlationId],
    ["Tenant ID", event.tenantId],
  ];
  const coreFields = rawFields.filter(([, v]) => v != null && v !== "" && v !== "—");

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Audit Event
            <Badge className={`text-xs ml-1 ${actionTypeColors[event.actionType] || "bg-gray-100 text-gray-600"}`}>{event.actionType}</Badge>
            <code className="text-xs font-mono text-muted-foreground ml-auto">#{event.id}</code>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-1">
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {coreFields.map(([label, value]) => (
              <div key={label}>
                <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</div>
                <div className="font-mono text-xs mt-0.5 break-all">{String(value)}</div>
              </div>
            ))}
          </div>

          {/* Before / After diff */}
          {(event.beforeState || event.afterState) && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">State Change</div>
              <div className="grid grid-cols-2 gap-3">
                {event.beforeState && (
                  <div>
                    <div className="text-xs text-red-500 mb-1">Before</div>
                    <pre className="bg-gray-950 text-red-200 text-xs rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed">
                      {JSON.stringify(event.beforeState, null, 2)}
                    </pre>
                  </div>
                )}
                {event.afterState && (
                  <div>
                    <div className="text-xs text-green-500 mb-1">After</div>
                    <pre className="bg-gray-950 text-green-200 text-xs rounded-lg p-3 overflow-auto max-h-48 font-mono leading-relaxed">
                      {JSON.stringify(event.afterState, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {event.metadata && (
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">Metadata</div>
              <pre className="bg-gray-950 text-gray-200 text-xs rounded-lg p-3 overflow-auto max-h-40 font-mono leading-relaxed">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AuditPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const { data: logs, isLoading, refetch } = trpc.audit.list.useQuery({ limit: 200 });
  const exportMutation = trpc.audit.export.useMutation();

  const events: any[] = (logs as any)?.events || [];
  const uniqueActions = Array.from(new Set(events.map((l: any) => l.action))) as string[];

  const filtered = events.filter((l: any) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.action?.toLowerCase().includes(q) ||
      l.actorEmail?.toLowerCase().includes(q) ||
      l.actorName?.toLowerCase().includes(q) ||
      l.targetType?.toLowerCase().includes(q) ||
      l.targetName?.toLowerCase().includes(q);
    const matchAction = actionFilter === "all" || l.action === actionFilter;
    return matchSearch && matchAction;
  });

  const handleExport = async (format: "csv" | "jsonl") => {
    try {
      const result = await exportMutation.mutateAsync({ format });
      const blob = new Blob([result.content], { type: format === "csv" ? "text/csv" : "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${new Date().toISOString().slice(0, 10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${result.recordCount} records · SHA-256: ${result.signature.slice(0, 16)}…`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable, append-only log of all platform actions — click any row for full detail</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1.5" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} disabled={exportMutation.isPending}>
            <Download className="h-4 w-4 mr-1.5" />{exportMutation.isPending ? "Exporting…" : "Export CSV"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("jsonl")} disabled={exportMutation.isPending}>
            <Download className="h-4 w-4 mr-1.5" />Export JSONL
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search action, actor, resource…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Filter by action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a: string) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{filtered.length} events</Badge>
      </div>

      <Card className="border border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No audit entries found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log: any) => (
                <button
                  key={log.id}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors text-left"
                  onClick={() => setSelectedEvent(log)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                      {log.actorEmail?.charAt(0).toUpperCase() || log.actorName?.charAt(0).toUpperCase() || "S"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{log.actorEmail || log.actorName || "System"}</span>
                        <Badge variant="secondary" className={`${actionTypeColors[log.actionType] || "bg-gray-100 text-gray-700"} text-xs`}>
                          {log.action}
                        </Badge>
                        {log.targetName && <span className="text-xs text-muted-foreground truncate">→ {log.targetName}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {log.targetType && <span>{log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</span>}
                        {log.sourceIp && <span>IP: {log.sourceIp}</span>}
                        {(log.beforeState || log.afterState || log.metadata) && (
                          <span className="text-primary/60">has state diff</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">SIEM Integration & Tamper Evidence</p>
            <p className="text-xs text-muted-foreground">Exports include SHA-256 signatures for tamper verification. Logs can be streamed to your SIEM via webhook or Kafka connector.</p>
          </div>
        </CardContent>
      </Card>

      {selectedEvent && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    </div>
  );
}
