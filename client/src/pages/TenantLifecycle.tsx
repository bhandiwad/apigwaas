import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, PlayCircle, PauseCircle, XCircle, Download, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function TenantLifecyclePage() {
  const { data: tenants, refetch } = trpc.tenant.list.useQuery();
  const updateMutation = trpc.tenant.update.useMutation({ onSuccess: () => { refetch(); toast.success("Tenant status updated"); } });

  const tenantList = (tenants as any[]) || [];
  const statusColors: Record<string, string> = { active: "bg-emerald-100 text-emerald-700", provisioning: "bg-blue-100 text-blue-700", suspended: "bg-amber-100 text-amber-700", offboarding: "bg-red-100 text-red-700", terminated: "bg-gray-200 text-gray-500" };

  const lifecycleSteps = [
    { label: "Registration", desc: "Corporate email signup with KYC/KYB verification" },
    { label: "Provisioning", desc: "Workspace creation, resource allocation, DNS setup" },
    { label: "Active", desc: "Full platform access, API management, billing active" },
    { label: "Suspension", desc: "Temporary access restriction due to payment or policy" },
    { label: "Offboarding", desc: "Data export, resource cleanup, final invoice" },
    { label: "Terminated", desc: "All data purged after retention period" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tenant Lifecycle</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage provisioning, suspension, offboarding, and data export workflows</p>
      </div>

      {/* Lifecycle Flow */}
      <Card className="border border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Lifecycle Stages</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {lifecycleSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-2 shrink-0">
                <div className="flex flex-col items-center">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                  <p className="text-xs font-medium mt-1">{step.label}</p>
                  <p className="text-[10px] text-muted-foreground max-w-24 text-center">{step.desc}</p>
                </div>
                {i < lifecycleSteps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Tenants</TabsTrigger>
          <TabsTrigger value="provisioning">Provisioning</TabsTrigger>
          <TabsTrigger value="suspended">Suspended</TabsTrigger>
          <TabsTrigger value="offboarding">Offboarding</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {tenantList.length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-12 text-center"><Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No tenants</p></CardContent></Card>
          ) : (
            tenantList.map((t: any) => (
              <Card key={t.id} className="border border-border/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
                    <div>
                      <h3 className="font-semibold text-sm">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.tier} · {t.region} · Created {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={statusColors[t.status] || ""}>{t.status}</Badge>
                    <div className="flex gap-1">
                      {t.status === "provisioning" && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: t.id, status: "active" })} title="Activate">
                          <PlayCircle className="h-4 w-4 text-emerald-600" />
                        </Button>
                      )}
                      {t.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: t.id, status: "suspended" })} title="Suspend">
                          <PauseCircle className="h-4 w-4 text-amber-600" />
                        </Button>
                      )}
                      {t.status === "suspended" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: t.id, status: "active" })} title="Reactivate">
                            <PlayCircle className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: t.id, status: "offboarding" })} title="Offboard">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </Button>
                        </>
                      )}
                      {t.status === "offboarding" && (
                        <Button size="sm" variant="outline" onClick={() => toast.info("Data export bundle download coming soon")} title="Download Data">
                          <Download className="h-4 w-4 text-blue-600" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="provisioning" className="space-y-3 mt-4">
          {tenantList.filter((t: any) => t.status === "provisioning").length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">No tenants in provisioning state</CardContent></Card>
          ) : (
            tenantList.filter((t: any) => t.status === "provisioning").map((t: any) => (
              <Card key={t.id} className="border border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t.name}</h3>
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: t.id, status: "active" })}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />Complete Provisioning
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {["Workspace Created", "DNS Configured", "Resources Allocated", "Billing Active"].map((step, i) => (
                      <div key={step} className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="suspended" className="space-y-3 mt-4">
          {tenantList.filter((t: any) => t.status === "suspended").length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">No suspended tenants</CardContent></Card>
          ) : (
            tenantList.filter((t: any) => t.status === "suspended").map((t: any) => (
              <Card key={t.id} className="border border-border/60">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">Suspended — awaiting resolution</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: t.id, status: "active" })}>Reactivate</Button>
                    <Button size="sm" variant="destructive" onClick={() => updateMutation.mutate({ id: t.id, status: "offboarding" })}>Begin Offboarding</Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="offboarding" className="space-y-3 mt-4">
          {tenantList.filter((t: any) => t.status === "offboarding").length === 0 ? (
            <Card className="border-dashed"><CardContent className="p-8 text-center text-muted-foreground">No tenants in offboarding</CardContent></Card>
          ) : (
            tenantList.filter((t: any) => t.status === "offboarding").map((t: any) => (
              <Card key={t.id} className="border border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t.name}</h3>
                    <Button size="sm" variant="outline" onClick={() => toast.info("Data export bundle download coming soon")}>
                      <Download className="h-4 w-4 mr-1" />Export Data Bundle
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Final Invoice Generated", "Data Export Ready", "Resources Scheduled for Cleanup"].map((step) => (
                      <div key={step} className="flex items-center gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3 text-amber-500" />
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
