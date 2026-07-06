import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ApiDesignTab } from "@/components/ApiDesignTab";
import { ApiPlansTab } from "@/components/ApiPlansTab";
import { ApiTestTab } from "@/components/ApiTestTab";
import { ApiDeploymentsTab } from "@/components/ApiDeploymentsTab";
import { ApiPortalTab } from "@/components/ApiPortalTab";
import { ArrowLeft, Globe, Shield, Activity, Code, Server, Clock, Plus, Pencil } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ApiDetailPage() {
  const params = useParams<{ id: string }>();
  const apiId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", backendUrl: "", contextPath: "", version: "" });
  const [confirm, setConfirm] = useState<"publish" | "deprecate" | "retire" | null>(null);
  const [retireText, setRetireText] = useState("");
  const justCreated = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("created") === "1";
  const [showCreated, setShowCreated] = useState(justCreated);

  const { data: api, isLoading } = trpc.api.getById.useQuery({ id: apiId }, { enabled: apiId > 0 });

  const updateApi = trpc.api.update.useMutation({
    onSuccess: (_, vars) => {
      utils.api.getById.invalidate({ id: apiId });
      toast.success(vars.status === "published" ? "API published" : vars.status === "deprecated" ? "API deprecated" : vars.status === "retired" ? "API retired" : "API updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", published: "bg-emerald-100 text-emerald-700", deprecated: "bg-amber-100 text-amber-700", retired: "bg-red-100 text-red-700" };
  const protocolColors: Record<string, string> = { rest: "bg-blue-100 text-blue-700", graphql: "bg-pink-100 text-pink-700", grpc: "bg-purple-100 text-purple-700", websocket: "bg-orange-100 text-orange-700" };

  if (isLoading) {
    return <div className="space-y-6"><div className="h-10 w-40 bg-muted animate-pulse rounded" /></div>;
  }

  if (!api) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/apis")} className="gap-2"><ArrowLeft className="h-4 w-4" />Back to APIs</Button>
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">API not found.</p></CardContent></Card>
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
            <Badge variant="secondary" className={protocolColors[api.protocol] || ""}>{api.protocol?.toUpperCase()}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">{api.description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          {api.status !== "retired" && (
            <Dialog open={editOpen} onOpenChange={(o) => {
              setEditOpen(o);
              if (o) setEditForm({ name: api.name || "", description: api.description || "", backendUrl: api.backendUrl || "", contextPath: api.contextPath || "", version: api.version || "" });
            }}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline"><Pencil className="h-3 w-3 mr-1" />Edit</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Edit API</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>API Name</Label><Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Version</Label><Input value={editForm.version} onChange={e => setEditForm({...editForm, version: e.target.value})} /></div>
                  </div>
                  <div><Label>Backend URL</Label><Input value={editForm.backendUrl} onChange={e => setEditForm({...editForm, backendUrl: e.target.value})} placeholder="https://api.internal.svc/v1" /></div>
                  <div><Label>Context Path</Label><Input value={editForm.contextPath} onChange={e => setEditForm({...editForm, contextPath: e.target.value})} placeholder="/api/v1" /></div>
                  <div><Label>Description</Label><Textarea value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} rows={2} /></div>
                  <Button className="w-full" disabled={!editForm.name || updateApi.isPending} onClick={() => {
                    updateApi.mutate({ id: apiId, name: editForm.name, description: editForm.description, backendUrl: editForm.backendUrl, contextPath: editForm.contextPath, version: editForm.version }, {
                      onSuccess: () => setEditOpen(false),
                    });
                  }}>
                    {updateApi.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {api.status === "draft" && (
            <Button size="sm" disabled={updateApi.isPending} onClick={() => setConfirm("publish")}>Publish</Button>
          )}
          {api.status === "published" && (
            <Button size="sm" variant="outline" disabled={updateApi.isPending} onClick={() => setConfirm("deprecate")}>Deprecate</Button>
          )}
          {api.status === "deprecated" && (
            <Button size="sm" variant="outline" disabled={updateApi.isPending} onClick={() => setConfirm("publish")}>Re-publish</Button>
          )}
          {(api.status === "published" || api.status === "deprecated") && (
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={updateApi.isPending} onClick={() => { setRetireText(""); setConfirm("retire"); }}>Retire</Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={o => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "publish" ? "Publish API" : confirm === "deprecate" ? "Deprecate API" : "Retire API"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "publish" && "This deploys the API to the gateway and makes it callable by consumers."}
              {confirm === "deprecate" && "Consumers will be warned this API is deprecated. It stays callable until retired."}
              {confirm === "retire" && <>This takes <span className="font-medium">{api.name}</span> out of active use. Type its name to confirm.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === "retire" && (
            <Input value={retireText} onChange={e => setRetireText(e.target.value)} placeholder={api.name} className="font-mono" autoFocus />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateApi.isPending || (confirm === "retire" && retireText !== api.name)}
              onClick={() => {
                const status = confirm === "publish" ? "published" as const : confirm === "deprecate" ? "deprecated" as const : "retired" as const;
                updateApi.mutate({ id: apiId, status });
                setConfirm(null);
              }}>
              {confirm === "publish" ? "Publish" : confirm === "deprecate" ? "Deprecate" : "Retire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showCreated && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:bg-emerald-950/30 dark:border-emerald-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-medium text-emerald-800 dark:text-emerald-300">API created 🎉</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-0.5">
                Gateway URL:{" "}
                <code className="font-mono">{`http://localhost:8082${api.contextPath || ""}`}</code>
              </p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 mt-1">Next: attach policies, test it, then publish.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowCreated(false)}>Dismiss</Button>
          </div>
        </div>
      )}

      <Tabs defaultValue={(typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab")) || "overview"}>
        <div className="overflow-x-auto max-w-full">
          <TabsList className="justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="design">Design</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="test">Test</TabsTrigger>
            <TabsTrigger value="deployments">Deployments</TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
            <TabsTrigger value="spec">Specification</TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="design">
          <ApiDesignTab apiId={apiId} api={api} onSaved={() => utils.api.getById.invalidate({ id: apiId })} />
        </TabsContent>

        <TabsContent value="plans">
          <ApiPlansTab apiId={apiId} />
        </TabsContent>

        <TabsContent value="test">
          <ApiTestTab apiId={apiId} api={api} />
        </TabsContent>

        <TabsContent value="deployments">
          <ApiDeploymentsTab apiId={apiId} />
        </TabsContent>

        <TabsContent value="portal">
          <ApiPortalTab apiId={apiId} api={api} />
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
