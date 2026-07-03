import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Server, CheckCircle2, AlertTriangle, Clock, Plus, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function StatusPage() {
  const { data: incidents, refetch } = trpc.status.incidents.useQuery();
  const { data: clusters } = trpc.gateway.clusters.useQuery();
  const { data: gatewayStatus } = trpc.gateway.connectionStatus.useQuery();
  const createMutation = trpc.status.createIncident.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Incident reported"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", severity: "minor" as "minor" | "major" | "critical" });

  const incidentList = (incidents as any[]) || [];
  const clusterList = (clusters as any[]) || [];
  const activeIncidents = incidentList.filter(i => i.status !== "resolved");
  const resolvedIncidents = incidentList.filter(i => i.status === "resolved");

  // Regions derived from real registered gateway clusters
  const regions = clusterList.map((c: any) => ({
    id: c.id,
    name: `${c.name} (${c.region})`,
    status: c.status === "healthy" ? "operational" : c.status === "offline" ? "outage" : "degraded",
    tier: c.tier,
    graviteeEnvId: c.graviteeEnvId,
    nodeCount: c.nodeCount,
    cpuUsagePercent: c.cpuUsagePercent,
  }));

  // Services derived from real signals only — no hardcoded "operational".
  // Rate limiting (Redis) and analytics (Elasticsearch) are Gravitee-stack dependencies,
  // so their health tracks the gateway runtime / management connection.
  const graviteeConnected = (gatewayStatus as any)?.connected ?? false;
  const gatewayUp = clusterList.some((c: any) => c.status === "healthy");
  const services = [
    { name: "Gravitee Management API", status: graviteeConnected ? "operational" : "outage" },
    { name: "API Gateway Runtime", status: gatewayUp ? "operational" : clusterList.length === 0 ? "outage" : "degraded" },
    { name: "Authentication Service", status: activeIncidents.some((i: any) => i.title?.toLowerCase().includes("auth")) ? "degraded" : "operational" },
    { name: "Rate Limiting (Redis)", status: gatewayUp ? "operational" : "degraded" },
    { name: "Analytics (Elasticsearch)", status: graviteeConnected ? "operational" : "degraded" },
  ];

  const overallStatus = activeIncidents.some(i => i.severity === "critical") ? "outage" : activeIncidents.length > 0 ? "degraded" : "operational";
  const statusIcon = (s: string) => s === "operational" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : s === "outage" ? <XCircle className="h-4 w-4 text-red-500" /> : <AlertTriangle className="h-4 w-4 text-amber-500" />;
  const statusColors: Record<string, string> = { operational: "bg-emerald-100 text-emerald-700", degraded: "bg-amber-100 text-amber-700", outage: "bg-red-100 text-red-700", investigating: "bg-amber-100 text-amber-700", identified: "bg-blue-100 text-blue-700", monitoring: "bg-purple-100 text-purple-700", resolved: "bg-emerald-100 text-emerald-700" };
  const severityColors: Record<string, string> = { minor: "bg-blue-100 text-blue-700", major: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Status</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time service health per region with incident history</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Report Incident</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Report Incident</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Brief incident description" /></div>
              <div><Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm({...form, severity: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minor">Minor</SelectItem>
                    <SelectItem value="major">Major</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed description" /></div>
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.title || createMutation.isPending}>
                {createMutation.isPending ? "Reporting..." : "Report Incident"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Overall Status */}
      <Card className={`border-2 ${overallStatus === "operational" ? "border-emerald-200 bg-emerald-50" : overallStatus === "degraded" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
        <CardContent className="p-4 flex items-center gap-3">
          {overallStatus === "operational" ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : overallStatus === "degraded" ? <AlertTriangle className="h-6 w-6 text-amber-600" /> : <XCircle className="h-6 w-6 text-red-600" />}
          <div>
            <p className={`font-semibold ${overallStatus === "operational" ? "text-emerald-800" : overallStatus === "degraded" ? "text-amber-800" : "text-red-800"}`}>
              {overallStatus === "operational" ? "All Systems Operational" : overallStatus === "degraded" ? "Partial Degradation" : "Service Outage"}
            </p>
            <p className={`text-xs ${overallStatus === "operational" ? "text-emerald-600" : overallStatus === "degraded" ? "text-amber-600" : "text-red-600"}`}>
              {activeIncidents.length === 0 ? "All services running normally" : `${activeIncidents.length} active incident${activeIncidents.length > 1 ? "s" : ""}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Gateway Clusters / Regions */}
      {regions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {regions.map((r) => (
            <Card key={r.id} className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{r.name}</span>
                  </div>
                  {statusIcon(r.status)}
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <Badge variant="secondary" className={statusColors[r.status]}>{r.status}</Badge>
                  <span className="capitalize">{r.tier} · env:{r.graviteeEnvId || "DEFAULT"} · {r.nodeCount} node{r.nodeCount !== 1 ? "s" : ""}</span>
                </div>
                {r.cpuUsagePercent > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">CPU: {r.cpuUsagePercent}%</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border border-border/60">
          <CardContent className="p-4 text-sm text-muted-foreground text-center py-6">
            No gateway clusters registered. Add a cluster under Gateway → Clusters.
          </CardContent>
        </Card>
      )}

      {/* Services */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Service Status</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {services.map((s) => (
              <div key={s.name} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/20">
                <span className="text-sm">{s.name}</span>
                {statusIcon(s.status)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
        <Card className="border border-border/60">
          <CardHeader className="pb-3"><CardTitle className="text-base">Active Incidents</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeIncidents.map((inc: any) => (
                <div key={inc.id} className="p-3 rounded-lg border border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={statusColors[inc.status] || ""}>{inc.status}</Badge>
                      <Badge variant="secondary" className={severityColors[inc.severity] || ""}>{inc.severity}</Badge>
                      <span className="text-sm font-medium">{inc.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{inc.createdAt ? new Date(inc.createdAt).toLocaleString() : ""}</span>
                  </div>
                  {inc.description && <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resolved Incidents */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Incident History</CardTitle></CardHeader>
        <CardContent>
          {resolvedIncidents.length === 0 && activeIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No incidents recorded</p>
          ) : resolvedIncidents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No resolved incidents</p>
          ) : (
            <div className="space-y-3">
              {resolvedIncidents.slice(0, 10).map((inc: any) => (
                <div key={inc.id} className="p-3 rounded-lg border border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium">{inc.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Maintenance */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Scheduled Maintenance</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>No maintenance windows scheduled</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
