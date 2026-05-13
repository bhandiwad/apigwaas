import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Globe, Plus, MapPin, ShieldCheck, ShieldX } from "lucide-react";

export default function GeoIpFiltering() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"allow" | "deny">("deny");
  const [countries, setCountries] = useState("");
  const [xffHandling, setXffHandling] = useState<"trust_first" | "trust_last" | "ignore">("trust_first");
  const [maxmindDbPath, setMaxmindDbPath] = useState("/opt/gravitee/geoip/GeoLite2-Country.mmdb");

  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: policies, refetch } = trpc.policy.list.useQuery({ tenantId });
  const geoIpPolicies = policies?.filter((p: any) => p.type === "geoip") || [];
  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("GeoIP policy created"); resetForm(); },
  });

  function resetForm() { setName(""); setMode("deny"); setCountries(""); setXffHandling("trust_first"); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GeoIP Filtering (F-08)</h1>
          <p className="text-muted-foreground">Allow/deny API access based on geographic location using MaxMind GeoIP database</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-amber-500 hover:bg-amber-600 text-white"><Plus className="w-4 h-4 mr-2" />Add GeoIP Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create GeoIP Filtering Policy</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Policy Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Block non-India traffic" /></div>
              <div><Label>Mode</Label>
                <Select value={mode} onValueChange={v => setMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow List (only these countries)</SelectItem>
                    <SelectItem value="deny">Deny List (block these countries)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Countries (ISO 3166-1 alpha-2, comma-separated)</Label>
                <Input value={countries} onChange={e => setCountries(e.target.value)} placeholder="IN, US, GB, SG" className="font-mono" />
                <p className="text-xs text-muted-foreground mt-1">Use standard 2-letter country codes</p>
              </div>
              <div><Label>X-Forwarded-For Handling</Label>
                <Select value={xffHandling} onValueChange={v => setXffHandling(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trust_first">Trust First IP (leftmost)</SelectItem>
                    <SelectItem value="trust_last">Trust Last IP (rightmost before proxy)</SelectItem>
                    <SelectItem value="ignore">Ignore XFF (use direct connection IP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>MaxMind Database Path</Label><Input value={maxmindDbPath} onChange={e => setMaxmindDbPath(e.target.value)} className="font-mono text-sm" /></div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={!name || !countries || createPolicy.isPending}
                onClick={() => createPolicy.mutate({ tenantId, name, type: "geoip", configuration: { mode, countries: countries.split(",").map(c => c.trim()), xffHandling, maxmindDbPath } })}>
                {createPolicy.isPending ? "Creating..." : "Create GeoIP Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* MaxMind Config Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">MaxMind GeoLite2 Integration</p>
              <p className="text-sm text-blue-700 mt-1">GeoIP filtering uses the MaxMind GeoLite2-Country database for IP-to-country resolution. Ensure the database file is mounted at the configured path on all gateway nodes. Auto-update via <code className="bg-blue-100 px-1 rounded">geoipupdate</code> cron job is recommended.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active GeoIP Policies */}
      <Card>
        <CardHeader><CardTitle>Active GeoIP Policies</CardTitle></CardHeader>
        <CardContent>
          {geoIpPolicies.length > 0 ? (
            <div className="space-y-3">
              {geoIpPolicies.map((policy: any) => {
                const config = policy.configuration as any;
                return (
                  <div key={policy.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {config?.mode === "allow" ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <ShieldX className="w-5 h-5 text-red-600" />}
                      <div>
                        <div className="font-medium">{policy.name}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className={config?.mode === "allow" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                            {config?.mode === "allow" ? "ALLOW" : "DENY"} list
                          </Badge>
                          {(config?.countries as string[])?.map((c: string) => (
                            <Badge key={c} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          XFF: {config?.xffHandling?.replace("_", " ")} • DB: {config?.maxmindDbPath}
                        </div>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No GeoIP filtering policies configured. Add rules to restrict API access by geography.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
