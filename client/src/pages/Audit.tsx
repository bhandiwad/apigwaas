import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Search, Filter, Shield, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AuditPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ tenantId: defaultTenantId, limit: 100 }, { enabled: !!defaultTenantId });
  const exportMutation = trpc.audit.export.useMutation();

  const actionColors: Record<string, string> = {
    "tenant.create": "bg-blue-100 text-blue-700",
    "tenant.update": "bg-blue-100 text-blue-700",
    "api.create": "bg-emerald-100 text-emerald-700",
    "api.publish": "bg-amber-100 text-amber-700",
    "api.deprecate": "bg-red-100 text-red-700",
    "policy.create": "bg-purple-100 text-purple-700",
    "policy.update": "bg-purple-100 text-purple-700",
    "subscription.create": "bg-teal-100 text-teal-700",
    "user.login": "bg-gray-100 text-gray-700",
    "user.logout": "bg-gray-100 text-gray-700",
    "role.create": "bg-indigo-100 text-indigo-700",
    "invoice.generate": "bg-orange-100 text-orange-700",
  };

  const events = ((logs as any)?.events || []);
  const uniqueActions = Array.from(new Set(events.map((l: any) => l.action))) as string[];

  const filtered = events.filter((l: any) => {
    const matchesSearch = search === "" || 
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
      l.resourceType?.toLowerCase().includes(search.toLowerCase());
    const matchesAction = actionFilter === "all" || l.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const handleExport = async (format: "csv" | "jsonl") => {
    try {
      const result = await exportMutation.mutateAsync({ tenantId: defaultTenantId, format });
      // Create downloadable file
      const blob = new Blob([result.content], { type: format === "csv" ? "text/csv" : "application/jsonl" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${new Date().toISOString().slice(0,10)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} export downloaded (${result.recordCount} records). SHA-256: ${result.signature.slice(0, 16)}...`);
    } catch (e) {
      toast.error("Export failed. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable, append-only log of all platform actions with SHA-256 tamper-evidence signatures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport("csv")} disabled={exportMutation.isPending}>
            <Download className="h-4 w-4 mr-2" />{exportMutation.isPending ? "Exporting..." : "Export CSV"}
          </Button>
          <Button variant="outline" onClick={() => handleExport("jsonl")} disabled={exportMutation.isPending}>
            <Download className="h-4 w-4 mr-2" />Export JSONL
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by action, actor, or resource..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a: any) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-xs">{filtered.length} events</Badge>
      </div>

      <Card className="border border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No audit entries found</p>
              <p className="text-xs text-muted-foreground mt-1">Audit events are recorded automatically for all admin, publisher, and consumer actions.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((log: any) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {log.actorEmail?.charAt(0).toUpperCase() || "S"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{log.actorEmail || "System"}</span>
                        <Badge variant="secondary" className={actionColors[log.action] || "bg-gray-100 text-gray-700"}>{log.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.resourceType && <span>{log.resourceType} {log.resourceId && `#${log.resourceId}`}</span>}
                        {log.ipAddress && <span className="ml-2">IP: {log.ipAddress}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SIEM Integration Info */}
      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="p-4 flex items-center gap-3">
          <Shield className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">SIEM Integration & Tamper Evidence</p>
            <p className="text-xs text-muted-foreground">All exports include SHA-256 signatures for tamper-evidence verification. Logs can be streamed to your SIEM via webhook or Kafka connector. Contact support to configure streaming.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
