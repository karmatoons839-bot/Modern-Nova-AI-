import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Circle, Download, Film, ImagePlus, Loader2, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { listS2vCharacters } from "@/lib/s2v-characters.functions";
import { authHeaders, useAuth, useProfile, useRefreshProfile } from "@/lib/auth";

const CATS = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "child", label: "Child" },
  { id: "old", label: "Old" },
] as const;
const MAX_BG = 10 * 1024 * 1024;
const BG_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACTIVE_KEY = "s2v-active-project";

type Scene = { idx: number; title: string; description: string; duration: number; status: string; attempts: number; error: string | null; clipUrl: string | null; audioUrl: string | null; frameUrl: string | null };
type Estimate = { analysis: number; images: number; animation: number; render: number; total: number };
type Draft = { characters: string[]; language: string; scenes: { title: string; description: string; dialogue: string }[]; estimate5: Estimate; estimate10: Estimate };
type ProjectView = {
  id: string; title: string; status: string; stage: string; aspectRatio: string; characterName: string;
  sceneCount: number; totalSeconds: number; cost: number; error: string | null; createdAt: string; finalUrl: string | null; scenes: Scene[]; clipSeconds: number; draft: Draft | null;
};

const STAGES = [
  { id: "understanding", label: "Understanding script" },
  { id: "scenes", label: "Creating scenes" },
  { id: "references", label: "Preparing character references" },
  { id: "animating", label: "Generating scene animations" },
  { id: "combining", label: "Combining video clips" },
  { id: "rendering", label: "Rendering final video" },
  { id: "ready", label: "Video ready" },
];

function stageIndex(p: ProjectView | null, creating: boolean, local: string | null) {
  if (creating) return 0;
  if (!p) return -1;
  if (p.status === "completed") return 6;
  if (p.status === "draft") return 2;
  if (local === "rendering") return 5;
  if (p.status === "clips_ready") return 4;
  if (p.stage === "animating") return 3;
  return 2;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(await authHeaders()), ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new Error(body.message || `Request failed (${res.status})`);
  return body as T;
}

function readB64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Could not read the image."));
    r.readAsDataURL(file);
  });
}

export function ScriptVideoTool() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  const refreshProfile = useRefreshProfile();
  const qc = useQueryClient();

  const settings = useQuery({
    queryKey: ["s2v-settings"],
    queryFn: async () => (await supabase.from("s2v_settings").select("*").eq("id", 1).single()).data,
  });
  const listCharacters = useServerFn(listS2vCharacters);
  const characters = useQuery({
    queryKey: ["s2v-characters"],
    queryFn: () => listCharacters(),
  });

  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [bg, setBg] = useState<File | null>(null);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [cat, setCat] = useState<(typeof CATS)[number]["id"]>("male");
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [aspect, setAspect] = useState<"9:16" | "16:9">("9:16");
  const [creating, setCreating] = useState(false);
  const [project, setProject] = useState<ProjectView | null>(null);
  const [localStage, setLocalStage] = useState<string | null>(null);
  const [mergeMsg, setMergeMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const merging = useRef(false);

  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  const maxScenes = settings.data?.max_scenes ?? 6;
  const [clipLen, setClipLen] = useState<5 | 10>(5);
  const [confirming, setConfirming] = useState(false);
  const sp = settings.data;
  const prices = sp ? { img: sp.price_scene_image, a5: sp.price_anim_5, a10: sp.price_anim_10, r: sp.price_render } : null;
  const estScenes = words ? Math.min(maxScenes, Math.max(1, Math.round(words / 70))) : 0;
  const maxChars = settings.data?.max_script_chars ?? 100000;
  const selected = characters.data?.find((c) => c.id === characterId);

  useEffect(() => () => { if (bgUrl) URL.revokeObjectURL(bgUrl); }, [bgUrl]);

  // Resume an unfinished project after returning to the page.
  useEffect(() => {
    if (!session) return;
    const id = localStorage.getItem(ACTIVE_KEY);
    if (id) api<ProjectView>(`/api/script-video/${id}`).then(setProject).catch(() => localStorage.removeItem(ACTIVE_KEY));
  }, [session]);

  // Poll real backend status.
  useEffect(() => {
    if (!project || project.status !== "generating") return;
    const t = setTimeout(() => api<ProjectView>(`/api/script-video/${project.id}`).then(setProject).catch((e: Error) => setError(e.message)), 7000);
    return () => clearTimeout(t);
  }, [project]);

  // When every scene clip is ready, join them on this device and save the final video.
  useEffect(() => {
    if (project?.status === "clips_ready" && !merging.current) void combine(project);
    if (project && ["completed", "failed", "cancelled"].includes(project.status)) {
      localStorage.removeItem(ACTIVE_KEY);
      void qc.invalidateQueries({ queryKey: ["s2v-history"] });
      void refreshProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.status]);

  async function combine(p: ProjectView) {
    merging.current = true;
    setError(null);
    try {
      const ordered = [...p.scenes].sort((a, b) => a.idx - b.idx);
      if (ordered.some((s) => !s.clipUrl)) throw new Error("Some scene clips are missing.");
      const { mergeClips } = await import("@/lib/s2v-merge");
      const blob = await mergeClips(ordered.map((s) => ({ clipUrl: s.clipUrl!, audioUrl: s.audioUrl, seconds: s.duration })), setMergeMsg);
      setLocalStage("rendering");
      setMergeMsg("Saving final video…");
      const { path, token } = await api<{ path: string; token: string }>(`/api/script-video/${p.id}`, { method: "POST", body: JSON.stringify({ action: "upload-url" }) });
      const up = await supabase.storage.from("generations").uploadToSignedUrl(path, token, blob, { contentType: "video/mp4" });
      if (up.error) throw new Error("Could not save the final video.");
      setProject(await api<ProjectView>(`/api/script-video/${p.id}`, { method: "POST", body: JSON.stringify({ action: "finalize" }) }));
      toast.success("Your video is ready");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Joining failed"} — your scenes are saved; press "Combine scenes" to try again.`);
    } finally {
      merging.current = false;
      setMergeMsg(null);
      setLocalStage(null);
    }
  }

  function pickBg(file: File | undefined) {
    if (!file) return;
    if (!BG_TYPES.includes(file.type)) { toast.error("Use a JPG, PNG or WEBP image."); return; }
    if (file.size > MAX_BG) { toast.error("Image must be under 10 MB."); return; }
    setBg(file);
    setBgUrl(URL.createObjectURL(file));
  }

  async function generate() {
    setError(null);
    if (!session) return setError("Please log in to generate videos.");
    if (script.trim().length < 20) return setError("Please paste your script first.");
    if (!bg) return setError("Please upload a background image.");
    if (!characterId) return setError("Please select a character.");
    setCreating(true);
    try {
      const res = await api<{ id: string }>("/api/script-video", {
        method: "POST",
        body: JSON.stringify({ requestKey: crypto.randomUUID(), title, script, aspectRatio: aspect, characterId, bgData: await readB64(bg), bgMime: bg.type }),
      });
      setProject(await api<ProjectView>(`/api/script-video/${res.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyse the script.");
    } finally {
      setCreating(false);
    }
  }

  async function confirmGenerate() {
    if (!project?.draft) return;
    const est = clipLen === 10 ? project.draft.estimate10 : project.draft.estimate5;
    if (!confirm(`Generate ${project.sceneCount} scenes for ${est.total.toLocaleString()} credits?`)) return;
    setConfirming(true);
    try {
      const p = await api<ProjectView>(`/api/script-video/${project.id}`, { method: "POST", body: JSON.stringify({ action: "confirm", clipSeconds: clipLen }) });
      localStorage.setItem(ACTIVE_KEY, p.id);
      setProject(p);
      void refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start the video.");
    } finally {
      setConfirming(false);
    }
  }

  async function act(action: "retry" | "cancel") {
    if (!project) return;
    try {
      setProject(await api<ProjectView>(`/api/script-video/${project.id}`, { method: "POST", body: JSON.stringify({ action }) }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  const idx = stageIndex(project, creating, localStage);
  const running = creating || project?.status === "generating" || project?.status === "clips_ready";
  const failedScenes = project?.scenes.filter((s) => s.status === "failed") ?? [];
  const disabled = settings.data && !settings.data.enabled;

  if (false)
    return <div className="mx-auto max-w-xl rounded-3xl border border-border bg-card p-6 text-center text-sm">Script to Video is available to admins only.</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Script to Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">Paste script → upload background → pick a character → generate one animated video.</p>
      </header>
      {disabled && <div className="rounded-2xl border border-border bg-muted p-4 text-sm">Script to Video is turned off right now.</div>}

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold">1. Your script</h2>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Script title (optional)" className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary" />
        <textarea value={script} onChange={(e) => setScript(e.target.value.slice(0, maxChars))} rows={9} placeholder="Paste your full story or script — Hindi, English or another Indian language. Dialogue between characters is fine." className="mt-3 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary" />
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{words.toLocaleString()} words</span>
          <span>{script.length.toLocaleString()} / {maxChars.toLocaleString()} characters</span>
          <span>~{estScenes} scenes (AI decides by story events, max {maxScenes})</span>
          <button type="button" onClick={() => setScript("")} className="ml-auto font-semibold text-primary">Clear script</button>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold">2. Background</h2>
        <p className="text-xs text-muted-foreground">The AI keeps every scene in this place, with new camera angles. JPG, PNG or WEBP, up to 10 MB.</p>
        <input ref={fileRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { pickBg(e.target.files?.[0]); e.target.value = ""; }} />
        {bgUrl ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <img src={bgUrl} alt="Uploaded background" className="max-h-56 w-full rounded-2xl border border-border object-cover sm:w-80" />
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-sm font-semibold"><RefreshCw className="h-4 w-4" />Replace</button>
              <button type="button" onClick={() => { setBg(null); setBgUrl(null); }} className="inline-flex items-center gap-1.5 rounded-2xl border border-border px-3 py-2 text-sm font-semibold"><X className="h-4 w-4" />Remove</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickBg(e.dataTransfer.files[0]); }} className="mt-3 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-4 py-10 text-sm text-muted-foreground hover:border-primary">
            <ImagePlus className="h-7 w-7 text-primary" />
            Tap to upload a background (village, forest, house, school…)
          </button>
        )}
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold">3. Character</h2>
          {selected && <span className="text-xs font-semibold text-primary">Selected: {selected.name}</span>}
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {CATS.map((c) => (
            <button key={c.id} type="button" onClick={() => setCat(c.id)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${cat === c.id ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>{c.label}</button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {characters.isLoading && <p className="col-span-full text-sm text-muted-foreground">Loading characters…</p>}
          {characters.data?.filter((c) => c.category === cat).map((c) => (
            <button key={c.id} type="button" onClick={() => setCharacterId(c.id)} aria-pressed={characterId === c.id} className={`overflow-hidden rounded-2xl border-2 bg-muted text-left transition ${characterId === c.id ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"}`}>
              {c.url && <img src={c.url} alt={c.name} loading="lazy" width={768} height={1024} className="aspect-[3/4] w-full object-cover" />}
              <span className="block truncate px-2 py-1.5 text-[11px] font-semibold">{c.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold">4. Video format</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["9:16", "16:9"] as const).filter((a) => (a === "9:16" ? settings.data?.allow_vertical !== false : settings.data?.allow_landscape !== false)).map((a) => (
            <button key={a} type="button" onClick={() => setAspect(a)} className={`rounded-2xl border-2 px-3 py-3 text-sm font-semibold ${aspect === a ? "border-primary bg-primary/5" : "border-border"}`}>
              {a === "9:16" ? "Vertical 9:16 · Shorts/Reels" : "Landscape 16:9 · YouTube"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">720p AI animation with Voice Studio voiceover for the dialogue.</p>
        <div className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm">
          <b>Script, character & scene analysis: FREE.</b>
          {prices && <span className="block text-xs text-muted-foreground">Then per scene: image {prices.img.toLocaleString()} + 5s animation {prices.a5.toLocaleString()} (or 10s {prices.a10.toLocaleString()}) · final render {prices.r.toLocaleString()} per video. You see the exact total and confirm before any credits are used.</span>}
          {profile && <span className="block text-xs text-muted-foreground">Your balance: {profile.credits.toLocaleString()} credits</span>}
        </div>
        {error && <p className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
        {!session ? (
          <Link to="/auth" className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground">Log in to generate</Link>
        ) : (
          <button type="button" disabled={running || !!disabled} onClick={generate} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}{creating ? "Analysing script (free)…" : running ? "Generating…" : "Analyse script (free)"}
          </button>
        )}
      </section>

      {(creating || project) && (
        <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold">{project?.title || "Your video"}</h2>
            {project && <span className="text-xs text-muted-foreground">{project.sceneCount} scenes · {project.draft ? "not charged yet" : `${project.totalSeconds}s · ${project.cost.toLocaleString()} credits`} · {project.characterName}</span>}
          </div>
          <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {STAGES.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-2 text-sm ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>
                {i < idx || (i === 6 && idx === 6) ? <CheckCircle2 className="h-4 w-4 text-primary" /> : i === idx ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Circle className="h-4 w-4" />}
                {s.label}
              </li>
            ))}
          </ol>
          {mergeMsg && <p className="mt-2 text-xs text-muted-foreground">{mergeMsg} Keep this page open until it finishes.</p>}
          {project?.draft && (() => {
            const est = clipLen === 10 ? project.draft.estimate10 : project.draft.estimate5;
            return (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-muted-foreground">Free analysis found <b className="text-foreground">{project.sceneCount} scenes</b>{project.draft.language ? ` · ${project.draft.language}` : ""}{project.draft.characters.length ? ` · characters: ${project.draft.characters.join(", ")}` : ""}.</p>
                <ol className="max-h-64 list-decimal space-y-1 overflow-y-auto rounded-2xl border border-border p-3 pl-8 text-xs">
                  {project.draft.scenes.map((s, i) => <li key={i}><b>{s.title}</b> — {s.description}{s.dialogue && <span className="block text-muted-foreground">🎙 “{s.dialogue}”</span>}</li>)}
                </ol>
                <div className="flex gap-2">
                  {([5, 10] as const).map((n) => <button key={n} type="button" onClick={() => setClipLen(n)} className={`flex-1 rounded-2xl px-3 py-2 text-sm font-semibold ${clipLen === n ? "bg-primary text-primary-foreground" : "border border-border"}`}>{n}-second clips</button>)}
                </div>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td>Script / character / scene analysis</td><td className="text-right">FREE</td></tr>
                    <tr><td>{project.sceneCount} scene images</td><td className="text-right">{est.images.toLocaleString()}</td></tr>
                    <tr><td>{project.sceneCount} × {clipLen}s animations</td><td className="text-right">{est.animation.toLocaleString()}</td></tr>
                    <tr><td>Voiceover (Voice Studio)</td><td className="text-right">Included</td></tr>
                    <tr><td>Final video rendering</td><td className="text-right">{est.render.toLocaleString()}</td></tr>
                    <tr className="border-t border-border font-bold"><td className="pt-1">Total ({project.sceneCount * clipLen}s video)</td><td className="pt-1 text-right">{est.total.toLocaleString()} credits</td></tr>
                  </tbody>
                </table>
                <button type="button" disabled={confirming} onClick={confirmGenerate} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">{confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}Confirm & generate · {est.total.toLocaleString()} credits</button>
              </div>
            );
          })()}
          {project?.status === "generating" && <p className="mt-2 text-xs text-muted-foreground">You can leave this page — scenes keep generating and will be here when you come back.</p>}
          {project?.error && <p className="mt-3 text-sm text-destructive">{project.error}</p>}

          {project && project.scenes.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {project.scenes.map((s) => (
                <div key={s.idx} className="overflow-hidden rounded-2xl border border-border">
                  <div className={`${project.aspectRatio === "9:16" ? "aspect-[9/16]" : "aspect-video"} bg-muted`}>
                    {s.clipUrl ? <video src={s.clipUrl} muted playsInline controls className="h-full w-full object-cover" /> : s.frameUrl ? <img src={s.frameUrl} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="p-2 text-xs">
                    <p className="font-semibold">Scene {s.idx + 1}: {s.title}</p>
                    <p className={s.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                      {s.status === "completed" ? "Animated ✓" : s.status === "rendering" || s.status === "saving" ? "Animating…" : s.status === "keyframing" ? "Preparing character frame…" : s.status === "failed" ? `Failed: ${s.error ?? ""}` : "Waiting"} · {s.duration}s
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {project?.status === "generating" && failedScenes.length > 0 && <button type="button" onClick={() => act("retry")} className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><RefreshCw className="h-4 w-4" />Retry failed scenes (free)</button>}
            {project?.status === "generating" && <button type="button" onClick={() => { if (confirm("Cancel this video and refund credits?")) void act("cancel"); }} className="rounded-2xl border border-border px-3 py-2 text-sm font-semibold">Cancel & refund</button>}
            {project?.status === "clips_ready" && !mergeMsg && <button type="button" onClick={() => combine(project)} className="inline-flex items-center gap-1.5 rounded-2xl bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"><Upload className="h-4 w-4" />Combine scenes</button>}
          </div>

          {project?.finalUrl && (
            <div className="mt-4">
              <video src={project.finalUrl} controls playsInline className={`mx-auto w-full rounded-2xl bg-muted ${project.aspectRatio === "9:16" ? "max-w-xs" : ""}`} />
              <a href={project.finalUrl} download={`${project.title || "modern-nova-video"}.mp4`} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><Download className="h-4 w-4" />Download video</a>
            </div>
          )}
        </section>
      )}

      {session && <MyVideos onOpen={(id) => api<ProjectView>(`/api/script-video/${id}`).then((p) => { setProject(p); if (p.status === "generating" || p.status === "clips_ready") localStorage.setItem(ACTIVE_KEY, p.id); window.scrollTo({ top: document.body.scrollHeight / 2, behavior: "smooth" }); })} />}
    </div>
  );
}

function MyVideos({ onOpen }: { onOpen: (id: string) => void }) {
  const qc = useQueryClient();
  const history = useQuery({
    queryKey: ["s2v-history"],
    queryFn: async () => {
      const { data } = await supabase.from("s2v_projects").select("id, title, status, aspect_ratio, character_name, total_seconds, credits_charged, created_at, s2v_scenes(idx, keyframe_path)").order("created_at", { ascending: false }).limit(20);
      const rows = data ?? [];
      const paths = rows.map((r) => (r.s2v_scenes ?? []).find((s) => s.idx === 0)?.keyframe_path ?? "");
      const valid = paths.filter(Boolean);
      const signed = valid.length ? (await supabase.storage.from("generations").createSignedUrls(valid, 3600)).data ?? [] : [];
      const map = new Map(signed.map((s) => [s.path, s.signedUrl]));
      return rows.map((r, i) => ({ ...r, thumb: map.get(paths[i]!) ?? null }));
    },
  });
  const label = useMemo(() => ({ draft: "Estimate (not charged)", generating: "Generating", clips_ready: "Needs combining", completed: "Ready", failed: "Failed (refunded)", cancelled: "Cancelled (refunded)" }) as Record<string, string>, []);

  async function remove(id: string) {
    if (!confirm("Delete this video and its files?")) return;
    try {
      await api(`/api/script-video/${id}`, { method: "POST", body: JSON.stringify({ action: "delete" }) });
      void qc.invalidateQueries({ queryKey: ["s2v-history"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <h2 className="font-display text-lg font-bold">My Videos</h2>
      {history.data?.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No videos yet.</p>}
      <ul className="mt-3 divide-y divide-border">
        {history.data?.map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-3">
            <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">{v.thumb && <img src={v.thumb} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1 text-xs">
              <p className="truncate text-sm font-semibold">{v.title || "Untitled script"}</p>
              <p className="text-muted-foreground">{new Date(v.created_at).toLocaleString()} · {v.total_seconds}s · {v.aspect_ratio} · {v.character_name}</p>
              <p className={v.status === "completed" ? "text-primary" : "text-muted-foreground"}>{label[v.status] ?? v.status}</p>
            </div>
            <button type="button" onClick={() => onOpen(v.id)} className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold">Open</button>
            {v.status !== "generating" && <button type="button" aria-label="Delete" onClick={() => remove(v.id)} className="rounded-xl border border-border p-1.5"><Trash2 className="h-4 w-4" /></button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
