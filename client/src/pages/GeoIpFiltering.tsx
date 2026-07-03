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

  const { data: policies, refetch } = trpc.policy.list.useQuery({});
  const geoIpPolicies = policies?.filter((p: any) => p.type === "geoip") || [];
  const createPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setOpen(false); toast.success("GeoIP policy created"); resetForm(); },
  });

  function resetForm() { setName(""); setMode("deny"); setCountries(""); setXffHandling("trust_first"); }

  // ─── IP/CIDR filtering (enforced at the gateway via the ip-filtering policy) ──
  const { data: apis } = trpc.api.list.useQuery({});
  const apiList = (apis as any[]) || [];
  const ipPolicies = policies?.filter((p: any) => p.type === "ip_filtering") || [];
  const [ipOpen, setIpOpen] = useState(false);
  const [ipName, setIpName] = useState("");
  const [ipApiId, setIpApiId] = useState("");
  const [ipMode, setIpMode] = useState<"allow" | "deny">("deny");
  const [ipList, setIpList] = useState("");
  const createIpPolicy = trpc.policy.create.useMutation({
    onSuccess: () => { refetch(); setIpOpen(false); toast.success("IP filter created — deploy it to enforce"); setIpName(""); setIpList(""); setIpApiId(""); },
    onError: (e) => toast.error(e.message),
  });
  const deployIp = trpc.policy.deployIpFiltering.useMutation({
    onSuccess: (r: any) => toast.success(`IP filtering enforced (${r.whitelist} allow, ${r.blacklist} deny)`),
    onError: (e) => toast.error(e.message),
  });
  const apiName = (id: number) => apiList.find((a: any) => a.id === id)?.name || `API ${id}`;
  const ipApiIds = Array.from(new Set(ipPolicies.map((p: any) => p.configuration?.apiId).filter((x: any) => x != null)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">IP &amp; Geo Filtering</h1>
          <p className="text-muted-foreground">Enforce IP/CIDR access control at the gateway; country-level GeoIP requires the Enterprise MaxMind plugin</p>
        </div>
        <div className="flex items-center gap-2">
        <Dialog open={ipOpen} onOpenChange={setIpOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground"><Plus className="w-4 h-4 mr-2" />Add IP Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create IP/CIDR Filter</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div><Label>Rule Name</Label><Input value={ipName} onChange={e => setIpName(e.target.value)} placeholder="Block office-only endpoints" /></div>
              <div><Label>API</Label>
                <Select value={ipApiId} onValueChange={setIpApiId}>
                  <SelectTrigger><SelectValue placeholder="Select API to enforce on" /></SelectTrigger>
                  <SelectContent>{apiList.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Mode</Label>
                <Select value={ipMode} onValueChange={v => setIpMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="allow">Allow list (only these IPs/CIDRs)</SelectItem>
                    <SelectItem value="deny">Deny list (block these IPs/CIDRs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>IPs / CIDRs (comma-separated)</Label>
                <Input value={ipList} onChange={e => setIpList(e.target.value)} placeholder="10.0.0.0/8, 203.0.113.4" className="font-mono" />
              </div>
              <Button className="w-full" disabled={!ipName || !ipApiId || !ipList || createIpPolicy.isPending}
                onClick={() => createIpPolicy.mutate({ name: ipName, type: "ip_filtering", configuration: { mode: ipMode, ips: ipList.split(",").map(s => s.trim()).filter(Boolean), apiId: Number(ipApiId) } })}>
                {createIpPolicy.isPending ? "Creating..." : "Create IP Filter"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
                onClick={() => createPolicy.mutate({ name, type: "geoip", configuration: { mode, countries: countries.split(",").map(c => c.trim()), xffHandling, maxmindDbPath } })}>
                {createPolicy.isPending ? "Creating..." : "Create GeoIP Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* IP/CIDR Access Control — enforced at the gateway */}
      <Card>
        <CardHeader><CardTitle className="text-base">IP / CIDR Access Control</CardTitle></CardHeader>
        <CardContent>
          {ipPolicies.length > 0 ? (
            <div className="space-y-4">
              {ipApiIds.map((aid: any) => (
                <div key={aid} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{apiName(aid)}</span>
                    <Button size="sm" variant="outline" disabled={deployIp.isPending}
                      onClick={() => deployIp.mutate({ apiId: aid })}>
                      {deployIp.isPending ? "Deploying…" : "Deploy to Gateway"}
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {ipPolicies.filter((p: any) => p.configuration?.apiId === aid).map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className={p.configuration?.mode === "allow" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                          {p.configuration?.mode === "allow" ? "ALLOW" : "DENY"}
                        </Badge>
                        <span className="font-medium">{p.name}</span>
                        <span className="font-mono text-muted-foreground">{(p.configuration?.ips as string[])?.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No IP filters yet. Add an IP/CIDR rule and deploy it to enforce access control at the gateway.
            </div>
          )}
        </CardContent>
      </Card>

      {/* MaxMind Config Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-800">Country-level GeoIP requires Gravitee Enterprise</p>
              <p className="text-sm text-blue-700 mt-1">The MaxMind GeoLite2 / geoip policy is an Enterprise plugin and is not installed on this gateway, so country rules below are stored but not enforced. IP/CIDR filtering (above) uses the bundled <code className="bg-blue-100 px-1 rounded">ip-filtering</code> policy and is enforced at the gateway today.</p>
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
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Requires Enterprise</Badge>
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
