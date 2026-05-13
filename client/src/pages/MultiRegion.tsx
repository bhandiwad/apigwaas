import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Globe, MapPin, Server, ArrowRight, Shield, Zap } from "lucide-react";

const REGIONS = [
  { code: "ap-south-1", name: "Mumbai", country: "IN", lat: 19.08, lng: 72.88, tier: "Primary" },
  { code: "ap-south-2", name: "Hyderabad", country: "IN", lat: 17.38, lng: 78.49, tier: "Primary" },
  { code: "ap-southeast-1", name: "Singapore", country: "SG", lat: 1.35, lng: 103.82, tier: "Secondary" },
  { code: "eu-west-1", name: "Ireland", country: "IE", lat: 53.35, lng: -6.26, tier: "Secondary" },
  { code: "us-east-1", name: "N. Virginia", country: "US", lat: 38.95, lng: -77.45, tier: "DR" },
];

const SHARDING_TAGS = [
  { tag: "india-sovereign", description: "Data stays within Indian borders (DPDP Act)", regions: ["ap-south-1", "ap-south-2"], color: "bg-orange-100 text-orange-700 border-orange-300" },
  { tag: "apac-standard", description: "APAC region routing for standard workloads", regions: ["ap-south-1", "ap-southeast-1"], color: "bg-blue-100 text-blue-700 border-blue-300" },
  { tag: "global-ha", description: "Global high-availability with multi-region failover", regions: ["ap-south-1", "ap-southeast-1", "eu-west-1", "us-east-1"], color: "bg-green-100 text-green-700 border-green-300" },
  { tag: "pci-dss", description: "PCI-DSS compliant zones only", regions: ["ap-south-1", "ap-south-2"], color: "bg-red-100 text-red-700 border-red-300" },
];

export default function MultiRegion() {
  const { data: clusters } = trpc.gateway.clusters.useQuery();

  const getClustersByRegion = (regionCode: string) => clusters?.filter((c: any) => c.region === regionCode) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Multi-Region Management (F-07)</h1>
          <p className="text-muted-foreground">Sharding tags, region-based routing, and data residency controls</p>
        </div>
        <Button className="bg-amber-500 hover:bg-amber-600 text-white" onClick={() => toast.info("Add region — coming soon")}>
          <Globe className="w-4 h-4 mr-2" />Add Region
        </Button>
      </div>

      {/* Region Map Overview */}
      <Card>
        <CardHeader><CardTitle>Region Topology</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {REGIONS.map(region => {
              const regionClusters = getClustersByRegion(region.code);
              return (
                <div key={region.code} className="border rounded-lg p-4 text-center hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 mx-auto bg-amber-50 rounded-full flex items-center justify-center mb-2">
                    <MapPin className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="font-medium text-sm">{region.name}</div>
                  <div className="text-xs text-muted-foreground">{region.code}</div>
                  <Badge variant="outline" className={`mt-2 text-xs ${region.tier === "Primary" ? "bg-green-50 text-green-700" : region.tier === "DR" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                    {region.tier}
                  </Badge>
                  <div className="mt-2 text-xs">
                    <span className="font-medium">{regionClusters.length}</span> clusters
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Sharding Tags */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-amber-600" />Sharding Tags</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {SHARDING_TAGS.map(tag => (
              <div key={tag.tag} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <Badge className={tag.color}>{tag.tag}</Badge>
                  <div>
                    <p className="text-sm font-medium">{tag.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {tag.regions.map((r, idx) => (
                        <span key={r} className="flex items-center gap-1">
                          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r}</code>
                          {idx < tag.regions.length - 1 && <ArrowRight className="w-3 h-3 text-gray-300" />}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{tag.regions.length} regions</Badge>
                  <Button size="sm" variant="outline" onClick={() => toast.info("Edit sharding tag — coming soon")}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Data Residency Rules */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-red-600" />Data Residency Rules</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-3 font-medium">Rule</th>
                  <th className="pb-3 font-medium">Regulation</th>
                  <th className="pb-3 font-medium">Allowed Regions</th>
                  <th className="pb-3 font-medium">Enforcement</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">India Data Sovereignty</td>
                  <td className="py-3"><Badge variant="outline">DPDP Act 2023</Badge></td>
                  <td className="py-3"><code className="text-xs bg-gray-100 px-1 rounded">ap-south-1, ap-south-2</code></td>
                  <td className="py-3"><Badge className="bg-red-100 text-red-700">Hard Block</Badge></td>
                  <td className="py-3"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">PCI Cardholder Data</td>
                  <td className="py-3"><Badge variant="outline">PCI-DSS v4.0</Badge></td>
                  <td className="py-3"><code className="text-xs bg-gray-100 px-1 rounded">ap-south-1, ap-south-2</code></td>
                  <td className="py-3"><Badge className="bg-red-100 text-red-700">Hard Block</Badge></td>
                  <td className="py-3"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                </tr>
                <tr className="border-b hover:bg-gray-50">
                  <td className="py-3 font-medium">GDPR EU Data</td>
                  <td className="py-3"><Badge variant="outline">GDPR Art. 44-49</Badge></td>
                  <td className="py-3"><code className="text-xs bg-gray-100 px-1 rounded">eu-west-1</code></td>
                  <td className="py-3"><Badge className="bg-yellow-100 text-yellow-700">Soft Warn</Badge></td>
                  <td className="py-3"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="py-3 font-medium">RBI Financial Data</td>
                  <td className="py-3"><Badge variant="outline">RBI CSCRF</Badge></td>
                  <td className="py-3"><code className="text-xs bg-gray-100 px-1 rounded">ap-south-1, ap-south-2</code></td>
                  <td className="py-3"><Badge className="bg-red-100 text-red-700">Hard Block</Badge></td>
                  <td className="py-3"><Badge className="bg-green-100 text-green-700">Active</Badge></td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Failover Configuration */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-amber-600" />Failover Configuration</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="font-medium mb-2">Active-Active (Primary Regions)</div>
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-green-100 text-green-700">ap-south-1</Badge>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge className="bg-green-100 text-green-700">ap-south-2</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Automatic failover with &lt;30s detection. DNS-based GSLB with health checks.</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="font-medium mb-2">DR Failover (Cross-Region)</div>
              <div className="flex items-center gap-2 text-sm">
                <Badge className="bg-green-100 text-green-700">ap-south-1</Badge>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge className="bg-blue-100 text-blue-700">ap-southeast-1</Badge>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <Badge className="bg-red-100 text-red-700">us-east-1</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Manual promotion required for DR. RPO: 5min, RTO: 15min.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
