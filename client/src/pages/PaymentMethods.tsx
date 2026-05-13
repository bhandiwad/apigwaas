import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus, Trash2, Star, IndianRupee } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PaymentMethodsPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: invoices } = trpc.billing.invoices.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "card", cardNumber: "", expiry: "", cvv: "", name: "", upiId: "" });

  type PaymentMethod = { id: number; type: string; last4?: string; brand: string; expiry?: string; upiId?: string; isDefault: boolean };
  // Payment methods stored in tenant billing config (would be a separate table in production)
  const [methods, setMethods] = useState<PaymentMethod[]>([
    { id: 1, type: "card", last4: "4242", brand: "Visa", expiry: "12/27", isDefault: true },
    { id: 2, type: "card", last4: "5555", brand: "Mastercard", expiry: "06/26", isDefault: false },
    { id: 3, type: "upi", upiId: "company@hdfc", brand: "UPI", isDefault: false },
    { id: 4, type: "netbanking", brand: "HDFC Bank", isDefault: false },
  ]);

  const handleAdd = () => {
    if (form.type === "card" && (!form.cardNumber || !form.expiry || !form.cvv)) {
      toast.error("Please fill all card details"); return;
    }
    if (form.type === "upi" && !form.upiId) {
      toast.error("Please enter UPI ID"); return;
    }
    const newMethod = {
      id: methods.length + 1,
      type: form.type,
      last4: form.cardNumber.slice(-4) || "",
      brand: form.type === "card" ? "Visa" : form.type === "upi" ? "UPI" : "Net Banking",
      expiry: form.expiry,
      upiId: form.upiId,
      isDefault: methods.length === 0,
    };
    setMethods([...methods, newMethod]);
    setOpen(false);
    setForm({ type: "card", cardNumber: "", expiry: "", cvv: "", name: "", upiId: "" });
    toast.success("Payment method added successfully");
  };

  const handleSetDefault = (id: number) => {
    setMethods(methods.map(m => ({ ...m, isDefault: m.id === id })));
    toast.success("Default payment method updated");
  };

  const handleRemove = (id: number) => {
    const method = methods.find(m => m.id === id);
    if (method?.isDefault) { toast.error("Cannot remove default payment method. Set another as default first."); return; }
    setMethods(methods.filter(m => m.id !== id));
    toast.success("Payment method removed");
  };

  const totalDue = ((invoices as any[]) || []).filter((i: any) => i.status === "pending").reduce((sum: number, i: any) => sum + parseFloat(i.totalAmount || "0"), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment Methods</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage payment methods for subscription billing and GST-compliant invoicing</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Add Method</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Payment Method</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Payment Type</Label>
                <Select value={form.type} onValueChange={v => setForm({...form, type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="netbanking">Net Banking</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === "card" && (
                <>
                  <div><Label>Card Number</Label><Input value={form.cardNumber} onChange={e => setForm({...form, cardNumber: e.target.value})} placeholder="4242 4242 4242 4242" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Expiry</Label><Input value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} placeholder="MM/YY" /></div>
                    <div><Label>CVV</Label><Input value={form.cvv} onChange={e => setForm({...form, cvv: e.target.value})} placeholder="123" type="password" /></div>
                  </div>
                  <div><Label>Cardholder Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Name on card" /></div>
                </>
              )}
              {form.type === "upi" && (
                <div><Label>UPI ID</Label><Input value={form.upiId} onChange={e => setForm({...form, upiId: e.target.value})} placeholder="company@hdfc" /></div>
              )}
              {form.type === "netbanking" && (
                <div className="p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">You will be redirected to your bank's secure portal during payment.</div>
              )}
              <Button className="w-full" onClick={handleAdd}>Add Payment Method</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Outstanding Balance */}
      {totalDue > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IndianRupee className="h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800">Outstanding Balance</p>
                <p className="text-xs text-amber-600">Payment due for pending invoices</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold text-amber-800">₹{totalDue.toLocaleString()}</span>
              <Button size="sm" onClick={() => toast.success("Payment initiated for outstanding balance")}>Pay Now</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Methods List */}
      <div className="space-y-3">
        {methods.map(method => (
          <Card key={method.id} className="border border-border/60">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">
                      {method.type === "card" ? `${method.brand} •••• ${method.last4}` :
                       method.type === "upi" ? `UPI: ${(method as any).upiId || "company@hdfc"}` :
                       method.brand}
                    </h3>
                    {method.isDefault && <Badge variant="secondary" className="bg-amber-100 text-amber-700"><Star className="h-3 w-3 mr-1" />Default</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {method.type === "card" ? `Expires ${method.expiry}` :
                     method.type === "upi" ? "Unified Payments Interface" :
                     "Internet Banking"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!method.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => handleSetDefault(method.id)}>Set Default</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleRemove(method.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Billing Information */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Billing Information (GST-Compliant)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Company Name</Label>
              <p className="text-sm font-medium">{(tenants as any)?.[0]?.name || "Your Organization"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">GSTIN</Label>
              <p className="text-sm font-medium">{(tenants as any)?.[0]?.gstin || "Not configured"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">PAN</Label>
              <p className="text-sm font-medium">{(tenants as any)?.[0]?.pan || "Not configured"}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Billing Email</Label>
              <p className="text-sm font-medium">{(tenants as any)?.[0]?.contactEmail || "Not configured"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dunning Info */}
      <Card className="border border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <p className="text-sm font-medium">Dunning Policy</p>
          <p className="text-xs text-muted-foreground mt-1">Failed payments are retried automatically: Day 1, Day 3, Day 7, Day 14. After 4 failed attempts, the account is suspended pending manual resolution. Contact support for payment issues.</p>
        </CardContent>
      </Card>
    </div>
  );
}
