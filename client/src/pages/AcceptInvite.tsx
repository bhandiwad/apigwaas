import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Building2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const roleColors: Record<string, string> = {
  owner:     "bg-purple-100 text-purple-700",
  admin:     "bg-blue-100 text-blue-700",
  developer: "bg-amber-100 text-amber-700",
  viewer:    "bg-gray-100 text-gray-600",
};

type InviteMeta = {
  email: string;
  tenantRole: string;
  tenantName: string;
  tenantId: number;
};

export default function AcceptInvitePage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);

  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Fetch invite metadata
  useEffect(() => {
    if (!token) { setMetaError("No invite token in URL."); setMetaLoading(false); return; }
    fetch(`/api/auth/invite/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setMetaError(data.error);
        else setMeta(data);
      })
      .catch(() => setMetaError("Failed to load invite details."))
      .finally(() => setMetaLoading(false));
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!meta) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: password || undefined, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to accept invite"); return; }
      await utils.auth.me.invalidate();
      setDone(true);
      setTimeout(() => { window.location.href = "/"; }, 1500);
    } catch {
      toast.error("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  if (metaLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (metaError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
            <h2 className="font-semibold text-lg mb-1">Invite Invalid</h2>
            <p className="text-sm text-muted-foreground mb-4">{metaError}</p>
            <Button variant="outline" onClick={() => navigate("/")}>Go to sign in</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h2 className="font-semibold text-lg">Welcome to {meta?.tenantName}!</h2>
            <p className="text-sm text-muted-foreground mt-1">Signing you in…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <img src="/sify-logo.svg" alt="sifycloudinfinit" className="h-8" />
            <span className="font-semibold text-sm text-muted-foreground">API Gateway</span>
          </div>
          <CardTitle className="text-xl">You're invited!</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 mb-4 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium">{meta?.tenantName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">Role:</span>
                <Badge variant="secondary" className={`text-xs ${roleColors[meta?.tenantRole ?? "developer"]}`}>
                  {meta?.tenantRole}
                </Badge>
              </div>
            </div>
          </div>

          <form onSubmit={handleAccept} className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={meta?.email ?? ""} disabled className="bg-muted/40" />
            </div>
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Set a password</Label>
              <Input
                type="password"
                placeholder="Min. 8 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Leave blank if you already have an account with this email.</p>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Accepting…</> : "Accept Invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
