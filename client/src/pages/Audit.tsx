import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Download, Search, Filter } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AuditPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const [search, setSearch] = useState("");
  const { data: logs, isLoading } = trpc.audit.list.useQuery({ tenantId: defaultTenantId, limit: 50 }, { enabled: !!defaultTenantId });

  const actionColors: Record<string, string> = {
    "tenant.create": "bg-blue-100 text-blue-700",
    "api.create": "bg-emerald-100 text-emerald-700",
    "api.publish": "bg-amber-100 text-amber-700",
    "policy.create": "bg-purple-100 text-purple-700",
    "user.login": "bg-gray-100 text-gray-700",
  };

  const filtered = ((logs as any)?.events || []).filter((l: any) =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
    l.resourceType?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
          <p className="text-muted-foreground text-sm mt-1">Immutable, append-only log of all platform actions with SHA-256 signatures</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.info("CSV export with SHA-256 signature coming soon")}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="outline" onClick={() => toast.info("JSONL export coming soon")}><Download className="h-4 w-4 mr-2" />Export JSONL</Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by action, actor, or resource..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1" />Filters</Button>
      </div>

      <Card className="border border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading audit logs...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">No audit entries found</p>
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
                        <Badge variant="secondary" className={actionColors[log.action] || "bg-gray-100 text-gray-700"} >{log.action}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.resourceType && <span>{log.resourceType} {log.resourceId && `#${log.resourceId}`}</span>}
                        {log.ipAddress && <span className="ml-2">IP: {log.ipAddress}</span>}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SIEM Info */}
      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="p-4 flex items-center gap-3">
          <FileText className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium">SIEM Integration</p>
            <p className="text-xs text-muted-foreground">Audit logs can be streamed to your SIEM via webhook or Kafka connector. Configure in Platform Settings.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
