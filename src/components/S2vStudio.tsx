import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Download, Film, Loader2, Play, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { authHeaders, useAuth, useProfile } from "@/lib/auth";
import { studioAction } from "@/lib/s2v-studio.functions";
import { supabase } from "@/integrations/supabase/client";
import { STUDIO_STYLES, studioSchema, currentTasks, isCurrentTask, type StudioData, type StudioProject, type StudioTask } from "@/lib/s2v-studio";
import { continuationTasks, planVideo, SEGMENT_STRIDE } from "@/lib/s2v-timing";
import { SCRIPT_LANGUAGES } from "@/lib/script-config";
import type { VoiceProfile } from "@/lib/voice-types";
import { StyleArt } from "@/components/ToolArt";

const field = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const number = (n: number) => n.toLocaleString("en-IN");
const ACTIVE = ["queued", "running", "remote", "review", "paused"];
const duration = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`;
type Kind = "background" | "character" | "frame" | "animation" | "voice";

function Access({ children }: { children: React.ReactNode }) {
  const { session, ready } = useAuth(); const { isLoading } = useProfile();
  if (!ready || (session && isLoading)) return <p className="py-16 text-center text-muted-foreground">Loading…</p>;
  if (!session) return <div className="py-16 text-center"><h1 className="font-display text-3xl font-bold">Script to Video</h1><p className="my-4 text-muted-foreground">Sign in to turn your script into a video.</p><Button asChild><Link to="/auth">Sign in</Link></Button></div>;
  return <>{children}</>;
}
function Title({ sub }: { sub?: string }) {
  return <header className="mb-6 text-center sm:mb-8"><p className="text-xs font-semibold tracking-[0.2em] text-primary">MODERN NOVA AI</p><h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl">Script to Video</h1>{sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}</header>;
}

/* ---------- Screen 1 (new project) ---------- */
export function S2vStudioHome() { return <Access><StudioHome /></Access>; }
function StudioHome() {
  const call = useServerFn(studioAction), nav = useNavigate();
  const q = useQuery({ queryKey: ["s2v-studio-list"], queryFn: () => call({ data: { action: "list" } }) });
  const [script, setScript] = useState(""), [language, setLanguage] = useState("Hindi"), [busy, setBusy] = useState(false);
  async function analyze() {
    setBusy(true);
    try {
      const title = script.trim().split("\n")[0]?.replace(/^(title|शीर्षक)\s*[:：-]\s*/i, "").slice(0, 80) || "Untitled story";
      const r = await call({ data: { action: "create", requestKey: crypto.randomUUID(), title, script, data: studioSchema.parse({ language }) } });
      if (!("id" in r) || !r.id) throw new Error("Could not save script");
      await call({ data: { action: "analyze", id: r.id } });
      await nav({ to: "/script-video-studio/$id/$step", params: { id: r.id, step: "2" } });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Analysis failed"); } finally { setBusy(false); }
  }
  const projects = q.data && "projects" in q.data ? q.data.projects : [];
  return <div className="mx-auto max-w-3xl">
    <Title />
    <ScriptBox script={script} setScript={setScript} language={language} setLanguage={setLanguage} busy={busy} onAnalyze={analyze} />
    {!!projects?.length && <details className="mt-8 rounded-lg border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Your videos ({projects.length})</summary><ul className="mt-3 divide-y divide-border">{projects.map(p => <li key={p.id}><Link to="/script-video-studio/$id/$step" params={{ id: p.id, step: p.status === "draft" ? "2" : "3" }} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary"><span className="truncate">{p.title || "Untitled story"}</span><span className="shrink-0 text-xs text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString("en-IN")}</span></Link></li>)}</ul></details>}
  </div>;
}
function ScriptBox({ script, setScript, language, setLanguage, busy, onAnalyze, disabled }: { script: string; setScript: (s: string) => void; language: string; setLanguage: (s: string) => void; busy: boolean; onAnalyze: () => void; disabled?: boolean }) {
  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
    <label className="block text-sm font-semibold" htmlFor="s2v-script">Paste your script</label>
    <textarea id="s2v-script" rows={14} maxLength={100000} disabled={disabled || busy} value={script} onChange={e => setScript(e.target.value)} placeholder="Paste the script you created in Script Generator…" className={`${field} min-h-[45vh] resize-y leading-7`} />
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground"><select aria-label="Script language" className="rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" value={language} disabled={disabled || busy} onChange={e => setLanguage(e.target.value)}>{SCRIPT_LANGUAGES.map(l => <option key={l.name}>{l.name}</option>)}</select><span>{number(words)} words</span></div>
      {script.trim().length >= 20 && <Button size="lg" disabled={busy || disabled} onClick={onAnalyze} className="w-full sm:w-auto">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />}{busy ? "AI analyzing story — scenes, characters, locations…" : "Analyze · FREE"}</Button>}
    </div>
  </section>;
}

/* ---------- Existing project: screens 1–3 ---------- */
export function S2vStudioPage({ id, step }: { id: string; step: number }) { return <Access><StudioProjectPage id={id} step={step} /></Access>; }

function StudioProjectPage({ id, step: rawStep }: { id: string; step: number }) {
  const step = rawStep >= 3 ? 3 : rawStep < 1 ? 1 : rawStep;
  const call = useServerFn(studioAction), qc = useQueryClient(), nav = useNavigate();
  const { data: profile } = useProfile();
  const q = useQuery({ queryKey: ["s2v-studio", id], queryFn: () => call({ data: { action: "load", id } }), refetchInterval: step === 3 ? 4000 : false });
  const p = q.data && "project" in q.data ? q.data.project : undefined;
  const rates = q.data && "rates" in q.data ? q.data.rates : undefined;
  const [d, setD] = useState<StudioData | null>(null), [script, setScript] = useState(""), [busy, setBusy] = useState(false);
  const loadedFor = useRef("");
  useEffect(() => { if (p && loadedFor.current !== `${p.id}:${p.updatedAt}` && !busy) { loadedFor.current = `${p.id}:${p.updatedAt}`; setD(p.data); setScript(p.script); } }, [p, busy]);
  useEffect(() => { if (rawStep !== step) void nav({ to: "/script-video-studio/$id/$step", params: { id, step: String(step) }, replace: true }); }, [rawStep, step, id, nav]);

  async function persist(next: StudioData, nextScript = script) {
    if (!p) return false;
    await call({ data: { action: "save", id, script: nextScript, data: next, expectedUpdatedAt: p.updatedAt } });
    const r = await q.refetch(); const fresh = r.data && "project" in r.data ? r.data.project : undefined;
    if (fresh) { loadedFor.current = `${fresh.id}:${fresh.updatedAt}`; setD(fresh.data); setScript(fresh.script); }
    return true;
  }
  const go = (n: number) => nav({ to: "/script-video-studio/$id/$step", params: { id, step: String(n) } });

  if (q.error) return <div className="py-12 text-center"><p role="alert" className="text-destructive">{q.error.message}</p><Button className="mt-4" variant="outline" onClick={() => q.refetch()}>Retry</Button></div>;
  if (!p || !d || !rates) return <p className="py-16 text-center text-muted-foreground"><Loader2 className="mr-2 inline size-4 animate-spin" />Loading…</p>;
  const analysisValid = d.scenes.length > 0 && d.analyzedRevision === d.revision;
  const tasks = currentTasks(d, p.tasks);
  const active = tasks.some(t => ACTIVE.includes(t.status));

  if (step === 1 || (step === 2 && !analysisValid)) {
    const analyze = async () => {
      setBusy(true);
      try { if (script !== p.script || d.language !== p.data.language) await persist(d, script); await call({ data: { action: "analyze", id } }); await q.refetch(); await go(2); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Analysis failed"); } finally { setBusy(false); }
    };
    return <div className="mx-auto max-w-3xl"><Title /><ScriptBox script={script} setScript={setScript} language={d.language} setLanguage={l => setD({ ...d, language: l })} busy={busy} disabled={active} onAnalyze={analyze} />{active && <p className="mt-3 text-center text-sm text-muted-foreground">This video is generating. <Link to="/script-video-studio/$id/$step" params={{ id, step: "3" }} className="font-semibold text-primary">View progress</Link></p>}</div>;
  }
  if (step === 2) return <SettingsScreen p={p} d={d} setD={setD} rates={rates} tasks={tasks} active={active} profile={profile} busy={busy} setBusy={setBusy} persist={persist} go={go} />;
  return <ProgressScreen p={p} d={d} rates={rates} tasks={tasks} active={active} call={call} refetch={async () => { await q.refetch(); await qc.invalidateQueries({ queryKey: ["profile"] }); }} go={go} />;
}

type Rates = { image: number; character: number; voicePerMinute: number; anim5: number; anim10: number; render: number };
type Profile = { credits?: number; is_admin?: boolean } | null | undefined;
function doneCounts(d: StudioData, tasks: StudioTask[]) {
  const n = (k: string) => tasks.filter(t => t.kind === k && t.status === "completed" && t.target < SEGMENT_STRIDE).length;
  return { backgrounds: n("background"), characters: n("character"), frames: n("frame"), clips: n("animation"), voices: d.voiceOn ? n("voice") : 0 };
}

/* ---------- Screen 2 ---------- */
function SettingsScreen({ p, d, setD, rates, tasks, active, profile, busy, setBusy, persist, go }: { p: StudioProject; d: StudioData; setD: (d: StudioData) => void; rates: Rates; tasks: StudioTask[]; active: boolean; profile: Profile; busy: boolean; setBusy: (b: boolean) => void; persist: (d: StudioData) => Promise<boolean>; go: (n: number) => Promise<void> }) {
  const plan = planVideo(d, rates, doneCounts(d, tasks));
  const full = planVideo(d, rates);
  const words = p.script.trim().split(/\s+/).filter(Boolean).length;
  const voices = useQuery({ queryKey: ["s2v-voice-options"], enabled: d.voiceOn, queryFn: async () => { const r = await fetch("/api/voice-library?limit=400", { headers: await authHeaders() }); const data = await r.json() as { voices?: VoiceProfile[] }; if (!r.ok) throw new Error("Voice library unavailable"); return data.voices ?? []; } });
  const voiceList = (voices.data ?? []).filter(v => v.engineConnected !== false);
  const [sample, setSample] = useState<string | null>(null);
  useEffect(() => () => { if (sample) URL.revokeObjectURL(sample); }, [sample]);
  const set = (v: Partial<StudioData>) => setD({ ...d, ...v });
  const credits = profile?.credits ?? 0, enough = credits >= plan.cost.total;
  const ready = d.styleChosen && (!d.voiceOn || Boolean(d.narratorVoice));
  async function preview(voiceId: string) {
    setBusy(true);
    try { const text = (d.scenes.flatMap(s => s.lines).find(l => l.text)?.text ?? "Hello").slice(0, 180); const r = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json", ...await authHeaders() }, body: JSON.stringify({ voiceId, text, emotion: d.emotion, preview: true }) }); if (!r.ok) { const e = await r.json() as { message?: string }; throw new Error(e.message || "Voice preview failed"); } setSample(URL.createObjectURL(await r.blob())); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed"); } finally { setBusy(false); }
  }
  async function generate() {
    if (!enough) { toast.error(`You need ${number(plan.cost.total)} credits; you have ${number(credits)}.`); return; }
    if (!window.confirm(`Generate this video for about ${number(plan.cost.total)} credits?\n\nImages ${number(plan.cost.images)} · Animation ${number(plan.cost.animation)} · Voiceover ${number(plan.cost.voice)} · Rendering ${number(plan.cost.render)}\n\nEach step is charged only when it runs; failed steps are refunded.`)) return;
    setBusy(true);
    try { await persist({ ...d, autoRevision: d.revision, budget: plan.cost.total, startedAt: new Date().toISOString() }); await go(3); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not start"); } finally { setBusy(false); }
  }
  const stats: [string, string][] = [["Story length", `${number(words)} words`], ["Video length", `~${duration(full.videoSeconds)}`], ["Scenes", String(full.scenes)], ["Animation clips", String(full.clips)], ["Characters", String(full.characters)], ["Images / backgrounds", String(full.imagesNeeded)], ["Voiceover", d.voiceOn ? `~${duration(full.voiceSeconds)}` : "Off"], ["Animation", duration(full.animationSeconds)], ["Estimated credits", number(plan.cost.total)]];
  return <div className="mx-auto max-w-4xl space-y-8">
    <div className="flex items-center justify-between gap-3"><Button variant="ghost" size="sm" onClick={() => go(1)} disabled={busy}><ArrowLeft />Edit script</Button>{active && <Button size="sm" variant="outline" onClick={() => go(3)}>View progress</Button>}</div>
    <Title sub={p.title} />
    <section aria-labelledby="analysis"><h2 id="analysis" className="mb-3 font-display text-lg font-semibold">Story analysis</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">{stats.map(([k, v], i) => <div key={k} className={`bg-card p-4 ${i === stats.length - 1 ? "col-span-2 sm:col-span-3" : ""}`}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-display text-lg font-semibold">{v}</dd></div>)}</dl>
    </section>
    <section aria-labelledby="style"><h2 id="style" className="mb-3 font-display text-lg font-semibold">Animation style</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{STUDIO_STYLES.map(s => { const on = d.styleChosen && d.style === s.id; return <button key={s.id} type="button" disabled={active || busy} onClick={() => set({ style: s.id, styleChosen: true })} aria-pressed={on} className={`group relative overflow-hidden rounded-xl border-2 bg-card text-left transition ${on ? "border-primary shadow-md" : "border-border hover:border-primary/50"}`}><StyleArt id={s.id} /><div className="p-3"><p className="text-sm font-semibold">{s.name}</p><p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">{s.description}</p></div>{on && <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground"><Check className="size-4" /></span>}</button>; })}</div>
    </section>
    {d.styleChosen && <>
      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <label className="flex items-center justify-between gap-3"><span><span className="block font-semibold">Voiceover</span><span className="text-sm text-muted-foreground">{d.voiceOn ? "Every narration and dialogue line is voiced; extra moving clips cover long lines." : "No voice is generated or charged."}</span></span><Switch checked={d.voiceOn} disabled={active || busy} onCheckedChange={v => set({ voiceOn: v })} aria-label="Voiceover" /></label>
        {d.voiceOn && <div className="space-y-3 border-t border-border pt-4">
          {voices.error && <p role="alert" className="text-sm text-destructive">{voices.error.message}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="flex-1 text-sm font-medium">Narrator voice<select className={field} value={d.narratorVoice} onChange={e => set({ narratorVoice: e.target.value })}><option value="">{voices.isPending ? "Loading voices…" : "Choose voice"}</option>{voiceList.map(v => <option key={v.voiceId} value={v.voiceId}>{v.displayName || v.name} · {v.gender} · {v.age}</option>)}</select></label><Button variant="outline" disabled={busy || !d.narratorVoice} onClick={() => preview(d.narratorVoice)}><Play />Preview · FREE</Button></div>
          {!!d.characters.length && <details><summary className="cursor-pointer text-sm font-medium">Character voices (optional)</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{d.characters.map(c => <label key={c.name} className="text-sm">{c.name}<select className={field} value={d.voiceAssignments[c.name] ?? ""} onChange={e => set({ voiceAssignments: { ...d.voiceAssignments, [c.name]: e.target.value } })}><option value="">Use narrator</option>{voiceList.map(v => <option key={v.voiceId} value={v.voiceId}>{v.displayName || v.name} · {v.gender}</option>)}</select></label>)}</div></details>}
          {sample && <audio controls autoPlay src={sample} className="w-full" />}
        </div>}
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-4"><label className="text-sm font-medium">Clip length<select className={field} value={d.clipSeconds} disabled={active || busy} onChange={e => set({ clipSeconds: studioSchema.shape.clipSeconds.parse(Number(e.target.value)) })}><option value={5}>5 seconds</option><option value={10}>10 seconds</option></select></label><label className="text-sm font-medium">Format<select className={field} value={d.aspect} disabled={active || busy} onChange={e => set({ aspect: studioSchema.shape.aspect.parse(e.target.value) })}><option value="16:9">16:9 Landscape</option><option value="9:16">9:16 Portrait</option></select></label></div>
      </section>
      <section aria-labelledby="credits" className="rounded-xl border border-border bg-card p-4 sm:p-6"><h2 id="credits" className="mb-2 font-display text-lg font-semibold">Credit breakdown</h2>
        <div className="divide-y divide-border text-sm">{([["Analysis", "FREE"], [`Images (${plan.imagesNeeded})`, number(plan.cost.images)], [`Animation (${plan.clips} clips · ${duration(plan.animationSeconds)})`, number(plan.cost.animation)], ["Voiceover", d.voiceOn ? number(plan.cost.voice) : "Off · 0"], ["Final rendering", number(plan.cost.render)]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-4 py-2.5"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>)}
          <div className="flex justify-between gap-4 pt-3 text-base font-bold"><span>Total credits required</span><span>{number(plan.cost.total)}</span></div></div>
        <p className="mt-3 text-xs text-muted-foreground">Rates: image {rates.image} · character {rates.character} · 5s clip {number(rates.anim5)} · 10s clip {number(rates.anim10)} · render {rates.render}. Already-generated items are not charged again. Your balance: {number(credits)}.</p>
        {d.voiceOn && plan.extraClips > 0 && <p className="mt-1 text-xs text-muted-foreground">Includes {plan.extraClips} extra moving clip(s) estimated for long voice lines; the exact count is checked after the voice is made.</p>}
      </section>
      <div className="sticky bottom-3 z-10">
        {!enough && <p role="alert" className="mb-2 text-center text-sm text-destructive">Not enough credits. <Link to="/pricing" className="font-semibold underline">Get credits</Link></p>}
        {d.voiceOn && !d.narratorVoice && <p className="mb-2 text-center text-sm text-muted-foreground">Choose a narrator voice to continue.</p>}
        <Button size="lg" className="w-full shadow-lg" disabled={!ready || busy || active || !enough} onClick={generate}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}Generate Video · {number(plan.cost.total)} credits</Button>
      </div>
    </>}
  </div>;
}

/* ---------- Screen 3 ---------- */
type Call = ReturnType<typeof useServerFn<typeof studioAction>>;
function ProgressScreen({ p, d, rates, tasks, active, call, refetch, go }: { p: StudioProject; d: StudioData; rates: Rates; tasks: StudioTask[]; active: boolean; call: Call; refetch: () => Promise<void>; go: (n: number) => Promise<void> }) {
  const running = d.autoRevision === d.revision;
  const [error, setError] = useState<string | null>(null), [renderMsg, setRenderMsg] = useState<string | null>(null), [stopped, setStopped] = useState(false);
  const stepping = useRef(false), checked = useRef(new Set<string>()), [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t); }, []);
  const find = (k: string, i: number) => tasks.find(t => t.kind === k && t.target === i);
  const ok = (k: string, i: number) => find(k, i)?.status === "completed";
  const takes = (k: string, i: number) => p.tasks.filter(t => t.kind === k && t.target === i && isCurrentTask(d, t)).length;
  const voiced = (i: number) => d.voiceOn && Boolean(d.scenes[i]?.lines.some(l => l.text.trim()));
  const spent = p.tasks.filter(t => isCurrentTask(d, t) && t.status !== "failed").reduce((n, t) => n + t.cost, 0);

  async function queueOne(kind: Kind, target: number, retry: boolean) {
    const quote = await call({ data: { action: "quote", id: p.id, kind, target } });
    if (!("cost" in quote) || typeof quote.cost !== "number") throw new Error("Cost unavailable");
    if ("reusable" in quote && quote.reusable && !retry) return;
    await call({ data: { action: retry ? "retry" : "queue", id: p.id, kind, target, confirmedCost: quote.cost } });
  }
  async function extend(i: number) {
    const base = find("animation", i), voice = find("voice", i); if (!base?.url || !voice?.url) return false;
    const extra = continuationTasks(d, tasks, i); if (extra.some(t => t.status !== "completed" || !t.url)) return false;
    const key = [base.id, voice.id, ...extra.map(t => t.id)].join(":"); if (checked.current.has(key)) return false;
    const { mediaDuration } = await import("@/lib/s2v-merge");
    let video = await mediaDuration(base.url, "video"); for (const t of extra) if (t.url) video += await mediaDuration(t.url, "video");
    const durations = { video, voice: await mediaDuration(voice.url, "audio") };
    const quote = await call({ data: { action: "extendQuote", id: p.id, target: i, durations } });
    if (!("segments" in quote) || !quote.segments) throw new Error("Extra clip quote unavailable");
    if (!quote.segments.length) { checked.current.add(key); return false; }
    if (spent + quote.cost > d.budget && !window.confirm(`Scene ${i + 1}'s voice is ${durations.voice.toFixed(1)}s. Add a new ${quote.segments.map(s => `${s.seconds}s`).join(" + ")} moving clip for ${number(quote.cost)} credits (above the estimate)?`)) { setStopped(true); return false; }
    await call({ data: { action: "extendQueue", id: p.id, target: i, durations, coverageKey: quote.coverageKey, confirmedCost: quote.cost } });
    checked.current.add(key); return true;
  }
  async function render() {
    setRenderMsg("Checking clips…");
    const start = await call({ data: { action: "renderStart", id: p.id } });
    if ("reused" in start && start.reused) { setRenderMsg(null); return; }
    if (!("scenes" in start) || !start.scenes) throw new Error("Render could not start");
    if (spent + start.cost > d.budget && !window.confirm(`Join the final video for ${number(start.cost)} credits?`)) { setRenderMsg(null); setStopped(true); return; }
    const { mergeClips } = await import("@/lib/s2v-merge");
    const blob = await mergeClips(start.scenes, m => setRenderMsg(m));
    setRenderMsg("Saving final video…");
    const { error: upErr } = await supabase.storage.from("generations").uploadToSignedUrl(start.path, start.token, blob, { contentType: "video/mp4" });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}. No credits charged.`);
    await call({ data: { action: "renderFinish", id: p.id, path: start.path, confirmedCost: start.cost } });
    setRenderMsg(null);
  }
  async function advance() {
    if (stepping.current || !running || stopped) return; stepping.current = true;
    try {
      const jobs: [Kind, number, boolean][] = [];
      const want = (k: Kind, i: number, ready: boolean) => { if (!ready) return; const t = find(k, i); if (!t) jobs.push([k, i, false]); else if (t.status === "failed" && takes(k, i) < 2) jobs.push([k, i, true]); };
      d.locations.forEach((_, i) => want("background", i, true));
      d.characters.forEach((_, i) => want("character", i, true));
      d.scenes.forEach((s, i) => { want("frame", i, ok("background", s.location) && s.characters.every(c => ok("character", c))); want("animation", i, ok("frame", i)); if (voiced(i)) want("voice", i, true); });
      if (jobs.length) { await Promise.all(jobs.map(([k, i, r]) => queueOne(k, i, r))); await refetch(); return; }
      let extended = false;
      for (let i = 0; i < d.scenes.length; i++) if (voiced(i) && ok("animation", i) && ok("voice", i)) extended = (await extend(i)) || extended;
      if (extended) { await refetch(); return; }
      const allDone = d.scenes.every((_, i) => ok("animation", i) && (!voiced(i) || (ok("voice", i) && continuationTasks(d, tasks, i).every(t => t.status === "completed"))));
      if (allDone && !active && !finalReady) { await render(); await refetch(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Generation step failed"); setStopped(true); setRenderMsg(null); }
    finally { stepping.current = false; }
  }
  // Real progress units from saved tasks
  const extras = d.scenes.flatMap((_, i) => continuationTasks(d, tasks, i));
  const clipTasks = [...tasks.filter(t => t.kind === "animation" && t.target < SEGMENT_STRIDE), ...extras];
  const totalClips = d.scenes.length + extras.length;
  const clipsDone = clipTasks.filter(t => t.status === "completed").length, clipsProc = clipTasks.filter(t => ["queued", "running", "remote"].includes(t.status)).length;
  const imagesTotal = d.locations.length + d.characters.length + d.scenes.length;
  const imagesDone = tasks.filter(t => ["background", "character", "frame"].includes(t.kind) && t.status === "completed").length;
  const voiceTotal = d.scenes.filter((_, i) => voiced(i)).length, voiceDone = tasks.filter(t => t.kind === "voice" && t.status === "completed").length;
  const scenesDone = d.scenes.filter((_, i) => ok("animation", i) && continuationTasks(d, tasks, i).every(t => t.status === "completed")).length;
  const renderTask = tasks.find(t => t.kind === "render" && t.status === "completed");
  const finalReady = Boolean(p.finalUrl) && scenesDone === d.scenes.length && renderTask !== undefined;
  const units = imagesTotal + totalClips + voiceTotal + 1, unitsDone = imagesDone + clipsDone + voiceDone + (finalReady ? 1 : 0);
  const percent = finalReady ? 100 : Math.min(99, Math.floor(unitsDone / units * 100));
  const started = d.startedAt ? new Date(d.startedAt).getTime() : 0, elapsed = started ? (Date.now() - started) / 1000 : 0;
  const eta = unitsDone > 0 && !finalReady && started ? elapsed / unitsDone * (units - unitsDone) : null;
  const failed = tasks.filter(t => t.status === "failed" || t.status === "review" || t.status === "paused");
  const creditsUsed = p.tasks.filter(t => isCurrentTask(d, t) && t.status === "completed").reduce((n, t) => n + t.cost, 0);

  useEffect(() => { void advance(); }, [p.updatedAt, tasks.map(t => t.status + t.id).join(","), running, stopped]);

  const [videoSeconds, setVideoSeconds] = useState<number | null>(null), [zipping, setZipping] = useState(false);
  async function downloadAll() {
    setZipping(true);
    try { const { zipSync } = await import("fflate"); const files: Record<string, Uint8Array> = {}; for (const t of clipTasks) { if (!t.url || t.status !== "completed") continue; const r = await fetch(t.url); if (!r.ok) throw new Error("Clip download failed"); files[`scene-${String(t.target % SEGMENT_STRIDE + 1).padStart(3, "0")}-part-${Math.floor(t.target / SEGMENT_STRIDE) + 1}.mp4`] = new Uint8Array(await r.arrayBuffer()); } const url = URL.createObjectURL(new Blob([new Uint8Array(zipSync(files, { level: 0 }))], { type: "application/zip" })); const a = document.createElement("a"); a.href = url; a.download = "modern-nova-clips.zip"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); } finally { setZipping(false); }
  }

  if (!running && !finalReady && !tasks.length) return <div className="mx-auto max-w-xl py-12 text-center"><Title /><p className="text-muted-foreground">Generation has not started yet.</p><Button className="mt-4" onClick={() => go(2)}>Open video settings</Button></div>;

  if (finalReady) return <div className="mx-auto max-w-4xl space-y-6"><Title sub={p.title} />
    <div className="overflow-hidden rounded-2xl border border-border bg-muted shadow-sm"><video src={p.finalUrl ?? undefined} controls playsInline onLoadedMetadata={e => setVideoSeconds(e.currentTarget.duration)} className={`mx-auto w-full ${d.aspect === "9:16" ? "max-h-[75vh] max-w-sm" : ""}`} /></div>
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">{([["Duration", videoSeconds ? duration(videoSeconds) : "…"], ["Clips", String(totalClips)], ["Credits used", number(creditsUsed)]] as const).map(([k, v]) => <div key={k} className="bg-card p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 font-display text-lg font-semibold">{v}</dd></div>)}</dl>
    <div className="flex flex-col gap-3 sm:flex-row"><Button asChild size="lg" className="flex-1"><a href={p.finalDownloadUrl ?? p.finalUrl ?? undefined} download><Download />Download full video</a></Button><Button size="lg" variant="outline" className="flex-1" disabled={zipping} onClick={downloadAll}>{zipping ? <Loader2 className="animate-spin" /> : <Download />}All clips (ZIP)</Button></div>
    <details className="rounded-xl border border-border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Individual clips</summary><ul className="mt-3 divide-y divide-border">{clipTasks.filter(t => t.url).sort((a, b) => a.target % SEGMENT_STRIDE - b.target % SEGMENT_STRIDE || a.target - b.target).map(t => <li key={t.id} className="flex items-center justify-between py-2 text-sm"><span>Scene {t.target % SEGMENT_STRIDE + 1}{t.target >= SEGMENT_STRIDE ? ` · part ${Math.floor(t.target / SEGMENT_STRIDE) + 1}` : ""}</span><a href={t.url ?? undefined} download className="font-semibold text-primary">Download</a></li>)}</ul></details>
    <p className="text-center text-xs text-muted-foreground">Saved to your account. <Link to="/script-video" className="font-semibold text-primary">New video</Link></p>
  </div>;

  const rows: [string, string][] = [["Total clips", String(totalClips)], ["Completed", String(clipsDone)], ["Processing", String(clipsProc)], ["Remaining", String(Math.max(0, totalClips - clipsDone - clipsProc))], ["Scenes complete", `${scenesDone} / ${d.scenes.length}`], ["Images", `${imagesDone} / ${imagesTotal}`], ["Voiceover", d.voiceOn ? (voiceDone >= voiceTotal ? "Completed" : `${voiceDone} / ${voiceTotal}`) : "Off"], ["Final rendering", renderMsg ? "Rendering" : "Waiting"]];
  return <div className="mx-auto max-w-3xl space-y-6"><Title sub={p.title} />
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-8" aria-live="polite">
      <div className="flex items-end justify-between"><p className="font-display text-5xl font-bold">{percent}%</p><p className="text-right text-sm text-muted-foreground">{eta !== null ? <>About {duration(eta)} left</> : "Estimating time…"}<br />{started ? `${duration(elapsed)} elapsed` : ""}</p></div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><div className="relative h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.max(2, percent)}%` }}><span className="absolute inset-0 animate-pulse bg-primary-foreground/20" /></div></div>
      {renderMsg && <p role="status" className="mt-4 flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />{renderMsg} Keep this page open.</p>}
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">{rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-0.5 font-semibold">{v}</dd></div>)}</dl>
    </section>
    {(error || failed.length > 0 || stopped) && <section className="space-y-2 rounded-xl border border-destructive/40 bg-card p-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {failed.map(t => <p key={t.id} className="text-sm text-destructive">{t.kind} {t.target % SEGMENT_STRIDE + 1}: {t.error ?? t.status}</p>)}
      <Button variant="outline" size="sm" onClick={async () => { setError(null); setStopped(false); for (const t of failed.filter(t => t.status === "failed")) { try { await queueOne(t.kind as Kind, t.target, true); } catch (e) { setError(e instanceof Error ? e.message : "Retry failed"); } } await refetch(); }}><RefreshCw />Retry failed & continue</Button>
    </section>}
    <p className="text-center text-xs text-muted-foreground"><Film className="mr-1 inline size-3" />Keep this page open — the final video is joined on your device. Credits are charged per finished step; failed steps are refunded.</p>
  </div>;
}
