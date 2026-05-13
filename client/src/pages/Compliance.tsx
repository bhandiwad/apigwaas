import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Key, Shield, Download, CheckCircle2, Clock, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function CompliancePage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: artifacts, refetch: refetchArtifacts } = trpc.compliance.artifacts.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: byokKeys, refetch: refetchKeys } = trpc.compliance.byokKeys.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createArtifactMutation = trpc.compliance.createArtifact.useMutation({ onSuccess: () => { refetchArtifacts(); setArtifactOpen(false); toast.success("Artifact added"); } });
  const createByokMutation = trpc.compliance.createByokKey.useMutation({ onSuccess: () => { refetchKeys(); setByokOpen(false); toast.success("BYOK key configured"); } });
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [artifactForm, setArtifactForm] = useState({ name: "", type: "soc2" as any, version: "" });
  const [byokForm, setByokForm] = useState({ name: "", provider: "vault" as any, keyIdentifier: "" });

  const artifactList = (artifacts as any[]) || [];
  const keyList = (byokKeys as any[]) || [];

  const typeLabels: Record<string, string> = { soc2: "SOC 2 Type II", iso27001: "ISO 27001", rbi_cscrf: "RBI CSCRF", dpdp: "DPDP", pentest: "Penetration Test", sub_processor: "Sub-Processor List", sla_report: "SLA Report" };
  const typeColors: Record<string, string> = { soc2: "bg-blue-100 text-blue-700", iso27001: "bg-emerald-100 text-emerald-700", rbi_cscrf: "bg-purple-100 text-purple-700", dpdp: "bg-amber-100 text-amber-700", pentest: "bg-red-100 text-red-700", sub_processor: "bg-gray-100 text-gray-700", sla_report: "bg-teal-100 text-teal-700" };
  const keyStatusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", rotating: "bg-amber-100 text-amber-700", revoked: "bg-red-100 text-red-700" };

  const certifications = [
    { name: "SOC 2 Type II", status: "certified", date: "2025-12-15", icon: Shield },
    { name: "ISO 27001:2022", status: "certified", date: "2025-11-20", icon: Shield },
    { name: "RBI CSCRF", status: "in_progress", date: "2026-Q3 Target", icon: Shield },
    { name: "DPDP Act 2023", status: "compliant", date: "2026-01-10", icon: FileText },
  ];

  const statusColors: Record<string, string> = { certified: "bg-emerald-100 text-emerald-700", in_progress: "bg-amber-100 text-amber-700", compliant: "bg-blue-100 text-blue-700" };
  const statusLabels: Record<string, string> = { certified: "Certified", in_progress: "In Progress", compliant: "Compliant" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance & Security</h1>
        <p className="text-muted-foreground text-sm mt-1">SOC 2, ISO 27001, RBI CSCRF compliance artifacts and BYOK key management</p>
      </div>

      {/* Certifications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {certifications.map((cert) => (
          <Card key={cert.name} className="border border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <cert.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{cert.name}</h3>
                    <p className="text-xs text-muted-foreground">{cert.date}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={statusColors[cert.status]}>{statusLabels[cert.status]}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Artifacts from DB */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Compliance Artifacts</CardTitle>
          <Dialog open={artifactOpen} onOpenChange={setArtifactOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add Artifact</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Compliance Artifact</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Name</Label><Input value={artifactForm.name} onChange={e => setArtifactForm({...artifactForm, name: e.target.value})} placeholder="e.g. SOC 2 Type II Report 2026" /></div>
                <div><Label>Type</Label>
                  <Select value={artifactForm.type} onValueChange={v => setArtifactForm({...artifactForm, type: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="soc2">SOC 2 Type II</SelectItem>
                      <SelectItem value="iso27001">ISO 27001</SelectItem>
                      <SelectItem value="rbi_cscrf">RBI CSCRF</SelectItem>
                      <SelectItem value="dpdp">DPDP</SelectItem>
                      <SelectItem value="pentest">Penetration Test</SelectItem>
                      <SelectItem value="sub_processor">Sub-Processor List</SelectItem>
                      <SelectItem value="sla_report">SLA Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Version</Label><Input value={artifactForm.version} onChange={e => setArtifactForm({...artifactForm, version: e.target.value})} placeholder="e.g. v2.1" /></div>
                <Button className="w-full" onClick={() => createArtifactMutation.mutate({ tenantId: defaultTenantId, ...artifactForm })} disabled={!artifactForm.name || createArtifactMutation.isPending}>
                  {createArtifactMutation.isPending ? "Adding..." : "Add Artifact"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {artifactList.length === 0 ? (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No compliance artifacts uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {artifactList.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 text-primary" />
                    <div>
                      <span className="text-sm font-medium">{a.name}</span>
                      {a.version && <span className="text-xs text-muted-foreground ml-2">v{a.version}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={typeColors[a.type] || ""}>{typeLabels[a.type] || a.type}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toast.info("Download initiated")}><Download className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DPDP Data Principal Rights */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">DPDP Data Principal Rights Portal</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { right: "Right to Access", desc: "Export personal data held by the platform", action: "Request Export" },
              { right: "Right to Correction", desc: "Request correction of inaccurate data", action: "Submit Request" },
              { right: "Right to Erasure", desc: "Request deletion of personal data", action: "Submit Request" },
              { right: "Right to Grievance Redressal", desc: "File complaints regarding data processing", action: "File Complaint" },
            ].map((r) => (
              <div key={r.right} className="p-4 rounded-lg border border-border/40 bg-muted/20">
                <h4 className="text-sm font-semibold">{r.right}</h4>
                <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => toast.info("DPDP request submitted")}>{r.action}</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* BYOK Keys from DB */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4 text-primary" />BYOK Key Management</CardTitle>
          <Dialog open={byokOpen} onOpenChange={setByokOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline"><Key className="h-3 w-3 mr-1" />Configure Key</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Configure BYOK Key</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Key Name</Label><Input value={byokForm.name} onChange={e => setByokForm({...byokForm, name: e.target.value})} placeholder="e.g. Production Encryption Key" /></div>
                <div><Label>Provider</Label>
                  <Select value={byokForm.provider} onValueChange={v => setByokForm({...byokForm, provider: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vault">HashiCorp Vault</SelectItem>
                      <SelectItem value="aws_kms">AWS KMS</SelectItem>
                      <SelectItem value="azure_keyvault">Azure Key Vault</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Key Identifier / ARN</Label><Input value={byokForm.keyIdentifier} onChange={e => setByokForm({...byokForm, keyIdentifier: e.target.value})} placeholder="arn:aws:kms:... or vault/path/key" /></div>
                <Button className="w-full" onClick={() => createByokMutation.mutate({ tenantId: defaultTenantId, ...byokForm })} disabled={!byokForm.name || !byokForm.keyIdentifier || createByokMutation.isPending}>
                  {createByokMutation.isPending ? "Configuring..." : "Configure Key"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Bring Your Own Key (BYOK) allows you to manage encryption keys for data-at-rest using your own HSM or KMS provider.</p>
          {keyList.length === 0 ? (
            <div className="text-center py-4">
              <Key className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No BYOK keys configured</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keyList.map((k: any) => (
                <div key={k.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                  <div className="flex items-center gap-3">
                    <Key className="h-4 w-4 text-primary" />
                    <div>
                      <span className="text-sm font-medium">{k.name}</span>
                      <p className="text-xs text-muted-foreground">{k.provider} · {k.keyIdentifier?.slice(0, 40)}{k.keyIdentifier?.length > 40 ? "..." : ""}</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className={keyStatusColors[k.status] || ""}>{k.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Certification Roadmap */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Certification Roadmap</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { milestone: "SOC 2 Type II Renewal", date: "Dec 2026", status: "scheduled" },
              { milestone: "ISO 27001 Surveillance Audit", date: "Nov 2026", status: "scheduled" },
              { milestone: "RBI CSCRF Certification", date: "Q3 2026", status: "in_progress" },
              { milestone: "PCI DSS Level 1", date: "Q1 2027", status: "planned" },
            ].map((m) => (
              <div key={m.milestone} className="flex items-center gap-3">
                {m.status === "in_progress" ? <Clock className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-muted-foreground/40" />}
                <div className="flex-1"><p className="text-sm font-medium">{m.milestone}</p></div>
                <span className="text-xs text-muted-foreground">{m.date}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
