import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SyncStatus = "synced" | "local_only" | "disconnected" | string | undefined;

const MAP: Record<string, { dot: string; text: string; cls: string; tip: string }> = {
  synced: { dot: "bg-emerald-500", text: "Gravitee", cls: "border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30", tip: "Live on the Gravitee gateway." },
  local_only: { dot: "bg-amber-500", text: "Local", cls: "border-amber-500/30 text-amber-600 bg-amber-50 dark:bg-amber-950/30", tip: "Stored locally, not yet synced to Gravitee." },
  disconnected: { dot: "bg-gray-400", text: "Offline", cls: "border-muted-foreground/30 text-muted-foreground", tip: "Gravitee is unreachable — showing local data." },
};

export function SyncBadge({ status }: { status?: SyncStatus }) {
  const s = MAP[status ?? "disconnected"] ?? MAP.disconnected;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={`text-[10px] gap-1.5 font-normal px-1.5 py-0.5 ${s.cls}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
          {s.text}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{s.tip}</TooltipContent>
    </Tooltip>
  );
}
