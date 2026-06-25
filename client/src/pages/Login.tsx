import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Mode = "login" | "register" | "forgot";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          toast.success("If that email is registered, a reset link has been sent");
          setMode("login");
        } else {
          toast.error("Something went wrong, please try again");
        }
        return;
      }

      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const tenantSlug = new URLSearchParams(window.location.search).get("tenant");
      const body = mode === "login" ? { email, password } : { email, password, name, ...(tenantSlug ? { tenantSlug } : {}) };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Authentication failed");
        return;
      }
      await utils.auth.me.invalidate();
      window.location.href = "/";
    } catch {
      toast.error("Network error, please try again");
    } finally {
      setLoading(false);
    }
  }

  const titles: Record<Mode, string> = { login: "Sign in", register: "Create account", forgot: "Reset password" };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center text-white font-bold text-sm">AI</div>
            <span className="font-semibold text-sm text-muted-foreground">infinitAIZEN Gateway</span>
          </div>
          <CardTitle className="text-xl">{titles[mode]}</CardTitle>
          {mode === "forgot" && (
            <p className="text-sm text-muted-foreground">Enter your email and we'll send a reset link</p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-1">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" type="text" placeholder="Pramod Bhandiwad" value={name} onChange={e => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setMode("forgot")}>
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" placeholder={mode === "register" ? "Min. 8 characters" : "••••••••"} required value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : mode === "register" ? "Create account" : "Send reset link"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>No account?{" "}<button type="button" className="underline" onClick={() => setMode("register")}>Register</button></>
            ) : (
              <><button type="button" className="underline" onClick={() => setMode("login")}>Back to sign in</button></>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
