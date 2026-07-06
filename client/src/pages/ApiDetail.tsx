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
import { ArrowLeft, Globe, Shield, Activity, Code, Server, Clock, Plus, Pencil } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function ApiDetailPage() {
  const params = useParams<{ id: string }>();
  const apiId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [attachOpen, setAttachOpen] = useState(false);
  const [selectedPolicyId, setSelectedPolicyId] = useState("");
  const [selectedPhase, setSelectedPhase] = useState<"request" | "response" | "connect">("request");
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", description: "", backendUrl: "", contextPath: "", version: "" });
  const [confirm, setConfirm] = useState<"publish" | "deprecate" | "retire" | null>(null);
  const [retireText, setRetireText] = useState("");

  const { data: api, isLoading } = trpc.api.getById.useQuery({ id: apiId }, { enabled: apiId > 0 });
  const { data: policies } = trpc.policy.list.useQuery({});
  const { data: chains, refetch: refetchChains } = trpc.policyChain.list.useQuery({ apiId }, { enabled: apiId > 0 });

  const updateApi = trpc.api.update.useMutation({
    onSuccess: (_, vars) => {
      utils.api.getById.invalidate({ id: apiId });
      toast.success(vars.status === "published" ? "API published" : vars.status === "deprecated" ? "API deprecated" : vars.status === "retired" ? "API retired" : "API updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const attachPolicy = trpc.policyChain.add.useMutation({
    onSuccess: () => {
      refetchChains();
      setAttachOpen(false);
      setSelectedPolicyId("");
      toast.success("Policy attached");
    },
  });

  const policyList = (policies as any[]) || [];
  const chainList = (chains as any[]) || [];

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
            <h1 className="text-2xl font-bold tracking-tight">{(api as any).name}</h1>
            <Badge variant="secondary" className={statusColors[(api as any).status] || ""}>{(api as any).status}</Badge>
            <Badge variant="secondary" className={protocolColors[(api as any).protocol] || ""}>{(api as any).protocol?.toUpperCase()}</Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">{(api as any).description || "No description"}</p>
        </div>
        <div className="flex gap-2">
          {(api as any).status !== "retired" && (
            <Dialog open={editOpen} onOpenChange={(o) => {
              setEditOpen(o);
              if (o) setEditForm({ name: (api as any).name || "", description: (api as any).description || "", backendUrl: (api as any).backendUrl || "", contextPath: (api as any).contextPath || "", version: (api as any).version || "" });
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
          {(api as any).status === "draft" && (
            <Button size="sm" disabled={updateApi.isPending} onClick={() => setConfirm("publish")}>Publish</Button>
          )}
          {(api as any).status === "published" && (
            <Button size="sm" variant="outline" disabled={updateApi.isPending} onClick={() => setConfirm("deprecate")}>Deprecate</Button>
          )}
          {(api as any).status === "deprecated" && (
            <Button size="sm" variant="outline" disabled={updateApi.isPending} onClick={() => setConfirm("publish")}>Re-publish</Button>
          )}
          {((api as any).status === "published" || (api as any).status === "deprecated") && (
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
              {confirm === "retire" && <>This takes <span className="font-medium">{(api as any).name}</span> out of active use. Type its name to confirm.</>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirm === "retire" && (
            <Input value={retireText} onChange={e => setRetireText(e.target.value)} placeholder={(api as any).name} className="font-mono" autoFocus />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={updateApi.isPending || (confirm === "retire" && retireText !== (api as any).name)}
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

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="policies">Policies ({chainList.length})</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="spec">Specification</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Server className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Backend</span></div>
                <p className="text-xs text-muted-foreground break-all">{(api as any).backendUrl || "Not configured"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Code className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Context Path</span></div>
                <p className="text-xs text-muted-foreground font-mono">{(api as any).contextPath || "/"}</p>
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Version</span></div>
                <p className="text-xs text-muted-foreground">v{(api as any).version}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border border-border/60">
            <CardHeader className="pb-3"><CardTitle className="text-base">API Details</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Protocol:</span> <span className="font-medium">{(api as any).protocol}</span></div>
                <div><span className="text-muted-foreground">Status:</span> <span className="font-medium">{(api as any).status}</span></div>
                <div><span className="text-muted-foreground">Workspace ID:</span> <span className="font-medium">{(api as any).workspaceId}</span></div>
                <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{(api as any).createdAt ? new Date((api as any).createdAt).toLocaleDateString() : "N/A"}</span></div>
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
                    <span className="text-sm font-medium">v{(api as any).version}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{(api as any).createdAt ? new Date((api as any).createdAt).toLocaleDateString() : ""}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-4">Version history is tracked automatically when APIs are updated.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="space-y-4 mt-4">
          <Card className="border border-border/60">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Policy Chain</CardTitle>
              <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={policyList.length === 0}><Plus className="h-3 w-3 mr-1" />Attach Policy</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Attach Policy to API</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Policy</Label>
                      <Select value={selectedPolicyId} onValueChange={setSelectedPolicyId}>
                        <SelectTrigger><SelectValue placeholder="Select a policy" /></SelectTrigger>
                        <SelectContent>
                          {policyList.map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.type})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Phase</Label>
                      <Select value={selectedPhase} onValueChange={v => setSelectedPhase(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="request">Request</SelectItem>
                          <SelectItem value="response">Response</SelectItem>
                          <SelectItem value="connect">Connect</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button className="w-full" disabled={!selectedPolicyId || attachPolicy.isPending}
                      onClick={() => attachPolicy.mutate({ apiId, policyId: parseInt(selectedPolicyId), phase: selectedPhase, order: chainList.length + 1 })}>
                      {attachPolicy.isPending ? "Attaching..." : "Attach Policy"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {chainList.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No policies attached to this API</p>
                  {policyList.length === 0 && <p className="text-xs text-muted-foreground mt-1">Create a policy first from the Policies page.</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {chainList.map((chain: any, idx: number) => (
                    <div key={chain.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{idx + 1}.</span>
                        <Shield className="h-4 w-4 text-primary" />
                        <div>
                          <span className="text-sm font-medium">{chain.policyName || (chain.policyId ? `Policy #${chain.policyId}` : "Unknown")}</span>
                          <p className="text-xs text-muted-foreground">{chain.policyType ? `${chain.policyType} · ` : ""}{chain.phase} phase</p>
                        </div>
                      </div>
                      <Badge variant="secondary">{chain.syncSource || "local"}</Badge>
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
                {(api as any).status === "published" ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/40">
                    <div className="flex items-center gap-3">
                      <Activity className="h-4 w-4 text-emerald-500" />
                      <div>
                        <p className="text-sm font-medium">Production Deployment</p>
                        <p className="text-xs text-muted-foreground">All regions · v{(api as any).version}</p>
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
              {(api as any).openApiSpec ? (
                <pre className="bg-muted/50 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96">
                  {JSON.stringify((api as any).openApiSpec, null, 2)}
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
