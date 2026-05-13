import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Plus, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SupportPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: tickets, isLoading, refetch } = trpc.support.tickets.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.support.createTicket.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Ticket created"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", description: "", severity: "S3" as "S1" | "S2" | "S3" | "S4", category: "" });

  const severityColors: Record<string, string> = { S1: "bg-red-100 text-red-700", S2: "bg-amber-100 text-amber-700", S3: "bg-blue-100 text-blue-700", S4: "bg-gray-100 text-gray-600" };
  const statusColors: Record<string, string> = { open: "bg-amber-100 text-amber-700", in_progress: "bg-blue-100 text-blue-700", waiting_customer: "bg-purple-100 text-purple-700", resolved: "bg-emerald-100 text-emerald-700", closed: "bg-gray-100 text-gray-600" };

  const slaTargets = [
    { severity: "S1 — Critical", response: "15 min", resolution: "4 hours" },
    { severity: "S2 — High", response: "30 min", resolution: "8 hours" },
    { severity: "S3 — Medium", response: "2 hours", resolution: "24 hours" },
    { severity: "S4 — Low", response: "8 hours", resolution: "72 hours" },
  ];

  const ticketList = (tickets as any[]) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground text-sm mt-1">Ticket management with severity-based SLA tracking</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />New Ticket</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Support Ticket</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Subject</Label><Input value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} placeholder="Brief description of the issue" /></div>
              <div><Label>Severity</Label>
                <Select value={form.severity} onValueChange={v => setForm({...form, severity: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S1">S1 — Critical (Service Down)</SelectItem>
                    <SelectItem value="S2">S2 — High (Major Impact)</SelectItem>
                    <SelectItem value="S3">S3 — Medium (Minor Impact)</SelectItem>
                    <SelectItem value="S4">S4 — Low (Question/Enhancement)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Category</Label><Input value={form.category} onChange={e => setForm({...form, category: e.target.value})} placeholder="e.g. Billing, API, Performance" /></div>
              <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Detailed description, steps to reproduce..." rows={4} /></div>
              <Button className="w-full" onClick={() => createMutation.mutate({ tenantId: defaultTenantId, ...form })} disabled={!form.subject || createMutation.isPending}>
                {createMutation.isPending ? "Submitting..." : "Submit Ticket"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tickets */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Tickets ({ticketList.length})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tickets...</div>
          ) : ticketList.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No support tickets</p>
            </div>
          ) : (
            <div className="space-y-2">
              {ticketList.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{t.id}</span>
                        <span className="text-sm font-medium">{t.subject}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created {t.createdAt ? new Date(t.createdAt).toLocaleString() : "—"}
                        {t.category && ` · ${t.category}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={severityColors[t.severity] || ""}>{t.severity}</Badge>
                    <Badge variant="secondary" className={statusColors[t.status] || ""}>{(t.status || "open").replace("_", " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SLA Targets */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">SLA Targets</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-xs font-medium text-muted-foreground uppercase pb-2 border-b px-2">
            <span>Severity</span><span>First Response</span><span>Resolution</span><span>Status</span>
          </div>
          {slaTargets.map((sla) => (
            <div key={sla.severity} className="grid grid-cols-4 gap-4 items-center py-2.5 px-2 text-sm">
              <span className="font-medium">{sla.severity}</span>
              <span>{sla.response}</span>
              <span>{sla.resolution}</span>
              <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3 w-3" /><span className="text-xs">Meeting</span></div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
