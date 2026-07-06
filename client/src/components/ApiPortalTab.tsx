import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ApiPortalTab({ apiId, api }: { apiId: number; api: any }) {
  const { data: portals, refetch, isLoading } = trpc.devPortal.list.useQuery();
  const create = trpc.devPortal.create.useMutation({
    onSuccess: () => { refetch(); toast.success("Developer portal created"); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.devPortal.update.useMutation({ onError: (e) => toast.error(e.message) });

  const list = (portals ?? []) as any[];
  const portal = list[0];
  const publishedApis: number[] = Array.isArray(portal?.publishedApis) ? portal.publishedApis : [];
  const isPublished = publishedApis.includes(apiId);
  const portalUrl = portal?.customDomain || `${typeof window !== "undefined" ? window.location.origin : ""}/portal`;

  function toggle() {
    if (!portal) return;
    const next = isPublished ? publishedApis.filter(id => id !== apiId) : [...publishedApis, apiId];
    update.mutate({ id: portal.id, publishedApis: next }, {
      onSuccess: () => { refetch(); toast.success(isPublished ? "Removed from developer portal" : "Published to developer portal"); },
    });
  }

  if (isLoading) return <div className="mt-4"><Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Loading…</CardContent></Card></div>;

  if (!portal) {
    return (
      <div className="mt-4"><Card><CardContent className="py-10 text-center space-y-3">
        <Globe className="h-8 w-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">No developer portal yet. Create one to publish APIs for consumers to discover.</p>
        <Button onClick={() => create.mutate({ name: "Developer Portal" })} disabled={create.isPending}>
          {create.isPending ? "Creating…" : "Create developer portal"}
        </Button>
      </CardContent></Card></div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="pt-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{portal.name}</span>
              <Badge variant="outline" className="text-[10px] capitalize">{portal.status}</Badge>
              {isPublished && <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Listed</Badge>}
            </div>
            <a href={portalUrl.startsWith("http") ? portalUrl : `//${portalUrl}`} target="_blank" rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-0.5 break-all">
              {portalUrl}<ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <Button variant={isPublished ? "outline" : "default"} onClick={toggle} disabled={update.isPending}>
            {update.isPending ? "…" : isPublished ? "Unpublish" : "Publish to portal"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Portal listing preview</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="font-medium">{api?.name} <span className="text-xs text-muted-foreground">v{api?.version}</span></p>
          <p className="text-sm text-muted-foreground">{api?.description || "No description — add one so consumers know what this API does."}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
            <Badge variant="outline">{api?.openApiSpec ? "OpenAPI spec attached" : "No spec — importers get less"}</Badge>
            <Badge variant="outline" className="font-mono">{api?.contextPath || "no context path"}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
