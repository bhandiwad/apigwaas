import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Search, ArrowLeft, BookOpen, Zap, Code2, CreditCard,
  CheckCircle2, Copy, ExternalLink, ChevronRight, Star,
  Globe, Lock, Activity, Users, LayoutDashboard, Layers,
} from "lucide-react";

// ─── Simulated endpoint catalogue per API ────────────────────────────────────
const ENDPOINTS: Record<string, { method: string; path: string; desc: string; sampleResponse: string }[]> = {
  "Account Balance API": [
    { method: "GET", path: "/balance", desc: "Fetch current account balance and available limit", sampleResponse: '{\n  "accountNo": "****4521",\n  "balance": 142830.50,\n  "availableLimit": 50000.00,\n  "currency": "INR",\n  "asOf": "2026-06-17T13:00:00Z"\n}' },
    { method: "GET", path: "/statements", desc: "Mini statement — last 10 transactions", sampleResponse: '{\n  "transactions": [\n    { "date": "2026-06-17", "desc": "UPI/NPCI001", "amount": -500.00, "balance": 142830.50 },\n    { "date": "2026-06-16", "desc": "SALARY CREDIT", "amount": 85000.00, "balance": 143330.50 }\n  ]\n}' },
    { method: "GET", path: "/transactions", desc: "Full transaction history with date/type filters", sampleResponse: '{\n  "total": 248,\n  "page": 1,\n  "items": [ ... ]\n}' },
  ],
  "UPI Payments API": [
    { method: "POST", path: "/initiate", desc: "Initiate a UPI push/pull payment", sampleResponse: '{\n  "txnId": "TXN20260617001",\n  "status": "PENDING",\n  "upiRef": "406171234567890",\n  "amount": 1500.00\n}' },
    { method: "GET", path: "/status/{txnId}", desc: "Check real-time payment status", sampleResponse: '{\n  "txnId": "TXN20260617001",\n  "status": "SUCCESS",\n  "completedAt": "2026-06-17T13:01:45Z"\n}' },
    { method: "POST", path: "/refund", desc: "Initiate UPI refund for a completed transaction", sampleResponse: '{\n  "refundId": "RFD20260617001",\n  "status": "INITIATED",\n  "expectedBy": "2026-06-19"\n}' },
    { method: "GET", path: "/vpa/validate", desc: "Validate a UPI VPA (Virtual Payment Address)", sampleResponse: '{\n  "vpa": "user@ybl",\n  "valid": true,\n  "name": "Ravi Kumar"\n}' },
  ],
  "Loan Eligibility API": [
    { method: "POST", path: "/check", desc: "CIBIL-integrated pre-approved loan eligibility check", sampleResponse: '{\n  "eligible": true,\n  "maxAmount": 500000,\n  "interestRate": 10.5,\n  "tenure": [12, 24, 36],\n  "cibilScore": 762\n}' },
    { method: "GET", path: "/offers", desc: "Fetch personalised loan offers for a customer", sampleResponse: '{\n  "offers": [\n    { "type": "personal", "amount": 300000, "rate": 10.5 },\n    { "type": "top-up", "amount": 200000, "rate": 9.8 }\n  ]\n}' },
  ],
  "Bulk Payment API": [
    { method: "POST", path: "/batch", desc: "Submit a NEFT/RTGS/IMPS bulk disbursement batch", sampleResponse: '{\n  "batchId": "BATCH20260617001",\n  "totalRecords": 500,\n  "accepted": 498,\n  "rejected": 2,\n  "status": "PROCESSING"\n}' },
    { method: "GET", path: "/batch/{batchId}", desc: "Track batch processing status", sampleResponse: '{\n  "batchId": "BATCH20260617001",\n  "processed": 498,\n  "status": "COMPLETED",\n  "successRate": "99.6%"\n}' },
    { method: "GET", path: "/batch/{batchId}/failures", desc: "Download failed records for re-submission", sampleResponse: '{\n  "failures": [\n    { "row": 42, "account": "****1234", "reason": "INVALID_IFSC" }\n  ]\n}' },
  ],
  "Trade Finance API": [
    { method: "POST", path: "/lc/create", desc: "Create a Letter of Credit request", sampleResponse: '{\n  "lcId": "LC2026001",\n  "status": "DRAFT",\n  "amount": 2500000,\n  "currency": "USD"\n}' },
    { method: "GET", path: "/lc/{lcId}", desc: "Fetch LC status and documents", sampleResponse: '{\n  "lcId": "LC2026001",\n  "status": "ISSUED",\n  "bankRef": "SBI/LC/2026/001"\n}' },
    { method: "POST", path: "/bg/request", desc: "Bank Guarantee issuance request", sampleResponse: '{\n  "bgId": "BG2026001",\n  "status": "UNDER_REVIEW"\n}' },
  ],
  "Order Status API": [
    { method: "GET", path: "/{orderId}", desc: "Real-time order lifecycle status", sampleResponse: '{\n  "orderId": "ORD-8821",\n  "status": "OUT_FOR_DELIVERY",\n  "eta": "2026-06-17T16:30:00Z",\n  "partner": "BlueDart"\n}' },
    { method: "GET", path: "/{orderId}/tracking", desc: "Full logistics tracking trail", sampleResponse: '{\n  "events": [\n    { "time": "13:00", "location": "Bangalore Hub", "status": "Dispatched" },\n    { "time": "15:00", "location": "Koramangala", "status": "Out for Delivery" }\n  ]\n}' },
    { method: "POST", path: "/{orderId}/cancel", desc: "Request order cancellation", sampleResponse: '{\n  "success": true,\n  "refundEligible": true,\n  "refundAmount": 1299.00\n}' },
  ],
  "Slot Availability API": [
    { method: "GET", path: "/slots", desc: "Available 10-minute delivery slots by pin code", sampleResponse: '{\n  "pincode": "560034",\n  "date": "2026-06-17",\n  "slots": [\n    { "id": "S1", "time": "10:00-10:10", "available": true },\n    { "id": "S2", "time": "10:10-10:20", "available": false }\n  ]\n}' },
    { method: "POST", path: "/slots/reserve", desc: "Reserve a delivery slot for an order", sampleResponse: '{\n  "reservationId": "RSV-001",\n  "slot": "10:00-10:10",\n  "expiresAt": "2026-06-17T13:30:00Z"\n}' },
  ],
  "SKU Search API": [
    { method: "GET", path: "/search", desc: "Full-text product catalog search", sampleResponse: '{\n  "query": "apple iphone",\n  "total": 38,\n  "results": [\n    { "sku": "APPL-IP15-128", "name": "iPhone 15 128GB", "price": 79900 }\n  ]\n}' },
    { method: "GET", path: "/{sku}", desc: "Fetch product details by SKU", sampleResponse: '{\n  "sku": "APPL-IP15-128",\n  "name": "iPhone 15 128GB",\n  "inStock": true,\n  "price": 79900\n}' },
  ],
  "Tenant Onboarding API": [
    { method: "POST", path: "/provision", desc: "Provision a new SaaS tenant", sampleResponse: '{\n  "tenantId": "T-20260617",\n  "status": "PROVISIONING",\n  "estimatedReady": "2026-06-17T14:00:00Z"\n}' },
    { method: "GET", path: "/{tenantId}/status", desc: "Check provisioning status", sampleResponse: '{\n  "tenantId": "T-20260617",\n  "status": "ACTIVE",\n  "adminUrl": "https://app.example.com/T-20260617"\n}' },
  ],
};

const DEFAULT_ENDPOINTS = [
  { method: "GET", path: "/", desc: "Root health check", sampleResponse: '{ "status": "ok" }' },
];

const GETTING_STARTED_STEPS = [
  { n: 1, title: "Register as a Developer", desc: "Create your free developer account to access the API catalog.", icon: Users },
  { n: 2, title: "Create an Application", desc: "Register your app to get a Client ID and Client Secret.", icon: LayoutDashboard },
  { n: 3, title: "Choose a Plan & Subscribe", desc: "Pick a plan (Free, Standard, or Enterprise) and subscribe to the APIs you need.", icon: Layers },
  { n: 4, title: "Get Your API Key", desc: "Exchange your credentials for an OAuth 2.0 bearer token.", icon: Lock },
  { n: 5, title: "Make Your First Call", desc: "Include the token in the Authorization header and start calling the API.", icon: Zap },
];

const METHOD_COLOR: Record<string, string> = {
  GET:    "bg-emerald-100 text-emerald-700",
  POST:   "bg-blue-100 text-blue-700",
  PUT:    "bg-amber-100 text-amber-700",
  PATCH:  "bg-purple-100 text-purple-700",
  DELETE: "bg-red-100 text-red-700",
};

const CATEGORY_COLOR: Record<string, string> = {
  rest:      "bg-blue-100 text-blue-700",
  graphql:   "bg-pink-100 text-pink-700",
  grpc:      "bg-purple-100 text-purple-700",
  websocket: "bg-amber-100 text-amber-700",
};

const API_CATEGORY: Record<string, string> = {
  "Account Balance API":   "Banking",
  "UPI Payments API":      "Payments",
  "Loan Eligibility API":  "Lending",
  "Bulk Payment API":      "Payments",
  "Trade Finance API":     "Corporate",
  "Order Status API":      "Commerce",
  "Slot Availability API": "Commerce",
  "SKU Search API":        "Commerce",
  "Tenant Onboarding API": "Platform",
};

type PortalView = "catalog" | "api-detail" | "getting-started" | "my-apps";

export default function DeveloperPortalView() {
  const { data: apisRaw } = trpc.api.portalList.useQuery();
  const { data: plansRaw } = trpc.plan.portalList.useQuery();
  const { data: appsRaw } = trpc.consumerApp.list.useQuery({});

  const apis: any[] = (apisRaw as any[]) || [];
  const plans: any[] = (plansRaw as any[]) || [];
  const apps: any[] = (appsRaw as any)?.data ?? [];

  const publishedApis = apis.filter(a => a.status === "published");

  const [view, setView] = useState<PortalView>("catalog");
  const [selectedApi, setSelectedApi] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Try It state
  const [tryItLoading, setTryItLoading] = useState(false);
  const [tryItResult, setTryItResult] = useState<string | null>(null);
  const [activeEndpoint, setActiveEndpoint] = useState<any | null>(null);
  const [bearerToken, setBearerToken] = useState("eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.demo");

  const filteredApis = publishedApis.filter(a => {
    const matchSearch = !search || a.name.toLowerCase().includes(search.toLowerCase()) || (a.description || "").toLowerCase().includes(search.toLowerCase());
    const cat = API_CATEGORY[a.name] || "Other";
    const matchCat = filterCategory === "All" || cat === filterCategory;
    return matchSearch && matchCat;
  });

  const categories = ["All", ...Array.from(new Set(publishedApis.map(a => API_CATEGORY[a.name] || "Other")))];

  function openApi(api: any) {
    setSelectedApi(api);
    setView("api-detail");
    setTryItResult(null);
    setActiveEndpoint(null);
  }

  async function runTryIt(endpoint: any) {
    if (!selectedApi) return;
    setTryItLoading(true);
    setTryItResult(null);
    try {
      const url = `http://localhost:8082${selectedApi.contextPath}${endpoint.path === "/" ? "" : endpoint.path}`;
      const res = await fetch(url, {
        method: endpoint.method,
        headers: { "Authorization": `Bearer ${bearerToken}`, "Content-Type": "application/json" },
      });
      const body = await res.text();
      setTryItResult(`HTTP ${res.status} ${res.statusText}\n\n${body.slice(0, 800)}`);
    } catch {
      // Gateway not running locally — show the sample response instead
      setTryItResult(`// Gateway not reachable — showing sample response\n\n${endpoint.sampleResponse}`);
    } finally {
      setTryItLoading(false);
    }
  }

  function copyCode(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }

  const apiEndpoints = selectedApi ? (ENDPOINTS[selectedApi.name] || DEFAULT_ENDPOINTS) : [];
  const apiPlans = selectedApi ? plans.filter((p: any) => p.apiId === selectedApi.id) : [];

  // ─── Navbar ───────────────────────────────────────────────────────────────
  const Nav = () => (
    <nav className="sticky top-0 z-50 bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-bold text-lg" style={{ color: "#8DC63F" }}>
            <Globe className="w-5 h-5" />
            <span style={{ fontFamily: "'Poppins', sans-serif" }}>sify<sup style={{ fontSize: 9 }}>®</sup></span>
            <span className="text-sm font-semibold text-[#1a2e4a] ml-1" style={{ fontFamily: "'Poppins', sans-serif" }}>Developer Portal</span>
          </span>
          <div className="hidden md:flex items-center gap-1">
            <Button variant="ghost" size="sm" className={view === "catalog" ? "bg-muted" : ""} onClick={() => { setView("catalog"); setSelectedApi(null); }}>
              <BookOpen className="w-3.5 h-3.5 mr-1" />API Catalog
            </Button>
            <Button variant="ghost" size="sm" className={view === "getting-started" ? "bg-muted" : ""} onClick={() => setView("getting-started")}>
              <Zap className="w-3.5 h-3.5 mr-1" />Getting Started
            </Button>
            <Button variant="ghost" size="sm" className={view === "my-apps" ? "bg-muted" : ""} onClick={() => setView("my-apps")}>
              <Code2 className="w-3.5 h-3.5 mr-1" />My Applications
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 text-xs hidden sm:flex">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />API Gateway Live
          </Badge>
          <Button size="sm" variant="outline">Sign In</Button>
          <Button size="sm" style={{ backgroundColor: "#8DC63F", color: "white" }} className="hover:opacity-90">
            Register Free
          </Button>
        </div>
      </div>
    </nav>
  );

  // ─── API Catalog ──────────────────────────────────────────────────────────
  if (view === "catalog" || !selectedApi) return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a2e4a] to-[#243d60] text-white py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-[#8DC63F]/20 text-[#8DC63F] border-[#8DC63F]/30">
            {publishedApis.length} APIs Available
          </Badge>
          <h1 className="text-4xl font-bold mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Build with Sify APIs
          </h1>
          <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto">
            Access banking, payments, commerce, and platform APIs — secured, metered, and production-ready.
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-10 h-12 text-gray-900 bg-white shadow-lg border-0 rounded-xl"
              placeholder="Search APIs — e.g. UPI, Loan, Order…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex gap-8 overflow-x-auto">
          {[
            { label: "Published APIs", value: publishedApis.length },
            { label: "Avg Uptime", value: "99.98%" },
            { label: "Avg Latency", value: "< 45 ms" },
            { label: "Registered Apps", value: apps.length },
          ].map(s => (
            <div key={s.label} className="flex-shrink-0 text-center">
              <div className="text-xl font-bold text-[#1a2e4a]">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Catalog */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Category filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {categories.map(c => (
            <Button key={c} size="sm" variant={filterCategory === c ? "default" : "outline"}
              className={filterCategory === c ? "bg-[#1a2e4a] text-white" : ""}
              onClick={() => setFilterCategory(c)}>
              {c}
            </Button>
          ))}
        </div>

        {filteredApis.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No APIs match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredApis.map((api: any) => {
              const cat = API_CATEGORY[api.name] || "Other";
              const epCount = (ENDPOINTS[api.name] || DEFAULT_ENDPOINTS).length;
              return (
                <Card key={api.id} className="hover:shadow-md transition-shadow cursor-pointer border border-border/60 hover:border-[#8DC63F]/50"
                  onClick={() => openApi(api)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-tight">{api.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5">{api.version}</Badge>
                          <Badge className={`text-[10px] px-1.5 ${CATEGORY_COLOR[api.protocol] || "bg-gray-100 text-gray-600"}`}>
                            {api.protocol?.toUpperCase()}
                          </Badge>
                          <Badge className="text-[10px] px-1.5 bg-slate-100 text-slate-600">{cat}</Badge>
                        </div>
                      </div>
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 ml-2" />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                      {api.description || "No description available."}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{epCount} endpoints</span>
                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" />Free tier</span>
                      </div>
                      <Button size="sm" variant="ghost" className="text-[#1a2e4a] hover:text-[#8DC63F] text-xs h-7 px-2">
                        View Docs <ChevronRight className="w-3 h-3 ml-0.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─── Getting Started ──────────────────────────────────────────────────────
  if (view === "getting-started") return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold text-[#1a2e4a] mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Getting Started
        </h1>
        <p className="text-muted-foreground mb-10">From sign-up to your first API call in 5 easy steps.</p>

        <div className="space-y-4">
          {GETTING_STARTED_STEPS.map(step => (
            <div key={step.n} className="flex gap-4 p-5 bg-white rounded-xl border shadow-sm">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: "#1a2e4a" }}>
                {step.n}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <step.icon className="w-4 h-4 text-[#8DC63F]" />
                  <h3 className="font-semibold text-sm">{step.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <Card className="mt-8 border-l-4 border-l-[#8DC63F] bg-[#8DC63F]/5">
          <CardContent className="pt-5">
            <h3 className="font-semibold mb-3">Sample Request</h3>
            <div className="relative">
              <pre className="bg-[#1a2e4a] text-green-300 p-4 rounded-lg text-xs font-mono overflow-x-auto">
{`curl -X GET "https://api.sifycloudinfinit.io/retail/upi/v3/vpa/validate?vpa=user@ybl" \\
  -H "Authorization: Bearer <your_token>" \\
  -H "X-API-Key: <your_api_key>"`}
              </pre>
              <Button size="sm" variant="ghost" className="absolute top-2 right-2 text-white/60 hover:text-white h-7 px-2"
                onClick={() => copyCode(`curl -X GET "https://api.sifycloudinfinit.io/retail/upi/v3/vpa/validate?vpa=user@ybl" -H "Authorization: Bearer <token>"`)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button className="mt-6 w-full" style={{ backgroundColor: "#8DC63F", color: "white" }}
          onClick={() => setView("catalog")}>
          Browse the API Catalog
        </Button>
      </div>
    </div>
  );

  // ─── My Applications ──────────────────────────────────────────────────────
  if (view === "my-apps") return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1a2e4a]" style={{ fontFamily: "'Poppins', sans-serif" }}>
              My Applications
            </h1>
            <p className="text-muted-foreground text-sm">Manage your registered apps and API credentials</p>
          </div>
          <Button style={{ backgroundColor: "#8DC63F", color: "white" }} className="hover:opacity-90">
            + Register New App
          </Button>
        </div>

        {apps.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Code2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">No applications registered yet.</p>
              <Button className="mt-4" variant="outline">Register Your First App</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {apps.map((app: any) => (
              <Card key={app.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#1a2e4a] flex items-center justify-center text-white font-bold text-sm">
                        {app.name?.charAt(0)}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">{app.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{app.description || "No description"}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Client ID</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono flex-1 truncate">{app.clientId}</code>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copyCode(app.clientId)}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-xs text-muted-foreground mb-1">Client Secret</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-muted-foreground">••••••••••••••••</code>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-xs" onClick={() => toast.info("Reveal secret in production dashboard")}>
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <div className="text-xs font-medium text-blue-800 mb-2">Get OAuth Token</div>
                    <pre className="text-xs font-mono text-blue-700 overflow-x-auto whitespace-pre-wrap">
{`curl -X POST https://auth.sifycloudinfinit.io/oauth/token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=${app.clientId}" \\
  -d "client_secret=<secret>"`}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ─── API Detail View ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />

      {/* API header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Button variant="ghost" size="sm" className="mb-3 text-muted-foreground -ml-2"
            onClick={() => { setView("catalog"); setSelectedApi(null); }}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />Back to Catalog
          </Button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-[#1a2e4a]">{selectedApi.name}</h1>
                <Badge variant="outline" className="text-xs">{selectedApi.version}</Badge>
                <Badge className={`text-xs ${CATEGORY_COLOR[selectedApi.protocol] || "bg-gray-100 text-gray-600"}`}>
                  {selectedApi.protocol?.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedApi.description}</p>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono mt-2 inline-block">
                {`https://api.sifycloudinfinit.io${selectedApi.contextPath}`}
              </code>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline">
                <Copy className="w-3.5 h-3.5 mr-1" />Copy Base URL
              </Button>
              <Button size="sm" style={{ backgroundColor: "#8DC63F", color: "white" }} className="hover:opacity-90"
                onClick={() => { toast.success("Subscription request submitted!"); }}>
                Subscribe
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs defaultValue="endpoints">
          <TabsList className="mb-6">
            <TabsTrigger value="endpoints"><BookOpen className="w-3.5 h-3.5 mr-1" />Endpoints</TabsTrigger>
            <TabsTrigger value="try-it"><Zap className="w-3.5 h-3.5 mr-1" />Try It</TabsTrigger>
            <TabsTrigger value="plans"><CreditCard className="w-3.5 h-3.5 mr-1" />Plans & Pricing</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="w-3.5 h-3.5 mr-1" />Code Samples</TabsTrigger>
          </TabsList>

          {/* Endpoints */}
          <TabsContent value="endpoints" className="space-y-3">
            <p className="text-sm text-muted-foreground">{apiEndpoints.length} endpoints available</p>
            {apiEndpoints.map((ep, i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Badge className={`text-xs font-mono flex-shrink-0 ${METHOD_COLOR[ep.method] || "bg-gray-100 text-gray-700"}`}>
                      {ep.method}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono text-[#1a2e4a]">
                        {selectedApi.contextPath}{ep.path}
                      </code>
                      <p className="text-xs text-muted-foreground mt-0.5">{ep.desc}</p>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7 flex-shrink-0"
                      onClick={() => { setActiveEndpoint(ep); document.getElementById("try-it-tab")?.click(); }}>
                      Try It
                    </Button>
                  </div>
                  <details className="mt-3">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Sample response
                    </summary>
                    <pre className="mt-2 bg-muted p-3 rounded text-xs font-mono overflow-x-auto">
                      {ep.sampleResponse}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Try It */}
          <TabsContent value="try-it" id="try-it-tab">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Select Endpoint</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-2">
                    {apiEndpoints.map((ep, i) => (
                      <button key={i}
                        onClick={() => { setActiveEndpoint(ep); setTryItResult(null); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${activeEndpoint === ep ? "bg-[#1a2e4a] text-white" : "hover:bg-muted"}`}>
                        <Badge className={`text-[10px] font-mono flex-shrink-0 ${activeEndpoint === ep ? "bg-white/20 text-white" : METHOD_COLOR[ep.method] || "bg-gray-100"}`}>
                          {ep.method}
                        </Badge>
                        <code className="text-xs truncate">{ep.path}</code>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Authorization</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground mb-1">Bearer Token</div>
                    <Textarea
                      className="font-mono text-xs h-20 resize-none"
                      value={bearerToken}
                      onChange={e => setBearerToken(e.target.value)}
                    />
                  </CardContent>
                </Card>

                <Button className="w-full" style={{ backgroundColor: "#8DC63F", color: "white" }}
                  disabled={!activeEndpoint || tryItLoading}
                  onClick={() => activeEndpoint && runTryIt(activeEndpoint)}>
                  {tryItLoading ? "Sending…" : activeEndpoint ? `Send ${activeEndpoint.method} Request` : "Select an endpoint above"}
                </Button>
              </div>

              <div>
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center justify-between">
                      Response
                      {tryItResult && (
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => copyCode(tryItResult)}>
                          <Copy className="w-3 h-3 mr-1" />Copy
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {!tryItResult ? (
                      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                        <div className="text-center">
                          <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p>Select an endpoint and click Send</p>
                        </div>
                      </div>
                    ) : (
                      <pre className="bg-[#1a2e4a] text-green-300 p-4 rounded-lg text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                        {tryItResult}
                      </pre>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Plans & Pricing */}
          <TabsContent value="plans">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Always show at least 3 plans (Free, Standard, Enterprise) */}
              {[
                {
                  name: "Free",
                  monthlyFee: null,
                  rateLimit: apiPlans[0]?.rateLimit || 100,
                  rateLimitPeriod: "minute",
                  quotaLimit: apiPlans[0]?.quotaLimit || 10000,
                  features: ["Community support", "Standard SLA", "Shared infrastructure"],
                  highlight: false,
                },
                {
                  name: "Standard",
                  monthlyFee: 4999,
                  rateLimit: 1000,
                  rateLimitPeriod: "minute",
                  quotaLimit: 500000,
                  features: ["Email support", "99.9% SLA", "Dedicated rate limits", "Analytics dashboard"],
                  highlight: true,
                },
                {
                  name: "Enterprise",
                  monthlyFee: null,
                  rateLimit: "Unlimited",
                  rateLimitPeriod: "minute",
                  quotaLimit: "Unlimited",
                  features: ["24/7 dedicated support", "99.99% SLA", "Custom rate limits", "Private gateway", "SLA credits"],
                  highlight: false,
                },
              ].map(plan => (
                <Card key={plan.name} className={`relative ${plan.highlight ? "border-[#8DC63F] shadow-md" : ""}`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge style={{ backgroundColor: "#8DC63F", color: "white" }} className="text-xs px-3">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{plan.name}</CardTitle>
                    <div className="mt-1">
                      {plan.monthlyFee ? (
                        <span>
                          <span className="text-2xl font-bold text-[#1a2e4a]">₹{plan.monthlyFee.toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs">/month</span>
                        </span>
                      ) : plan.name === "Enterprise" ? (
                        <span className="text-lg font-semibold text-[#1a2e4a]">Custom Pricing</span>
                      ) : (
                        <span className="text-2xl font-bold text-emerald-600">Free</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-4">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate limit</span>
                        <span className="font-medium">{plan.rateLimit}/{plan.rateLimitPeriod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly quota</span>
                        <span className="font-medium">{typeof plan.quotaLimit === "number" ? plan.quotaLimit.toLocaleString() : plan.quotaLimit} calls</span>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />{f}
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full" size="sm"
                      style={plan.highlight ? { backgroundColor: "#8DC63F", color: "white" } : {}}
                      variant={plan.highlight ? "default" : "outline"}
                      onClick={() => toast.success(`Subscribed to ${plan.name} plan!`)}>
                      {plan.name === "Enterprise" ? "Contact Sales" : `Subscribe — ${plan.name}`}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Code Samples */}
          <TabsContent value="code">
            <div className="space-y-4">
              {[
                {
                  lang: "cURL",
                  code: `curl -X GET "https://api.sifycloudinfinit.io${selectedApi.contextPath}/" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "X-API-Key: $API_KEY" \\
  -H "Content-Type: application/json"`,
                },
                {
                  lang: "Python",
                  code: `import requests

url = "https://api.sifycloudinfinit.io${selectedApi.contextPath}/"
headers = {
    "Authorization": f"Bearer {token}",
    "X-API-Key": api_key,
}

response = requests.get(url, headers=headers)
print(response.json())`,
                },
                {
                  lang: "JavaScript",
                  code: `const response = await fetch(
  "https://api.sifycloudinfinit.io${selectedApi.contextPath}/",
  {
    headers: {
      Authorization: \`Bearer \${token}\`,
      "X-API-Key": apiKey,
    },
  }
);
const data = await response.json();`,
                },
                {
                  lang: "Java",
                  code: `HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.sifycloudinfinit.io${selectedApi.contextPath}/"))
    .header("Authorization", "Bearer " + token)
    .header("X-API-Key", apiKey)
    .GET()
    .build();

HttpResponse<String> response = client.send(request,
    HttpResponse.BodyHandlers.ofString());`,
                },
              ].map(sample => (
                <Card key={sample.lang} className="shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-mono">{sample.lang}</CardTitle>
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => copyCode(sample.code)}>
                        <Copy className="w-3 h-3 mr-1" />Copy
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <pre className="bg-[#1a2e4a] text-gray-300 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre">
                      {sample.code}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
