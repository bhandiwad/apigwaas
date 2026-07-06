import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SyncBadge } from "@/components/SyncBadge";
import { Rocket } from "lucide-react";

export function ApiDeploymentsTab({ apiId }: { apiId: number }) {
  const { data, isLoading } = trpc.gateway.deployments.useQuery({ apiId });
  const rows = (data ?? []) as any[];

  const tone = (s: string) => s === "deployed" ? "bg-emerald-100 text-emerald-700" : s === "failed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";

  if (isLoading) return <div className="mt-4"><Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card></div>;
  if (rows.length === 0) return (
    <div className="mt-4"><Card><CardContent className="py-10 text-center">
      <Rocket className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
      <p className="text-sm text-muted-foreground">No deployment history yet. Deploy this API from the Deployments page or the creation wizard.</p>
    </CardContent></Card></div>
  );

  return (
    <div className="space-y-2 mt-4">
      {rows.map((d) => (
        <Card key={d.id}>
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Rocket className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">v{d.version} · {d.strategy ?? "rolling"}</p>
                <p className="text-xs text-muted-foreground">{d.createdAt ? new Date(d.createdAt).toLocaleString() : ""}{d.actorName ? ` · ${d.actorName}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SyncBadge status={d.syncSource === "gravitee" ? "synced" : "local_only"} />
              <Badge className={tone(d.status)}>{d.status}</Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
