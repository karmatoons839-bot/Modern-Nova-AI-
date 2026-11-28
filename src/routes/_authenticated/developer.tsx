import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Code2, Copy, KeyRound, Loader2, Power, RefreshCw, Trash2, Wallet } from "lucide-react";
import { Card, btn, btnOutline, input } from "@/components/Page";
import { API_BASE_PATH, API_SERVICES, EXAMPLES, FREE_API_CREDITS, apiCost, type ApiServiceId } from "@/lib/devapi-config";
import {
  createApi, createApiCreditOrder, deleteApi, getDevDashboard, regenerateApiKey, setApiStatus, submitApiOrderUtr,
} from "@/lib/devapi.functions";

export const Route = createFileRoute("/_authenticated/developer")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Developer API — Modern Nova AI" },
      { name: "description", content: "Create your own Modern Nova AI API, get 10,000 free API credits and add AI generation to your website." },
      { property: "og:title", content: "Developer API — Modern Nova AI" },
      { property: "og:description", content: "Build your own AI-powered experience with Modern Nova AI APIs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DeveloperPage,
});

const BASE = "https://modernnova.in" + API_BASE_PATH;
const fmt = (n: number) => n.toLocaleString("en-IN");
const h2 = "font-display text-lg font-bold text-foreground";
const code = "overflow-x-auto rounded-2xl bg-muted p-4 font-mono text-xs leading-relaxed text-foreground";

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

function DeveloperPage() {
  const qc = useQueryClient();
  const fetchDash = useServerFn(getDevDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dev-dashboard"], queryFn: () => fetchDash() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["dev-dashboard"] });
  const [newKey, setNewKey] = useState<{ key: string; apiId: string } | null>(null);
  const [testKey, setTestKey] = useState("");
  const [buyOpen, setBuyOpenState] = useState(false);
  const setBuyOpen = (b: boolean) => {
    setBuyOpenState(b);
    if (b) setTimeout(() => document.getElementById("buy")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  if (isLoading || !data) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const api = data.apis[0];
  const enabled = new Set(data.apis.flatMap((a) => a.services));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Developer</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Developer API</h1>
          <p className="mt-1 font-semibold text-foreground">Build your own AI-powered experience with Modern Nova AI APIs.</p>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Create an API for your website or application, connect AI generation to your own products, and manage everything from one simple developer dashboard.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-border bg-card p-2 pl-4 shadow-sm">
          <Wallet className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">API Credits: {data.apis.length === 0 && !data.freeGranted ? `${fmt(FREE_API_CREDITS)} free on your first API` : fmt(data.balance)}</span>
          {<button className={btn} onClick={() => setBuyOpen(true)}>Buy Credits</button>}
        </div>
      </div>

      {newKey && <KeyReady apiKey={newKey.key} api={data.apis.find((a) => a.id === newKey.apiId)} balance={data.balance} onTest={() => { setTestKey(newKey.key); document.getElementById("testing")?.scrollIntoView({ behavior: "smooth" }); }} />}

      {data.apis.length < 5 && <CreateApi freeGranted={data.freeGranted} onCreated={(k, id) => { setNewKey({ key: k, apiId: id }); refresh(); }} />}

      {data.apis.length > 0 && <>
        {<WalletCard balance={data.balance} total={data.totalAdded} onBuy={() => setBuyOpen(true)} />}
        {data.apis.map((a) => <ApiSettings key={a.id} api={a} onKey={(k) => setNewKey({ key: k, apiId: a.id })} onChange={refresh} />)}
        <Testing apiKey={testKey} setApiKey={setTestKey} services={[...enabled] as ApiServiceId[]} onDone={refresh} />
        <Connect prefix={api?.key_prefix ?? ""} services={[...enabled] as ApiServiceId[]} />
        <Docs services={[...enabled] as ApiServiceId[]} />
        <Usage requests={data.requests} balance={data.balance} />
      </>}

      {(buyOpen || data.orders.length > 0) && <Buy packages={data.packages} orders={data.orders} balance={data.balance} open={buyOpen} setOpen={setBuyOpen} onChange={refresh} />}
    </div>
  );
}

function CreateApi({ freeGranted, onCreated }: { freeGranted: boolean; onCreated: (key: string, id: string) => void }) {
  const create = useServerFn(createApi);
  const [f, setF] = useState({ name: "", brand: "", website_url: "", description: "" });
  const [services, setServices] = useState<string[]>(["story", "text-to-image"]);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await create({ data: { ...f, services } });
      onCreated(r.api_key, r.id);
      setF({ name: "", brand: "", website_url: "", description: "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message.slice(0, 200) : "Could not create API");
    } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-5 shadow-sm">
      <div>
        <h2 className={h2}>Create Your API</h2>
        <p className="text-sm text-muted-foreground">Create your own API and connect Modern Nova AI generation to your website or application.</p>
      </div>
      {!freeGranted && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="font-display font-bold text-foreground">Start with {fmt(FREE_API_CREDITS)} Free API Credits</p>
          <p className="text-sm text-muted-foreground">Every new API starts with 10,000 free API credits. Use them to test and launch your integration.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {([["name", "API Name", "My AI API"], ["brand", "Brand Name", "My AI Studio"], ["website_url", "Website URL", "https://yourwebsite.com"], ["description", "API Description", "AI generation API for my website"]] as const).map(([k, l, p]) => (
          <label key={k} className="space-y-1.5 text-sm font-semibold text-foreground">
            {l}
            <input className={input} placeholder={p} value={f[k]} maxLength={k === "description" ? 300 : 200} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      <div>
        <h3 className="font-display font-bold text-foreground">Choose Your API Services</h3>
        <p className="mb-3 text-sm text-muted-foreground">Select the AI capabilities you want to make available through your API.</p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {API_SERVICES.map((s) => {
            const on = services.includes(s.id);
            return (
              <button key={s.id} type="button" disabled={!s.available}
                onClick={() => setServices(on ? services.filter((x) => x !== s.id) : [...services, s.id])}
                className={`rounded-2xl border p-3.5 text-left transition disabled:opacity-50 ${on ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground">{s.name}</span>
                  <span className={`h-4 w-4 rounded-md border ${on ? "border-primary bg-primary" : "border-input"}`} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
                <p className="mt-1.5 text-[11px] font-semibold text-primary">{s.available ? `${s.price} credits` : "Coming soon"}</p>
              </button>
            );
          })}
        </div>
      </div>
      <button className={`${btn} w-full py-3.5 text-base`} disabled={busy || services.length === 0} onClick={submit}>
        {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create API"}
      </button>
    </Card>
  );
}

function KeyReady({ apiKey, api, balance, onTest }: { apiKey: string; api?: { name: string; status: string } | undefined; balance: number; onTest: () => void }) {
  return (
    <Card className="space-y-4 border-primary/40 shadow-sm">
      <h2 className={h2}>Your API is Ready</h2>
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat label="API Name" value={api?.name ?? "—"} />
        <Stat label="Status" value={api?.status === "active" ? "Active" : "Disabled"} />
        <Stat label="API Credits" value={fmt(balance)} />
        <Stat label="API Requests" value="0" />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-muted-foreground">API Key</p>
        <div className={`${code} break-all`}>{apiKey}</div>
        <p className="mt-2 text-xs font-semibold text-destructive">Save your API key securely. You won't be able to view the full key again.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={() => copy(apiKey)}><Copy className="h-4 w-4" /> Copy API Key</button>
        <button className={btnOutline} onClick={onTest}>Test API</button>
        <button className={btnOutline} onClick={() => document.getElementById("docs")?.scrollIntoView({ behavior: "smooth" })}>View Documentation</button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 truncate font-bold text-foreground">{value}</p></div>;
}

function WalletCard({ balance, total, onBuy }: { balance: number; total: number; onBuy: () => void }) {
  const used = Math.max(0, total - balance);
  const pct = total ? Math.min(100, (used / total) * 100) : 0;
  return (
    <Card className="shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">API Credits</p>
          <p className="font-display text-2xl font-bold text-foreground">{fmt(balance)}</p>
          <p className="text-xs text-muted-foreground">Usage: {fmt(used)} / {fmt(total)} · separate from your website credits</p>
        </div>
        <button className={btn} onClick={onBuy}>Buy API Credits</button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      {balance < 500 && <p className="mt-2 text-xs font-semibold text-destructive">Low API credits — buy more to keep your integration running.</p>}
    </Card>
  );
}

type ApiRow = { id: string; name: string; brand: string; website_url: string | null; services: string[]; key_prefix: string; status: string; rate_limit_per_min: number };

function ApiSettings({ api, onKey, onChange }: { api: ApiRow; onKey: (k: string) => void; onChange: () => void }) {
  const status = useServerFn(setApiStatus);
  const regen = useServerFn(regenerateApiKey);
  const del = useServerFn(deleteApi);
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); onChange(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <Card className="space-y-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className={h2}>{api.name}</h2>
          <p className="text-xs text-muted-foreground">{api.brand}{api.website_url ? ` · ${api.website_url}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${api.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{api.status === "active" ? "Active" : "Disabled"}</span>
      </div>
      <div className="flex items-center gap-2 text-sm"><KeyRound className="h-4 w-4 text-muted-foreground" /><code className="font-mono text-xs text-foreground">{api.key_prefix}</code></div>
      <p className="text-xs text-muted-foreground">Services: {api.services.map((s) => API_SERVICES.find((x) => x.id === s)?.name ?? s).join(", ")} · Rate limit {api.rate_limit_per_min}/min</p>
      <div className="flex flex-wrap gap-2">
        <button className={btnOutline} disabled={busy} onClick={() => act(() => status({ data: { id: api.id, status: api.status === "active" ? "disabled" : "active" } }))}><Power className="h-4 w-4" /> {api.status === "active" ? "Disable API" : "Enable API"}</button>
        <button className={btnOutline} disabled={busy} onClick={() => confirm("The old key will stop working immediately. Continue?") && act(async () => onKey((await regen({ data: { id: api.id } })).api_key))}><RefreshCw className="h-4 w-4" /> Regenerate Key</button>
        <button className={`${btnOutline} text-destructive`} disabled={busy} onClick={() => confirm("Deleting this API will permanently disable its API key and integrations.") && act(() => del({ data: { id: api.id } }))}><Trash2 className="h-4 w-4" /> Delete API</button>
      </div>
    </Card>
  );
}

type TestResult = { status: number; ms: number; json: Record<string, unknown> };

function Testing({ apiKey, setApiKey, services, onDone }: { apiKey: string; setApiKey: (k: string) => void; services: ApiServiceId[]; onDone: () => void }) {
  const [service, setService] = useState<ApiServiceId>(services[0] ?? "story");
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(1);
  const [style, setStyle] = useState("horror");
  const [language, setLanguage] = useState("Hindi");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TestResult | null>(null);
  const isStory = service === "story";
  const isVoice = service === "story-voice" || service === "text-to-speech";
  const body = useMemo(() => isStory ? { prompt, duration, style, language } : isVoice ? { text: prompt, voice_id: "ZV001" } : { prompt }, [isStory, isVoice, prompt, duration, style, language]);

  const run = async () => {
    setBusy(true); setRes(null);
    const t = performance.now();
    try {
      const r = await fetch(`${API_BASE_PATH}/${service}/generate`, { method: "POST", headers: { Authorization: `Bearer ${apiKey.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await r.json()) as Record<string, unknown>;
      setRes({ status: r.status, ms: performance.now() - t, json });
      onDone();
    } catch (e) {
      setRes({ status: 0, ms: performance.now() - t, json: { success: false, error: "NETWORK_ERROR", message: e instanceof Error ? e.message : "Network error" } });
    } finally { setBusy(false); }
  };

  const display = res ? JSON.stringify(res.json, (k, v) => (k.endsWith("_base64") && typeof v === "string" ? `${v.slice(0, 60)}… (${v.length} chars)` : v), 2) : "";
  const r = res?.json["result"] as { image_base64?: string; audio_base64?: string; content_type?: string } | undefined;

  return (
    <section id="testing"><Card className="space-y-4 shadow-sm">
      <h2 className={h2}>API Testing</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-foreground">Select Service
          <select className={input} value={service} onChange={(e) => setService(e.target.value as ApiServiceId)}>
            {services.map((s) => <option key={s} value={s}>{API_SERVICES.find((x) => x.id === s)?.name}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-foreground">API Key
          <input type="password" autoComplete="off" className={input} placeholder="mnva_live_…" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        </label>
      </div>
      <label className="block space-y-1.5 text-sm font-semibold text-foreground">{isStory ? "Title" : isVoice ? "Text" : "Prompt"}
        <textarea rows={3} className={input} maxLength={isStory ? 300 : 4000} placeholder="Enter your prompt..." value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      </label>
      {isStory && (
        <div className="grid grid-cols-3 gap-3">
          <select className={input} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>{i + 1} min</option>)}</select>
          <select className={input} value={style} onChange={(e) => setStyle(e.target.value)}><option value="horror">Horror</option><option value="moral">Moral</option></select>
          <select className={input} value={language} onChange={(e) => setLanguage(e.target.value)}><option>Hindi</option><option>English</option></select>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button className={btn} disabled={busy || !apiKey || !prompt.trim()} onClick={run}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : "Test API"}</button>
        <span className="text-xs text-muted-foreground">Estimated cost: {fmt(apiCost(service, body))} API credits</span>
      </div>
      {res && (
        <div className="space-y-3">
          <h3 className="font-display font-bold text-foreground">API Response</h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Stat label="Status" value={`${res.status} ${res.status === 200 ? "OK" : String(res.json["error"] ?? "")}`} />
            <Stat label="Response Time" value={`${(res.ms / 1000).toFixed(2)}s`} />
            <Stat label="Credits Used" value={fmt(Number(res.json["credits_used"] ?? 0))} />
            <Stat label="Remaining API Credits" value={res.json["remaining_credits"] !== undefined ? fmt(Number(res.json["remaining_credits"])) : "—"} />
          </div>
          {r?.image_base64 && <img src={`data:image/png;base64,${r.image_base64}`} alt="API result" className="max-h-80 rounded-2xl border border-border" />}
          {r?.audio_base64 && <audio controls src={`data:${r.content_type ?? "audio/wav"};base64,${r.audio_base64}`} className="w-full" />}
          <pre className={code}>{display}</pre>
        </div>
      )}
    </Card></section>
  );
}

function example(s: ApiServiceId) {
  return `curl -X POST ${BASE}/${s}/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(EXAMPLES[s] ?? {})}'`;
}

function Connect({ prefix, services }: { prefix: string; services: ApiServiceId[] }) {
  return (
    <Card className="space-y-3 shadow-sm">
      <h2 className={h2}>Connect Your Website</h2>
      <p className="text-sm text-muted-foreground">Use your API on your own website, web app or application. Call it from your server so your key stays private.</p>
      <Field label="API Base URL" value={BASE} />
      <Field label="API Key" value={prefix} noCopy />
      <Field label="Authentication" value="Authorization: Bearer YOUR_API_KEY" />
      {services.map((s) => (
        <div key={s}>
          <p className="mb-1 text-xs font-semibold text-muted-foreground">Example Request — {API_SERVICES.find((x) => x.id === s)?.name}</p>
          <pre className={code}>{example(s)}</pre>
        </div>
      ))}
    </Card>
  );
}

function Field({ label, value, noCopy }: { label: string; value: string; noCopy?: boolean }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">{value}</code>
        {!noCopy && <button aria-label={`Copy ${label}`} onClick={() => copy(value)}><Copy className="h-4 w-4 text-muted-foreground" /></button>}
      </div>
    </div>
  );
}

const DOC_TABS = ["Authentication", "Endpoints", "Request", "Response", "Errors", "Examples"] as const;
const ERRORS: [number, string, string][] = [
  [400, "INVALID_REQUEST", "Missing or invalid fields"], [401, "INVALID_API_KEY", "Key missing, wrong or revoked"],
  [402, "INSUFFICIENT_API_CREDITS", "Not enough API credits"], [403, "API_DISABLED / SERVICE_NOT_ENABLED", "API disabled or service not enabled"],
  [429, "RATE_LIMIT_EXCEEDED", "Too many requests per minute"], [502, "GENERATION_FAILED", "Engine failed — credits refunded"],
];

function Docs({ services }: { services: ApiServiceId[] }) {
  const [tab, setTab] = useState<(typeof DOC_TABS)[number]>("Authentication");
  return (
    <section id="docs"><Card className="space-y-4 shadow-sm">
      <h2 className={`${h2} flex items-center gap-2`}><Code2 className="h-5 w-5 text-primary" /> API Documentation</h2>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DOC_TABS.map((t) => <button key={t} onClick={() => setTab(t)} className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>{t}</button>)}
      </div>
      {tab === "Authentication" && <div className="space-y-2 text-sm text-muted-foreground"><p>Send your key in the Authorization header on every request. Never put it in a URL or in browser code.</p><pre className={code}>Authorization: Bearer YOUR_API_KEY</pre></div>}
      {tab === "Endpoints" && <div className="space-y-2">{services.map((s) => <div key={s} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border p-3 text-sm"><span className="rounded-lg bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">POST</span><code className="font-mono text-xs text-foreground">/v1/{s}/generate</code><span className="text-xs text-muted-foreground">· {API_SERVICES.find((x) => x.id === s)?.price} credits</span></div>)}</div>}
      {tab === "Request" && services.map((s) => <div key={s}><p className="mb-1 text-xs font-semibold text-muted-foreground">POST /v1/{s}/generate</p><pre className={code}>{JSON.stringify(EXAMPLES[s] ?? {}, null, 2)}</pre></div>)}
      {tab === "Response" && <pre className={code}>{`{\n  "success": true,\n  "request_id": "req_…",\n  "result": "…",\n  "credits_used": 100,\n  "remaining_credits": 9900\n}\n\n// Image services: result = { image_base64, width, height }\n// Voice services: result = { audio_base64, content_type, voice_id }`}</pre>}
      {tab === "Errors" && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{ERRORS.map(([c, e, d]) => <tr key={e} className="border-b border-border last:border-0"><td className="py-2 pr-3 font-mono text-xs font-bold text-foreground">{c}</td><td className="py-2 pr-3 font-mono text-xs text-foreground">{e}</td><td className="py-2 text-muted-foreground">{d}</td></tr>)}</tbody></table><pre className={`${code} mt-3`}>{`{ "success": false, "error": "INSUFFICIENT_API_CREDITS" }`}</pre></div>}
      {tab === "Examples" && services.map((s) => <pre key={s} className={code}>{`// Node.js (server side)\nconst res = await fetch("${BASE}/${s}/generate", {\n  method: "POST",\n  headers: { Authorization: \`Bearer \${process.env.MODERN_NOVA_API_KEY}\`, "Content-Type": "application/json" },\n  body: JSON.stringify(${JSON.stringify(EXAMPLES[s] ?? {})}),\n});\nconst data = await res.json();`}</pre>)}
    </Card></section>
  );
}

type Req = { service: string; status_code: number; credits_used: number; created_at: string };

function Usage({ requests, balance }: { requests: Req[]; balance: number }) {
  const ok = requests.filter((r) => r.status_code === 200);
  const used = ok.reduce((a, r) => a + r.credits_used, 0);
  const rows = useMemo(() => {
    const m = new Map<string, { date: string; service: string; requests: number; credits: number; ok: number }>();
    for (const r of requests) {
      const date = new Date(r.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
      const k = `${date}|${r.service}`;
      const row = m.get(k) ?? { date, service: r.service, requests: 0, credits: 0, ok: 0 };
      row.requests++; row.credits += r.credits_used; if (r.status_code === 200) row.ok++;
      m.set(k, row);
    }
    return [...m.values()];
  }, [requests]);
  return (
    <Card className="space-y-4 shadow-sm">
      <h2 className={h2}>API Usage</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Requests" value={fmt(requests.length)} />
        <Stat label="Credits Used" value={fmt(used)} />
        <Stat label="Credits Remaining" value={fmt(balance)} />
        <Stat label="Success Rate" value={requests.length ? `${Math.round((ok.length / requests.length) * 100)}%` : "—"} />
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No requests yet.</p> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr><th className="py-2">Date</th><th>Service</th><th>Requests</th><th>Credits Used</th><th>Status</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.date + r.service} className="border-t border-border"><td className="py-2">{r.date}</td><td>{API_SERVICES.find((x) => x.id === r.service)?.name ?? r.service}</td><td>{r.requests}</td><td>{fmt(r.credits)}</td><td>{r.ok}/{r.requests} OK</td></tr>)}</tbody>
        </table></div>
      )}
    </Card>
  );
}

type Pkg = { id: string; name: string; credits: number; price_inr: number | null; description: string; is_custom: boolean };
type Order = { id: string; credits: number; amount_inr: number; status: string; created_at: string };

function Buy({ packages, orders, balance, open, setOpen, onChange }: { packages: Pkg[]; orders: Order[]; balance: number; open: boolean; setOpen: (b: boolean) => void; onChange: () => void }) {
  const createOrder = useServerFn(createApiCreditOrder);
  const submit = useServerFn(submitApiOrderUtr);
  const [pending, setPending] = useState<{ order_id: string; ref: string; credits: number; amount: number; upi_link: string } | null>(null);
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = async (p: Pkg) => {
    if (p.is_custom) { window.location.href = "mailto:MODERNNOVAAI@gmail.com?subject=Custom%20API%20credits"; return; }
    setBusy(true);
    try { setPending(await createOrder({ data: { package_id: p.id } })); setTimeout(() => document.getElementById("buy")?.scrollIntoView({ behavior: "smooth" }), 50); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!pending) return;
    setBusy(true);
    try { await submit({ data: { order_id: pending.order_id, utr } }); toast.success("Submitted. Credits are added after the payment is confirmed."); setPending(null); setUtr(""); onChange(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <section id="buy"><Card className="space-y-4 shadow-sm">
      <div className="flex items-center justify-between"><h2 className={h2}>Buy API Credits</h2>{!open && <button className={btnOutline} onClick={() => setOpen(true)}>Show packages</button>}</div>
      {open && !pending && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {packages.map((p) => (
            <button key={p.id} disabled={busy} onClick={() => pick(p)} className="rounded-2xl border border-border p-4 text-left transition hover:border-primary">
              <p className="font-display font-bold text-foreground">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.description}</p>
              <p className="mt-2 text-lg font-bold text-primary">{p.is_custom ? "Contact us" : `₹${fmt(p.price_inr ?? 0)}`}</p>
            </button>
          ))}
        </div>
      )}
      {pending && (
        <div className="space-y-3 rounded-2xl border border-primary/30 p-4">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Current API Wallet" value={fmt(balance)} />
            <Stat label="Purchase" value={fmt(pending.credits)} />
            <Stat label="New Balance" value={fmt(balance + pending.credits)} />
          </div>
          <a href={pending.upi_link} className={`${btn} w-full`}>Pay ₹{fmt(pending.amount)} with UPI</a>
          <p className="text-xs text-muted-foreground">Order {pending.ref}. After paying, enter the 12-digit UTR. Credits are added only after the payment is confirmed.</p>
          <div className="flex gap-2">
            <input className={input} inputMode="numeric" maxLength={12} placeholder="12-digit UTR" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} />
            <button className={btn} disabled={busy || utr.length !== 12} onClick={send}>Submit</button>
          </div>
        </div>
      )}
      {orders.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Recent orders</p>
          {orders.map((o) => <div key={o.id} className="flex justify-between rounded-xl border border-border px-3 py-2 text-xs"><span>{fmt(o.credits)} credits · ₹{fmt(o.amount_inr)}</span><span className="font-bold capitalize text-foreground">{o.status === "submitted" ? "awaiting confirmation" : o.status}</span></div>)}
        </div>
      )}
    </Card></section>
  );
}
