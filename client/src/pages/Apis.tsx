import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Plus, Search, Upload, FileJson } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ApisPage() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const defaultTenantId = (tenants as any)?.[0]?.id || 1;
  const { data: workspaces } = trpc.workspace.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const { data: apis, isLoading, refetch } = trpc.api.list.useQuery({ tenantId: defaultTenantId }, { enabled: !!defaultTenantId });
  const createMutation = trpc.api.create.useMutation({ onSuccess: () => { refetch(); setOpen(false); toast.success("API created"); } });
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", version: "1.0.0", protocol: "rest" as const, backendUrl: "", contextPath: "", description: "", workspaceId: "" });
  const [importSpec, setImportSpec] = useState("");

  const workspaceList = (workspaces as any[]) || [];
  const filtered = (apis as any[] || []).filter((a: any) => a.name.toLowerCase().includes(search.toLowerCase()));
  const statusColors: Record<string, string> = { draft: "bg-gray-100 text-gray-700", published: "bg-emerald-100 text-emerald-700", deprecated: "bg-amber-100 text-amber-700", retired: "bg-red-100 text-red-700" };
  const protocolColors: Record<string, string> = { rest: "bg-blue-100 text-blue-700", graphql: "bg-pink-100 text-pink-700", grpc: "bg-purple-100 text-purple-700", websocket: "bg-orange-100 text-orange-700", kafka: "bg-teal-100 text-teal-700", mqtt: "bg-cyan-100 text-cyan-700" };

  const handleImportOpenAPI = () => {
    try {
      const spec = JSON.parse(importSpec);
      const info = spec.info || {};
      const name = info.title || "Imported API";
      const version = info.version || "1.0.0";
      const description = info.description || "";
      const servers = spec.servers || [];
      const backendUrl = servers[0]?.url || "";
      const wsId = workspaceList[0]?.id;
      if (!wsId) { toast.error("Create a workspace first"); return; }
      createMutation.mutate({
        tenantId: defaultTenantId,
        workspaceId: wsId,
        name,
        version,
        protocol: "rest",
        backendUrl,
        description,
        openApiSpec: spec,
      }, {
        onSuccess: () => { setImportOpen(false); setImportSpec(""); toast.success(`Imported "${name}" from OpenAPI spec`); }
      });
    } catch {
      toast.error("Invalid JSON. Please paste a valid OpenAPI 3.x specification.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">APIs</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, publish, and manage API endpoints</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="h-4 w-4 mr-2" />Import OpenAPI</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><FileJson className="h-5 w-5 text-primary" />Import OpenAPI Specification</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">Paste your OpenAPI 3.x JSON specification below. The API name, version, description, and backend URL will be extracted automatically.</p>
                <Textarea
                  value={importSpec}
                  onChange={e => setImportSpec(e.target.value)}
                  placeholder='{"openapi": "3.0.0", "info": {"title": "My API", "version": "1.0.0"}, "servers": [{"url": "https://api.example.com"}], "paths": {...}}'
                  rows={12}
                  className="font-mono text-xs"
                />
                <Button className="w-full" onClick={handleImportOpenAPI} disabled={!importSpec.trim() || createMutation.isPending}>
                  {createMutation.isPending ? "Importing..." : "Import & Create API"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground"><Plus className="h-4 w-4 mr-2" />Create API</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Create New API</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>API Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Payment Service API" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Version</Label><Input value={form.version} onChange={e => setForm({...form, version: e.target.value})} /></div>
                  <div><Label>Protocol</Label>
                    <Select value={form.protocol} onValueChange={v => setForm({...form, protocol: v as any})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rest">REST</SelectItem>
                        <SelectItem value="graphql">GraphQL</SelectItem>
                        <SelectItem value="grpc">gRPC</SelectItem>
                        <SelectItem value="websocket">WebSocket</SelectItem>
                        <SelectItem value="kafka">Kafka</SelectItem>
                        <SelectItem value="mqtt">MQTT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {workspaceList.length > 0 && (
                  <div><Label>Workspace</Label>
                    <Select value={form.workspaceId} onValueChange={v => setForm({...form, workspaceId: v})}>
                      <SelectTrigger><SelectValue placeholder="Select workspace" /></SelectTrigger>
                      <SelectContent>
                        {workspaceList.map((ws: any) => (
                          <SelectItem key={ws.id} value={String(ws.id)}>{ws.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div><Label>Backend URL</Label><Input value={form.backendUrl} onChange={e => setForm({...form, backendUrl: e.target.value})} placeholder="https://api.internal.svc/v1" /></div>
                <div><Label>Context Path</Label><Input value={form.contextPath} onChange={e => setForm({...form, contextPath: e.target.value})} placeholder="/api/v1/payments" /></div>
                <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} /></div>
                <Button className="w-full" onClick={() => {
                  const wsId = form.workspaceId ? parseInt(form.workspaceId) : workspaceList[0]?.id || 1;
                  createMutation.mutate({ tenantId: defaultTenantId, workspaceId: wsId, name: form.name, version: form.version, protocol: form.protocol, backendUrl: form.backendUrl, contextPath: form.contextPath, description: form.description });
                }} disabled={!form.name || createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create API"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search APIs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-12 text-center"><Globe className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" /><p className="text-muted-foreground">No APIs found. Create your first API or import an OpenAPI spec.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((api: any) => (
            <Card key={api.id} className="border border-border/60 hover:shadow-sm transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Globe className="h-5 w-5 text-primary" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{api.name}</h3>
                      <span className="text-xs text-muted-foreground">v{api.version}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{api.contextPath || api.backendUrl || "No endpoint configured"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className={protocolColors[api.protocol] || ""}>{api.protocol.toUpperCase()}</Badge>
                  <Badge variant="secondary" className={statusColors[api.status] || ""}>{api.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
