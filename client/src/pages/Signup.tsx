import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Building2, Shield, CreditCard, Rocket } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function SignupPage() {
  const createTenant = trpc.tenant.create.useMutation({ onSuccess: () => { toast.success("Registration submitted! Provisioning will begin shortly."); setStep(5); } });
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    gstin: "",
    pan: "",
    tier: "starter",
    region: "mumbai",
    mfaEnabled: false,
    acceptTerms: false,
  });

  const steps = [
    { num: 1, label: "Company Info", icon: Building2 },
    { num: 2, label: "KYC/KYB", icon: Shield },
    { num: 3, label: "Plan Selection", icon: CreditCard },
    { num: 4, label: "Review & Submit", icon: Rocket },
  ];

  const tierInfo: Record<string, { name: string; desc: string; price: string; features: string[] }> = {
    starter: { name: "Starter", desc: "For small teams getting started", price: "₹9,999/mo", features: ["5 APIs", "100K calls/mo", "Email support", "1 workspace"] },
    business: { name: "Business", desc: "For growing businesses", price: "₹49,999/mo", features: ["25 APIs", "1M calls/mo", "Priority support", "5 workspaces", "Custom policies"] },
    enterprise: { name: "Enterprise", desc: "For large organizations", price: "Custom", features: ["Unlimited APIs", "Unlimited calls", "24/7 support", "Unlimited workspaces", "SLA guarantee", "Dedicated account manager"] },
    sovereign: { name: "Sovereign", desc: "For regulated industries", price: "Custom", features: ["Everything in Enterprise", "Data residency", "BYOK encryption", "Compliance artifacts", "On-prem deployment option", "RBI CSCRF compliance"] },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Self-Service Registration</h1>
        <p className="text-muted-foreground text-sm mt-1">Register your organization for the CloudInfinit API Gateway platform</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${step >= s.num ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span className={`text-xs font-medium ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`w-12 h-0.5 ${step > s.num ? "bg-primary" : "bg-muted"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Company Info */}
      {step === 1 && (
        <Card className="border border-border/60 max-w-2xl mx-auto">
          <CardHeader><CardTitle>Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Company Name *</Label><Input value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} placeholder="Your Organization Name" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Contact Email *</Label><Input type="email" value={form.contactEmail} onChange={e => setForm({...form, contactEmail: e.target.value})} placeholder="admin@company.com" /></div>
              <div><Label>Contact Phone</Label><Input value={form.contactPhone} onChange={e => setForm({...form, contactPhone: e.target.value})} placeholder="+91 9876543210" /></div>
            </div>
            <div><Label>Preferred Region</Label>
              <Select value={form.region} onValueChange={v => setForm({...form, region: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mumbai">Mumbai (ap-south-1)</SelectItem>
                  <SelectItem value="chennai">Chennai (ap-south-2)</SelectItem>
                  <SelectItem value="hyderabad">Hyderabad (ap-south-3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => { if (!form.companyName || !form.contactEmail) { toast.error("Company name and email required"); return; } setStep(2); }}>Continue to KYC/KYB</Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: KYC/KYB */}
      {step === 2 && (
        <Card className="border border-border/60 max-w-2xl mx-auto">
          <CardHeader><CardTitle>KYC/KYB Verification</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Provide your business identity documents for verification as required by Indian regulations.</p>
            <div><Label>GSTIN (Goods and Services Tax Identification Number) *</Label><Input value={form.gstin} onChange={e => setForm({...form, gstin: e.target.value})} placeholder="22AAAAA0000A1Z5" /></div>
            <div><Label>PAN (Permanent Account Number) *</Label><Input value={form.pan} onChange={e => setForm({...form, pan: e.target.value})} placeholder="AAAAA0000A" /></div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-700"><Shield className="h-3 w-3 inline mr-1" />Your documents will be verified within 24-48 hours. You can start using the platform immediately with limited access.</p>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={form.mfaEnabled} onChange={e => setForm({...form, mfaEnabled: e.target.checked})} className="rounded" />
              <Label className="text-sm">Enable Multi-Factor Authentication (recommended)</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-1" onClick={() => { if (!form.gstin || !form.pan) { toast.error("GSTIN and PAN are required"); return; } setStep(3); }}>Continue to Plan Selection</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Plan Selection */}
      {step === 3 && (
        <div className="max-w-4xl mx-auto space-y-4">
          <Card className="border border-border/60">
            <CardHeader><CardTitle>Select Your Plan</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(tierInfo).map(([key, info]) => (
                  <div key={key} className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${form.tier === key ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50"}`} onClick={() => setForm({...form, tier: key})}>
                    <h3 className="font-semibold">{info.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{info.desc}</p>
                    <p className="text-lg font-bold text-primary mt-2">{info.price}</p>
                    <ul className="mt-3 space-y-1">
                      {info.features.map(f => <li key={f} className="text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{f}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
            <Button className="flex-1" onClick={() => setStep(4)}>Review & Submit</Button>
          </div>
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card className="border border-border/60 max-w-2xl mx-auto">
          <CardHeader><CardTitle>Review Your Registration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Company:</span> <span className="font-medium">{form.companyName}</span></div>
              <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{form.contactEmail}</span></div>
              <div><span className="text-muted-foreground">GSTIN:</span> <span className="font-medium">{form.gstin}</span></div>
              <div><span className="text-muted-foreground">PAN:</span> <span className="font-medium">{form.pan}</span></div>
              <div><span className="text-muted-foreground">Plan:</span> <Badge variant="secondary">{tierInfo[form.tier]?.name}</Badge></div>
              <div><span className="text-muted-foreground">Region:</span> <span className="font-medium">{form.region}</span></div>
              <div><span className="text-muted-foreground">MFA:</span> <span className="font-medium">{form.mfaEnabled ? "Enabled" : "Disabled"}</span></div>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" checked={form.acceptTerms} onChange={e => setForm({...form, acceptTerms: e.target.checked})} className="rounded" />
              <Label className="text-sm">I accept the Terms of Service and Privacy Policy</Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button className="flex-1" onClick={() => {
                if (!form.acceptTerms) { toast.error("Please accept the terms"); return; }
                createTenant.mutate({ name: form.companyName, tier: form.tier as any, gstin: form.gstin, pan: form.pan, contactEmail: form.contactEmail, region: form.region });
              }} disabled={createTenant.isPending}>
                {createTenant.isPending ? "Submitting..." : "Complete Registration"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Success */}
      {step === 5 && (
        <Card className="border border-border/60 max-w-2xl mx-auto">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold">Registration Successful!</h2>
            <p className="text-muted-foreground mt-2">Your organization has been registered. Provisioning will begin shortly.</p>
            <p className="text-sm text-muted-foreground mt-4">KYC/KYB verification typically completes within 24-48 hours.</p>
            <Button className="mt-6" onClick={() => setStep(1)}>Register Another Organization</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
