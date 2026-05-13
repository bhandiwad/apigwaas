import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

export default function PlansPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Plans</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage API subscription plans with rate limits and quotas</p>
      </div>
      <Card className="border border-border/60">
        <CardContent className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Select an API from the APIs page to manage its plans.</p>
          <p className="text-xs text-muted-foreground mt-2">Plans define rate limits, quotas, and pricing for API consumers.</p>
        </CardContent>
      </Card>
    </div>
  );
}
