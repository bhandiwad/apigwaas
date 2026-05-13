import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Globe, Shield, Activity, Code, Server, Clock } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ApiDetailPage() {
  const params = useParams<{ id: string }>();
  const apiId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: apis } = trpc.api.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: policies } = trpc.policy.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });

  const api = (apis as any[])?.find((a: any) => a.id === apiId);
  const policyList = (policies as any[]) || [];

  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", published: "bg-emerald-100 text-emerald-700", deprecated: "bg-amber-100 text-amber-700", retired: "bg-red-100 text-red-700" };
  const protocolColors: Record<string, string> = { rest: "bg-blue-100 text-blue-700", graphql: "bg-pink-100 text-pink-700", grpc: "bg-purple-100 text-purple-700", websocket: "bg-orange-100 text-orange-700" };

  if (!api) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/apis")} className="gap-2"><ArrowLeft className="h-4 w-4" />Back to APIs</Button>
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">API not found or still loading...</p></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/apis")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{api.name}</h1>
            <Badge variant="secondary" className={statusColors[api.status] || ""}>{api.status}</Badge>
            <Badge variant="secondary" className={protocolColors[api.protocol] || ""}>{api.protocol.toUpperCase()}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">{api.description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          {api.status === "draft" && <Button size="sm" onClick={() => toast.info("Publish flow coming soon")}>Publish</Button>}
          {api.status === "published" && <Button size="sm" variant="outline" onClick={() => toast.info("Deprecation flow coming soon")}>Deprecate</Button>}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="policies">Policies</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="spec">Specification</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Server className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Backend</span></div>
                <p className="text-xs text-muted-foreground break-all">{api.backendUrl || "Not configured"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Code className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Context Path</span></div>
                <p className="text-xs text-muted-foreground font-mono">{api.contextPath || "/"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Version</span></div>
                <p className="text-xs text-muted-foreground">v{api.version}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">API Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Protocol:</span> <span className="font-medium">{api.protocol}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{api.status}</span></div>
                <div><span className="text-muted-foreground">Workspace ID:</span> <span className="font-medium">{api.workspaceId}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{api.createdAt ? new Date(api.createdAt).toLocaleDateString() : "N/A"}</span></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Version History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Current</Badge>
                    <span className="text-sm font-medium">v{api.version}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{api.createdAt ? new Date(api.createdAt).toLocaleDateString() : ""}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Version history is tracked automatically when APIs are updated.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Attached Policies</CardTitle>
              <Button size="sm" variant="outline" onClick={() => toast.info("Policy attachment coming soon")}><Shield className="h-3 w-3 mr-1" />Attach Policy</Button>
            </CardHeader>
            <CardContent>
              {policyList.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No policies attached to this API</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {policyList.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <Badge variant="secondary">{p.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">Deployment History</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {api.status === "published" ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium">Production Deployment</p>
                        <p className="text-xs text-muted-foreground">All regions · v{api.version}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">Active</Badge>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Activity className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No deployments yet. Publish the API to deploy.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spec" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">OpenAPI Specification</CardTitle></CardHeader>
            <CardContent>
              {api.openApiSpec ? (
                <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96">
                  {JSON.stringify(api.openApiSpec, null, 2)}
                </pre>
              ) : (
                <div className="text-center py-6">
                  <Code className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No OpenAPI specification attached. Import one from the APIs page.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
