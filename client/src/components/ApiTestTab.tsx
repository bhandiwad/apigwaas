import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send } from "lucide-react";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

interface CallResult { at: number; method: string; path: string; status: number; statusText: string; latencyMs: number; body: string; simulated?: boolean; }

export function ApiTestTab({ apiId, api }: { apiId: number; api: any }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [headers, setHeaders] = useState("");
  const [body, setBody] = useState("");
  const [history, setHistory] = useState<CallResult[]>([]);
  const contextPath = String(api?.contextPath || "").replace(/\/$/, "");
  const gatewayUrl = `http://localhost:8082${contextPath}${path.startsWith("/") ? path : `/${path}`}`;

  const call = trpc.api.testCall.useMutation({
    onSuccess: (r: any) => {
      setHistory(h => [{ at: Date.now(), method, path, status: r.status, statusText: r.statusText, latencyMs: r.latencyMs, body: r.body, simulated: r.simulated }, ...h].slice(0, 10));
    },
  });

  function send() {
    let parsedHeaders: Record<string, string> | undefined;
    if (headers.trim()) {
      try { parsedHeaders = JSON.parse(headers); } catch { parsedHeaders = undefined; }
    }
    call.mutate({ apiId, method, path, headers: parsedHeaders, body: body.trim() || undefined });
  }

  const statusTone = (s: number) => s === 0 ? "bg-red-100 text-red-700" : s < 300 ? "bg-emerald-100 text-emerald-700" : s < 400 ? "bg-blue-100 text-blue-700" : s < 500 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="flex gap-2">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Input value={path} onChange={e => setPath(e.target.value)} placeholder="/resource/123" className="font-mono" />
            <Button onClick={send} disabled={call.isPending}><Send className="w-4 h-4 mr-1" />{call.isPending ? "Sending…" : "Send"}</Button>
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all">→ {gatewayUrl}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-xs">Headers (JSON)</Label><Textarea rows={3} value={headers} onChange={e => setHeaders(e.target.value)} placeholder='{"X-Gravitee-Api-Key": "…"}' className="font-mono text-xs" /></div>
            {!["GET", "HEAD"].includes(method) && <div><Label className="text-xs">Body</Label><Textarea rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder='{"key": "value"}' className="font-mono text-xs" /></div>}
          </div>
        </CardContent>
      </Card>

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Send a request to see the response. Calls go through the Gravitee gateway.</p>
      ) : (
        history.map((r, i) => (
          <Card key={r.at + "-" + i}>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="font-mono">{r.method}</Badge>
                <span className="font-mono text-xs text-muted-foreground">{r.path}</span>
                <Badge className={`ml-auto ${statusTone(r.status)}`}>{r.status || "ERR"} {r.statusText}</Badge>
                <span className="text-xs text-muted-foreground">{r.latencyMs}ms</span>
                {r.simulated && <Badge variant="outline" className="text-[10px]">simulated</Badge>}
              </div>
              <pre className="text-[11px] font-mono bg-muted/50 rounded p-2 overflow-x-auto max-h-64 whitespace-pre-wrap">{r.body}</pre>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
