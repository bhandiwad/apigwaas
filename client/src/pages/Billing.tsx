import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, FileText, IndianRupee, AlertCircle, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function BillingPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: invoices, isLoading, refetch } = trpc.billing.invoices.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: usage } = trpc.billing.usage.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createInvoiceMutation = trpc.billing.createInvoice.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("Invoice generated"); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subtotal: "", cgst: "", sgst: "", igst: "", total: "" });

  const statusColors: Record<string, string> = { paid: "bg-emerald-100 text-emerald-700", pending: "bg-amber-100 text-amber-700", overdue: "bg-red-100 text-red-700", draft: "bg-gray-100 text-gray-600", issued: "bg-blue-100 text-blue-700", cancelled: "bg-gray-100 text-gray-600", disputed: "bg-purple-100 text-purple-700" };

  const invoiceList = (invoices as any[]) || [];
  const totalRevenue = invoiceList.filter(i => i.status === "paid").reduce((sum, i) => sum + parseFloat(i.total || "0"), 0);
  const outstanding = invoiceList.filter(i => ["issued", "overdue"].includes(i.status)).reduce((sum, i) => sum + parseFloat(i.total || "0"), 0);
  const overdueInvoices = invoiceList.filter(i => i.status === "overdue");
  const serviceCredits = invoiceList.reduce((sum, i) => sum + parseFloat(i.serviceCredits || "0"), 0);

  // Usage summary
  const totalCalls = (usage as any[])?.reduce((sum: number, u: any) => sum + (u.apiCalls || 0), 0) || 0;
  const totalDataGb = (usage as any[])?.reduce((sum: number, u: any) => sum + parseFloat(u.dataTransferMb || "0"), 0) / 1024 || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing & Invoicing</h1>
          <p className="text-muted-foreground text-sm mt-1">GST-compliant invoicing, payment tracking, and service credits</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><FileText className="h-4 w-4 mr-2" />Generate Invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Generate GST Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Subtotal (₹)</Label><Input type="number" value={form.subtotal} onChange={e => setForm({...form, subtotal: e.target.value})} placeholder="10000" /></div>
                <div><Label>CGST (₹)</Label><Input type="number" value={form.cgst} onChange={e => setForm({...form, cgst: e.target.value})} placeholder="900" /></div>
                <div><Label>SGST (₹)</Label><Input type="number" value={form.sgst} onChange={e => setForm({...form, sgst: e.target.value})} placeholder="900" /></div>
                <div><Label>IGST (₹)</Label><Input type="number" value={form.igst} onChange={e => setForm({...form, igst: e.target.value})} placeholder="0" /></div>
              </div>
              <div><Label>Total (₹)</Label><Input type="number" value={form.total} onChange={e => setForm({...form, total: e.target.value})} placeholder="11800" /></div>
              <Button className="w-full" onClick={() => {
                const now = new Date();
                const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
                const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
                createInvoiceMutation.mutate({
                  tenantId: defaultTenantId,
                  periodStart,
                  periodEnd,
                  lineItems: [{ description: "API Gateway Usage", amount: form.subtotal }],
                  subtotal: form.subtotal || "0",
                  cgst: form.cgst || "0",
                  sgst: form.sgst || "0",
                  igst: form.igst || "0",
                  total: form.total || "0",
                });
              }} disabled={!form.total || createInvoiceMutation.isPending}>
                {createInvoiceMutation.isPending ? "Generating..." : "Generate Invoice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1"><IndianRupee className="h-5 w-5" />{totalRevenue.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground mt-1">{invoiceList.filter(i => i.status === "paid").length} paid invoices</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase">Outstanding</p>
            <p className="text-2xl font-bold text-amber-600 mt-1 flex items-center gap-1"><IndianRupee className="h-5 w-5" />{outstanding.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground mt-1">{invoiceList.filter(i => ["issued", "overdue"].includes(i.status)).length} pending</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase">Service Credits</p>
            <p className="text-2xl font-bold text-blue-600 mt-1 flex items-center gap-1"><IndianRupee className="h-5 w-5" />{serviceCredits.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground mt-1">Available balance</p>
          </CardContent>
        </Card>
        <Card className="border border-border/60">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase">API Usage</p>
            <p className="text-2xl font-bold text-primary mt-1">{totalCalls.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{totalDataGb.toFixed(2)} GB transferred</p>
          </CardContent>
        </Card>
      </div>

      {/* Dunning Alert */}
      {overdueInvoices.length > 0 && (
        <Card className="border-2 border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Dunning: {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-red-600">{overdueInvoices.map(i => i.invoiceNumber).join(", ")} — Retry payment or escalate.</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto border-red-300 text-red-700 hover:bg-red-100" onClick={() => toast.info("Payment retry initiated")}>Retry Payment</Button>
          </CardContent>
        </Card>
      )}

      {/* Invoice List */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Invoices</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading invoices...</div>
          ) : invoiceList.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No invoices yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-3 text-xs font-medium text-muted-foreground uppercase px-3 pb-2 border-b">
                <span>Invoice #</span><span>Period</span><span>Subtotal</span><span>CGST</span><span>SGST/IGST</span><span>Total</span><span>Status</span>
              </div>
              {invoiceList.map((inv: any) => (
                <div key={inv.id} className="grid grid-cols-7 gap-3 items-center px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-mono font-medium">{inv.invoiceNumber}</span>
                  <span className="text-xs text-muted-foreground">{inv.periodStart ? new Date(inv.periodStart).toLocaleDateString() : "—"}</span>
                  <span className="text-sm">₹{parseFloat(inv.subtotal || "0").toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">₹{parseFloat(inv.cgst || "0").toLocaleString("en-IN")}</span>
                  <span className="text-sm text-muted-foreground">₹{(parseFloat(inv.sgst || "0") + parseFloat(inv.igst || "0")).toLocaleString("en-IN")}</span>
                  <span className="text-sm font-semibold">₹{parseFloat(inv.total || "0").toLocaleString("en-IN")}</span>
                  <Badge variant="secondary" className={statusColors[inv.status] || ""}>{inv.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
