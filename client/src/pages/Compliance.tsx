import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Key, Shield, Download, CheckCircle2, Clock, FileText, Plus, AlertTriangle, User, Database, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const DPDP_ACTIONS = [
  { right: "Right to Access", desc: "Export personal data held by the platform", action: "Request Export", key: "access" as const },
  { right: "Right to Correction", desc: "Request correction of inaccurate data", action: "Submit Request", key: "correct" as const },
  { right: "Right to Erasure", desc: "Request deletion of personal data", action: "Submit Request", key: "erase" as const },
  { right: "Right to Grievance Redressal", desc: "File complaints regarding data processing", action: "File Complaint", key: "object" as const },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  overdue: "bg-red-200 text-red-800",
  granted: "bg-emerald-100 text-emerald-700",
  revoked: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-600",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function CompliancePage() {
  const { data: artifacts, refetch: refetchArtifacts } = trpc.compliance.artifacts.useQuery({});
  const { data: byokKeys, refetch: refetchKeys } = trpc.compliance.byokKeys.useQuery(undefined);
  const { data: dpdpReqs, refetch: refetchDpdp } = trpc.compliance.dpdpRequests.useQuery();
  const { data: consentList, refetch: refetchConsent } = trpc.compliance.consentList.useQuery({});
  const { data: activities, refetch: refetchActivities } = trpc.compliance.processingActivities.useQuery();

  const createArtifactMutation = trpc.compliance.createArtifact.useMutation({ onSuccess: () => { refetchArtifacts(); setArtifactOpen(false); toast.success("Artifact added"); } });
  const createByokMutation = trpc.compliance.createByokKey.useMutation({ onSuccess: () => { refetchKeys(); setByokOpen(false); toast.success("BYOK key configured"); } });
  const submitDpdp = trpc.compliance.submitDpdpRequest.useMutation({
    onSuccess: () => { refetchDpdp(); toast.success("DPDP request submitted — 30-day SLA clock started"); },
    onError: () => toast.error("Failed to submit request"),
  });
  const updateDpdp = trpc.compliance.updateDpdpRequest.useMutation({ onSuccess: () => { refetchDpdp(); setSelectedReq(null); toast.success("Request updated"); } });
  const grantConsent = trpc.compliance.grantConsent.useMutation({ onSuccess: () => { refetchConsent(); setConsentOpen(false); toast.success("Consent recorded"); } });
  const revokeConsent = trpc.compliance.revokeConsent.useMutation({ onSuccess: () => { refetchConsent(); toast.success("Consent revoked"); } });
  const createActivity = trpc.compliance.createProcessingActivity.useMutation({ onSuccess: () => { refetchActivities(); setActivityOpen(false); toast.success("Processing activity registered"); } });

  const [artifactOpen, setArtifactOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [artifactForm, setArtifactForm] = useState({ name: "", type: "soc2" as any, version: "" });
  const [byokForm, setByokForm] = useState({ name: "", provider: "vault" as any, keyIdentifier: "" });
  const [consentForm, setConsentForm] = useState({ dataPrincipalId: "", purpose: "", expiresAt: "" });
  const [activityForm, setActivityForm] = useState({ name: "", purpose: "", legalBasis: "consent" as any, riskLevel: "low" as any, dpdpActSection: "", retentionPeriodDays: "" });
  const [expandedSection, setExpandedSection] = useState<string | null>("dpdp-requests");

  const artifactList = (artifacts as any[]) || [];
  const keyList = (byokKeys as any[]) || [];
  const requests = (dpdpReqs as any[]) || [];
  const consents = (consentList as any[]) || [];
  const processingActivities = (activities as any[]) || [];

  const typeLabels: Record<string, string> = { soc2: "SOC 2 Type II", iso27001: "ISO 27001", rbi_cscrf: "RBI CSCRF", dpdp: "DPDP", pentest: "Penetration Test", sub_processor: "Sub-Processor List", sla_report: "SLA Report" };
  const typeColors: Record<string, string> = { soc2: "bg-blue-100 text-blue-700", iso27001: "bg-emerald-100 text-emerald-700", rbi_cscrf: "bg-purple-100 text-purple-700", dpdp: "bg-amber-100 text-amber-700", pentest: "bg-red-100 text-red-700", sub_processor: "bg-gray-100 text-gray-700", sla_report: "bg-teal-100 text-teal-700" };
  const keyStatusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", rotating: "bg-amber-100 text-amber-700", revoked: "bg-red-100 text-red-700" };

  // Certifications are derived from real uploaded artifacts of a certification/attestation nature —
  // never hardcoded. Types that represent an external cert or attestation:
  const CERT_ARTIFACT_TYPES = ["soc2", "iso27001", "rbi_cscrf", "dpdp"];
  const certArtifacts = artifactList.filter((a: any) => CERT_ARTIFACT_TYPES.includes(a.type));

  const overdueCount = requests.filter((r: any) => r.isOverdue).length;
  const pendingCount = requests.filter((r: any) => r.status === "pending" || r.status === "in_progress").length;

  function toggleSection(s: string) {
    setExpandedSection(prev => prev === s ? null : s);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compliance & Security</h1>
        <p className="text-muted-foreground text-sm mt-1">SOC 2, ISO 27001, RBI CSCRF, DPDP Act 2023 compliance management</p>
      </div>

      {/* Summary chips */}
      {(overdueCount > 0 || pendingCount > 0) && (
        <div className="flex gap-3">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-700">{overdueCount} overdue DPDP request{overdueCount > 1 ? "s" : ""}</span>
            </div>
          )}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700">{pendingCount} DPDP request{pendingCount > 1 ? "s" : ""} pending</span>
            </div>
          )}
        </div>
      )}

      {/* Certifications — derived from real uploaded artifacts, never hardcoded */}
      {certArtifacts.length === 0 ? (
        <Card className="border border-dashed border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">No certifications on file</h3>
              <p className="text-xs text-muted-foreground">Upload attestation documents under Compliance Artifacts to display them here.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {certArtifacts.map((cert: any) => (
            <Card key={cert.id} className="border border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{cert.name}</h3>
                      {cert.version && <p className="text-xs text-muted-foreground">v{cert.version}</p>}
                    </div>
                  </div>
                  <Badge variant="secondary" className={typeColors[cert.type] || ""}>{typeLabels[cert.type] || cert.type}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* DPDP Request Tracker */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection("dpdp-requests")}>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            DPDP Request Tracker
            {requests.length > 0 && <Badge variant="secondary" className="ml-1">{requests.length}</Badge>}
          </CardTitle>
          {expandedSection === "dpdp-requests" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        {expandedSection === "dpdp-requests" && (
          <CardContent>
            {requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No DPDP requests submitted yet</p>
            ) : (
              <div className="space-y-2">
                {requests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center gap-3">
                      {r.isOverdue && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                      <div>
                        <p className="text-sm font-medium capitalize">{r.action.replace(/_/g, " ")} — {r.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          Due: {new Date(r.dueDate).toLocaleDateString()}
                          {r.daysRemaining !== null && !r.isOverdue && <span className="ml-2 text-amber-600">{r.daysRemaining}d remaining</span>}
                          {r.isOverdue && <span className="ml-2 text-red-600">Overdue</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedReq(r)}>Update</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Update DPDP Request Dialog */}
      {selectedReq && (
        <Dialog open={!!selectedReq} onOpenChange={() => setSelectedReq(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Update DPDP Request</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm text-muted-foreground">Request: <strong>{selectedReq.action} — {selectedReq.subject}</strong></p>
                <p className="text-xs text-muted-foreground mt-1">Due: {new Date(selectedReq.dueDate).toLocaleDateString()}</p>
              </div>
              <div><Label>Status</Label>
                <Select defaultValue={selectedReq.status} onValueChange={v => setSelectedReq({ ...selectedReq, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Response / Notes</Label>
                <Textarea placeholder="Response to data principal..." defaultValue={selectedReq.response ?? ""} onChange={e => setSelectedReq({ ...selectedReq, response: e.target.value })} rows={3} />
              </div>
              <div><Label>Assigned To</Label>
                <Input placeholder="DPO name or email" defaultValue={selectedReq.assignedTo ?? ""} onChange={e => setSelectedReq({ ...selectedReq, assignedTo: e.target.value })} />
              </div>
              <Button className="w-full" disabled={updateDpdp.isPending} onClick={() => updateDpdp.mutate({ id: selectedReq.id, status: selectedReq.status, response: selectedReq.response, assignedTo: selectedReq.assignedTo })}>
                {updateDpdp.isPending ? "Saving..." : "Save Update"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* DPDP Data Principal Rights Portal */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between cursor-pointer" onClick={() => toggleSection("dpdp-submit")}>
          <CardTitle className="text-base">DPDP Data Principal Rights Portal</CardTitle>
          {expandedSection === "dpdp-submit" ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        {expandedSection === "dpdp-submit" && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DPDP_ACTIONS.map((r) => (
                <div key={r.right} className="p-4 rounded-lg border border-border/40 bg-muted/20">
                  <h4 className="text-sm font-semibold">{r.right}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                  <Button variant="outline" size="sm" className="mt-3" disabled={submitDpdp.isPending}
                    onClick={() => submitDpdp.mutate({ action: r.key, subject: "self" })}>
                    {r.action}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Consent Records */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 cursor-pointer" onClick={() => toggleSection("consent")}>
            <User className="h-4 w-4 text-primary" />
            Consent Records
            {consents.length > 0 && <Badge variant="secondary">{consents.length}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Record Consent</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Consent</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Data Principal ID</Label><Input value={consentForm.dataPrincipalId} onChange={e => setConsentForm({ ...consentForm, dataPrincipalId: e.target.value })} placeholder="Email, user ID, or identifier" /></div>
                  <div><Label>Purpose</Label><Input value={consentForm.purpose} onChange={e => setConsentForm({ ...consentForm, purpose: e.target.value })} placeholder="e.g. Marketing communications" /></div>
                  <div><Label>Expiry Date (optional)</Label><Input type="date" value={consentForm.expiresAt} onChange={e => setConsentForm({ ...consentForm, expiresAt: e.target.value })} /></div>
                  <Button className="w-full" onClick={() => grantConsent.mutate({ dataPrincipalId: consentForm.dataPrincipalId, purpose: consentForm.purpose, expiresAt: consentForm.expiresAt || undefined })} disabled={!consentForm.dataPrincipalId || !consentForm.purpose || grantConsent.isPending}>
                    {grantConsent.isPending ? "Recording..." : "Record Consent"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <button onClick={() => toggleSection("consent")} className="text-muted-foreground">
              {expandedSection === "consent" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        {expandedSection === "consent" && (
          <CardContent>
            {consents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No consent records yet</p>
            ) : (
              <div className="space-y-2">
                {consents.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-medium">{c.purpose}</p>
                      <p className="text-xs text-muted-foreground">{c.dataPrincipalId} · Granted {new Date(c.grantedAt).toLocaleDateString()}{c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                      {c.status === "granted" && (
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => revokeConsent.mutate({ id: c.id })} disabled={revokeConsent.isPending}>Revoke</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Article 19 Processing Register */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 cursor-pointer" onClick={() => toggleSection("processing")}>
            <Database className="h-4 w-4 text-primary" />
            Article 19 Processing Register
            {processingActivities.length > 0 && <Badge variant="secondary">{processingActivities.length}</Badge>}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add Activity</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Register Processing Activity</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Name</Label><Input value={activityForm.name} onChange={e => setActivityForm({ ...activityForm, name: e.target.value })} placeholder="e.g. API Usage Analytics" /></div>
                  <div><Label>Purpose</Label><Textarea value={activityForm.purpose} onChange={e => setActivityForm({ ...activityForm, purpose: e.target.value })} placeholder="Describe the processing purpose" rows={2} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Legal Basis</Label>
                      <Select value={activityForm.legalBasis} onValueChange={v => setActivityForm({ ...activityForm, legalBasis: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consent">Consent</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="legal_obligation">Legal Obligation</SelectItem>
                          <SelectItem value="vital_interests">Vital Interests</SelectItem>
                          <SelectItem value="public_task">Public Task</SelectItem>
                          <SelectItem value="legitimate_interests">Legitimate Interests</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Risk Level</Label>
                      <Select value={activityForm.riskLevel} onValueChange={v => setActivityForm({ ...activityForm, riskLevel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>DPDP Act Section (optional)</Label><Input value={activityForm.dpdpActSection} onChange={e => setActivityForm({ ...activityForm, dpdpActSection: e.target.value })} placeholder="e.g. Section 9" /></div>
                  <div><Label>Retention Period (days)</Label><Input type="number" value={activityForm.retentionPeriodDays} onChange={e => setActivityForm({ ...activityForm, retentionPeriodDays: e.target.value })} placeholder="e.g. 365" /></div>
                  <Button className="w-full" onClick={() => createActivity.mutate({ name: activityForm.name, purpose: activityForm.purpose, legalBasis: activityForm.legalBasis, riskLevel: activityForm.riskLevel, dpdpActSection: activityForm.dpdpActSection || undefined, retentionPeriodDays: activityForm.retentionPeriodDays ? parseInt(activityForm.retentionPeriodDays) : undefined })} disabled={!activityForm.name || !activityForm.purpose || createActivity.isPending}>
                    {createActivity.isPending ? "Registering..." : "Register Activity"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <button onClick={() => toggleSection("processing")} className="text-muted-foreground">
              {expandedSection === "processing" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        {expandedSection === "processing" && (
          <CardContent>
            {processingActivities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No processing activities registered yet</p>
            ) : (
              <div className="space-y-2">
                {processingActivities.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{a.purpose?.slice(0, 80)}{a.purpose?.length > 80 ? "..." : ""}</p>
                      {a.dpdpActSection && <p className="text-xs text-muted-foreground mt-0.5">Section: {a.dpdpActSection}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={RISK_COLORS[a.riskLevel] || ""}>{a.riskLevel}</Badge>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">{a.legalBasis?.replace(/_/g, " ")}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Compliance Artifacts */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 cursor-pointer" onClick={() => toggleSection("artifacts")}>
            <Shield className="h-4 w-4 text-primary" />
            Compliance Artifacts
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={artifactOpen} onOpenChange={setArtifactOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 mr-1" />Add Artifact</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Compliance Artifact</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Name</Label><Input value={artifactForm.name} onChange={e => setArtifactForm({ ...artifactForm, name: e.target.value })} placeholder="e.g. SOC 2 Type II Report 2026" /></div>
                  <div><Label>Type</Label>
                    <Select value={artifactForm.type} onValueChange={v => setArtifactForm({ ...artifactForm, type: v })}>
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
                  <div><Label>Version</Label><Input value={artifactForm.version} onChange={e => setArtifactForm({ ...artifactForm, version: e.target.value })} placeholder="e.g. v2.1" /></div>
                  <Button className="w-full" onClick={() => createArtifactMutation.mutate({ ...artifactForm })} disabled={!artifactForm.name || createArtifactMutation.isPending}>
                    {createArtifactMutation.isPending ? "Adding..." : "Add Artifact"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <button onClick={() => toggleSection("artifacts")} className="text-muted-foreground">
              {expandedSection === "artifacts" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        {expandedSection === "artifacts" && (
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
                      {(a.fileUrl || a.url) ? (
                        <Button size="sm" variant="ghost" title="Download" onClick={() => window.open(a.fileUrl || a.url, "_blank")}><Download className="h-3 w-3" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" disabled title="No file attached"><Download className="h-3 w-3 opacity-40" /></Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* BYOK Keys */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 cursor-pointer" onClick={() => toggleSection("byok")}>
            <Key className="h-4 w-4 text-primary" />BYOK Key Management
          </CardTitle>
          <div className="flex items-center gap-2">
            <Dialog open={byokOpen} onOpenChange={setByokOpen}>
              <DialogTrigger asChild><Button size="sm" variant="outline"><Key className="h-3 w-3 mr-1" />Configure Key</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Configure BYOK Key</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Key Name</Label><Input value={byokForm.name} onChange={e => setByokForm({ ...byokForm, name: e.target.value })} placeholder="e.g. Production Encryption Key" /></div>
                  <div><Label>Provider</Label>
                    <Select value={byokForm.provider} onValueChange={v => setByokForm({ ...byokForm, provider: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vault">HashiCorp Vault</SelectItem>
                        <SelectItem value="aws_kms">AWS KMS</SelectItem>
                        <SelectItem value="azure_keyvault">Azure Key Vault</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Key Identifier / ARN</Label><Input value={byokForm.keyIdentifier} onChange={e => setByokForm({ ...byokForm, keyIdentifier: e.target.value })} placeholder="arn:aws:kms:... or vault/path/key" /></div>
                  <Button className="w-full" onClick={() => createByokMutation.mutate({ ...byokForm })} disabled={!byokForm.name || !byokForm.keyIdentifier || createByokMutation.isPending}>
                    {createByokMutation.isPending ? "Configuring..." : "Configure Key"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <button onClick={() => toggleSection("byok")} className="text-muted-foreground">
              {expandedSection === "byok" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>
        </CardHeader>
        {expandedSection === "byok" && (
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
        )}
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
