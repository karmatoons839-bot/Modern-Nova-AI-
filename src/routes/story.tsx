import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Copy, FileText, Loader2, Mic, Pencil, RefreshCw, Save, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authHeaders, useAuth, useRefreshProfile } from "@/lib/auth";
import { SCRIPT_LANGUAGES, SCRIPT_TYPES, type ScriptType } from "@/lib/script-config";
import { toast } from "sonner";

export const Route = createFileRoute("/story")({
  staticData: { sitemap: true },
  head: () => ({ meta: [
    { title: "Script Studio — Modern Nova AI" },
    { name: "description", content: "Create original horror and moral scripts with your own brief, language and duration in Modern Nova AI Script Studio." },
    { property: "og:title", content: "Script Studio — Modern Nova AI" },
    { property: "og:description", content: "Write, edit and save scripts in your selected language, ready for Voice Studio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ScriptStudio,
});

type RequestSettings = { title: string; description: string; language: string; minutes: number; type: ScriptType };
const field = "w-full min-w-0 rounded-lg border border-input bg-background px-3.5 py-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function ScriptStudio() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const refreshProfile = useRefreshProfile();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ScriptType>("horror");
  const [language, setLanguage] = useState("Hindi");
  const [minutes, setMinutes] = useState(5);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [search, setSearch] = useState("");
  const languageRef = useRef<HTMLDivElement>(null);
  const [script, setScript] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastRequest, setLastRequest] = useState<RequestSettings | null>(null);
  const results = SCRIPT_LANGUAGES.filter((l) => `${l.name} ${l.native}`.toLowerCase().includes(search.toLowerCase()));
  const dialect = SCRIPT_LANGUAGES.find((l) => l.name === language);
  const experimental = dialect && "experimental" in dialect;
  const valid = title.trim().length >= 2 && title.length <= 300 && description.trim().length >= 2;
  const cost = 500 + (minutes - 1) * 200;

  useEffect(() => {
    if (!languageOpen) return;
    const close = (event: MouseEvent) => { if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [languageOpen]);

  async function generate(settings: RequestSettings) {
    setBusy(true); setError(null);
    try {
      const body = { story_type: settings.type, ...(settings.type === "horror" ? { topic: settings.title } : { title: settings.title }), description: settings.description, language: settings.language, minutes: settings.minutes };
      const response = await fetch("/api/story", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || `Script generation returned ${response.status}.`);
      if (typeof data.story !== "string" || !data.story.trim()) throw new Error("No script was returned. Please try again.");
      setScript(data.story); setLastRequest(settings); setEditing(false);
      toast.success("Script generated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Script generation failed."); }
    finally { setBusy(false); void refreshProfile(); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(editing ? draft : script); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { toast.error("Could not copy the script."); }
  }
  function save() {
    const text = editing ? draft : script;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `${(lastRequest?.title || "script").replace(/[^\p{L}\p{N}\s_-]/gu, "").slice(0, 80) || "script"}.txt`; link.click(); URL.revokeObjectURL(url);
    toast.success("Script saved as a text file.");
  }
  function sendToVoice() { sessionStorage.setItem("mn-story-to-voice", script); void navigate({ to: "/studio" }); }

  return <div className="mx-auto max-w-6xl">
    <header className="border-b border-border pb-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary"><FileText className="h-4 w-4" />Modern Nova AI</div>
      <h1 className="font-display text-3xl font-bold text-foreground">Script Studio</h1>
    </header>
    <div className="grid items-start gap-8 pt-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
      <form className="min-w-0 space-y-5" onSubmit={(e) => { e.preventDefault(); if (session && valid) void generate({ title, description, language, minutes, type }); }}>
        <label className="block text-sm font-semibold">Script Title<input required maxLength={300} className={`${field} mt-2`} placeholder="The last train home" value={title} disabled={busy} onChange={(e) => setTitle(e.target.value)} /></label>
        <label className="block text-sm font-semibold">Describe Your Script<textarea required maxLength={20000} className={`${field} mt-2 min-h-36 resize-y leading-relaxed`} placeholder="Your idea, characters, setting and what happens…" value={description} disabled={busy} onChange={(e) => setDescription(e.target.value)} /></label>
        <div ref={languageRef} className="relative">
          <p id="script-language-label" className="text-sm font-semibold">Language</p>
          <Button type="button" variant="outline" aria-labelledby="script-language-label" aria-haspopup="listbox" aria-expanded={languageOpen} disabled={busy} className="mt-2 h-12 w-full justify-between rounded-lg" onClick={() => { setLanguageOpen(!languageOpen); setSearch(""); }}>{language}<ChevronDown /></Button>
          {languageOpen && <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-border bg-popover p-2 shadow-lg" onKeyDown={(e) => { if (e.key === "Escape") setLanguageOpen(false); }}>
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input autoFocus aria-label="Search languages" className={`${field} py-2.5 pl-9`} placeholder="Search languages…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <div role="listbox" aria-label="Script languages" className="mt-2 max-h-56 overflow-auto">
              {results.map((l) => <Button type="button" role="option" aria-selected={language === l.name} variant="ghost" key={l.name} className="h-10 w-full justify-start" onClick={() => { setLanguage(l.name); setLanguageOpen(false); }}>{l.name}<span className="text-muted-foreground">{l.native}</span>{language === l.name && <Check className="ml-auto" />}</Button>)}
              {!results.length && <p role="status" className="px-2 py-3 text-sm text-muted-foreground">This language is not available. Choose a listed language.</p>}
            </div>
          </div>}
          {experimental && <p className="mt-2 text-xs text-muted-foreground">Regional dialect output is experimental. Please review it before use.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block min-w-0 text-sm font-semibold">Script type<select aria-label="Script type" className={`${field} mt-2`} disabled={busy} value={type} onChange={(e) => { if (e.target.value === "horror" || e.target.value === "moral") setType(e.target.value); }}>{SCRIPT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="block min-w-0 text-sm font-semibold">Length<select aria-label="Length" className={`${field} mt-2`} disabled={busy} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m} minute{m === 1 ? "" : "s"}</option>)}</select></label>
        </div>
        <div className="border-t border-border pt-4"><p className="mb-3 text-sm text-muted-foreground">{cost} credits</p>{session ? <Button type="submit" disabled={!valid || busy} className="h-12 w-full rounded-lg font-semibold">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? "Writing your script…" : "Generate Script"}</Button> : <Button asChild className="h-12 w-full"><Link to="/auth">Log in to generate</Link></Button>}</div>
        {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      </form>
      <section aria-label="Generated script" className="min-w-0 border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Your script</h2>{lastRequest && <span className="text-xs text-muted-foreground">{lastRequest.language} · {lastRequest.minutes} min</span>}</div>
        {script ? <>
          <div className="mt-4 flex flex-wrap gap-1 border-y border-border py-2">
            <Button variant="ghost" title="Copy script" disabled={busy} onClick={() => void copy()}><Copy />{copied ? "Copied" : "Copy"}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => { if (editing) { setScript(draft); setEditing(false); } else { setDraft(script); setEditing(true); } }}>{editing ? <Check /> : <Pencil />}{editing ? "Apply edits" : "Edit"}</Button>
            <Button variant="ghost" disabled={busy} onClick={save}><Save />Save</Button>
            <Button variant="ghost" disabled={busy || !lastRequest} onClick={() => { if (lastRequest) void generate(lastRequest); }}><RefreshCw />Regenerate</Button>
          </div>
          {editing ? <textarea aria-label="Edit script" className={`${field} mt-5 min-h-[480px] resize-y leading-relaxed`} value={draft} onChange={(e) => setDraft(e.target.value)} /> : <article className="mt-5 whitespace-pre-wrap break-words text-base leading-8 text-foreground">{script}</article>}
          <Button variant="outline" disabled={busy || editing} className="mt-6" onClick={sendToVoice}><Mic />Open in Voice Studio</Button>
        </> : <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground lg:min-h-[420px]" aria-live="polite">{busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileText className="h-9 w-9 opacity-40" />}<p className="text-sm">{busy ? "Writing your script…" : "No script yet"}</p></div>}
      </section>
    </div>
  </div>;
}
