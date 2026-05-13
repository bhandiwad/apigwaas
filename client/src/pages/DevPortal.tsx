import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Globe, Plus, Palette, Users, BookOpen, ExternalLink } from "lucide-react";

export default function DevPortal() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [description, setDescription] = useState("");
  const [enableSignup, setEnableSignup] = useState(true);
  const [enableAutoApprove, setEnableAutoApprove] = useState(false);

  const { data: tenants } = trpc.tenant.list.useQuery();
  const { data: portals, refetch } = trpc.devPortal.list.useQuery({});
  const createPortal = trpc.devPortal.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("Portal created"); },
  });
  const updatePortal = trpc.devPortal.update.useMutation({
    onSuccess: () => { refetch(); toast.success("Portal updated"); },
  });

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "bg-green-100 text-green-700";
      case "draft": return "bg-yellow-100 text-yellow-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Developer Portal</h1>
          <p className="text-muted-foreground">Manage API developer portals for your tenants</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Create Portal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Developer Portal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Portal Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="My API Portal" /></div>
              <div><Label>Custom Domain (optional)</Label><Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="developers.example.com" /></div>
              <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Portal description..." /></div>
              <div className="flex items-center justify-between">
                <Label>Allow Self-Signup</Label>
                <Switch checked={enableSignup} onCheckedChange={setEnableSignup} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-Approve Applications</Label>
                <Switch checked={enableAutoApprove} onCheckedChange={setEnableAutoApprove} />
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || createPortal.isPending}
                onClick={() => createPortal.mutate({ tenantId: tenants?.[0]?.id || 1, name, customDomain: customDomain || undefined, description, enableSignup, enableAutoApprove })}>
                {createPortal.isPending ? "Creating..." : "Create Portal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Portal Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {portals?.map((portal: any) => (
          <Card key={portal.id} className="border-l-4 border-l-amber-400">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Globe className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{portal.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{portal.customDomain || "No custom domain"}</p>
                  </div>
                </div>
                <Badge className={statusColor(portal.status)}>{portal.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="config">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="theme">Theme</TabsTrigger>
                  <TabsTrigger value="apis">Published APIs</TabsTrigger>
                </TabsList>
                <TabsContent value="config" className="space-y-3 pt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span>Self-Signup: <strong>{portal.enableSignup ? "Enabled" : "Disabled"}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                      <span>Auto-Approve: <strong>{portal.enableAutoApprove ? "Yes" : "No"}</strong></span>
                    </div>
                  </div>
                  {portal.description && <p className="text-sm text-muted-foreground">{portal.description}</p>}
                  <div className="flex gap-2 pt-2">
                    {portal.status === "draft" && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updatePortal.mutate({ id: portal.id, status: "active" })}>
                        Publish Portal
                      </Button>
                    )}
                    {portal.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => toast.info("Portal URL: https://" + (portal.customDomain || `portal-${portal.id}.cloudinfinit.io`))}>
                        <ExternalLink className="w-3 h-3 mr-1" />Visit Portal
                      </Button>
                    )}
                    {portal.status === "active" && (
                      <Button size="sm" variant="outline" onClick={() => updatePortal.mutate({ id: portal.id, status: "disabled" })}>
                        Disable
                      </Button>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="theme" className="pt-3">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Palette className="w-4 h-4 text-muted-foreground" />
                      <span>Theme: {(portal.theme as any)?.primaryColor ? "Custom" : "Default (Sify Gold)"}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="h-8 rounded bg-amber-500" title="Primary" />
                      <div className="h-8 rounded bg-gray-900" title="Dark" />
                      <div className="h-8 rounded bg-white border" title="Light" />
                      <div className="h-8 rounded bg-green-500" title="Accent" />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => toast.info("Theme editor coming soon")}>
                      <Palette className="w-3 h-3 mr-1" />Customize Theme
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="apis" className="pt-3">
                  <div className="text-sm text-muted-foreground">
                    {(portal.publishedApis as any[])?.length || 0} APIs published to this portal
                  </div>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => toast.info("API publishing coming soon")}>
                    Manage Published APIs
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ))}
      </div>

      {(!portals || portals.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Developer Portals</h3>
            <p className="text-muted-foreground text-sm mb-4">Create a developer portal to let consumers discover and subscribe to your APIs</p>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Create Portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
