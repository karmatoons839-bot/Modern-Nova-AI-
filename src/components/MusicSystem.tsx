import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, Music, Pause, Play, Search, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { authHeaders, useAuth } from "@/lib/auth";
import { MUSIC_CREDIT_COSTS, MUSIC_DURATIONS, MUSIC_INSTRUMENTS, MUSIC_MOODS, MUSIC_PROMPT_MAX, MUSIC_TYPES, type MusicDuration } from "@/lib/music";

type Track = { id: string; name: string; source: "upload" | "ai"; tags: string; type: string; size: number; added: number; blob: Blob };

// Library is stored in this browser (IndexedDB); AI tracks are also saved to the account's History.
const DB = "nova-music";
function db() { return new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("tracks", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function dbAll(): Promise<Track[]> { const d = await db(); return new Promise((res) => { const q = d.transaction("tracks").objectStore("tracks").getAll(); q.onsuccess = () => res(q.result as Track[]); }); }
async function dbPut(t: Track) { const d = await db(); d.transaction("tracks", "readwrite").objectStore("tracks").put(t); }
async function dbDel(id: string) { const d = await db(); d.transaction("tracks", "readwrite").objectStore("tracks").delete(id); }

const MAX_UPLOAD = 50 * 1024 * 1024;
const ext = (t: Track) => (t.type.includes("wav") ? "wav" : t.type.includes("ogg") ? "ogg" : t.type.includes("mp4") || t.type.includes("aac") ? "m4a" : "mp3");

export function MusicSystem() {
  const { session } = useAuth();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "upload" | "ai">("all");
  const [playing, setPlaying] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState("");
  const [mood, setMood] = useState<(typeof MUSIC_MOODS)[number]>("Cinematic");
  const [musicType, setMusicType] = useState<(typeof MUSIC_TYPES)[number]>("Background Music");
  const [duration, setDuration] = useState<MusicDuration>(30);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { dbAll().then((l) => setTracks(l.sort((a, b) => b.added - a.added))).catch(() => {}); }, []);
  useEffect(() => { fetch("/api/music").then((r) => r.json()).then((j: { generationAvailable?: boolean }) => setAvailable(Boolean(j.generationAvailable))).catch(() => setAvailable(false)); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tracks.filter((t) => (filter === "all" || t.source === filter) && (!s || `${t.name} ${t.tags}`.toLowerCase().includes(s)));
  }, [tracks, q, filter]);

  async function addTrack(t: Track) { await dbPut(t); setTracks((l) => [t, ...l]); }

  async function onUpload(files: FileList | null) {
    for (const f of Array.from(files ?? [])) {
      if (!f.type.startsWith("audio/")) { toast.error(`${f.name}: audio file nahi hai`); continue; }
      if (f.size > MAX_UPLOAD) { toast.error(`${f.name}: 50 MB se bada hai`); continue; }
      await addTrack({ id: crypto.randomUUID(), name: f.name.replace(/\.[^.]+$/, ""), source: "upload", tags: "uploaded", type: f.type, size: f.size, added: Date.now(), blob: f });
    }
  }

  function toggle(t: Track) {
    const el = audio.current; if (!el) return;
    if (playing === t.id) { el.pause(); setPlaying(null); return; }
    const u = URL.createObjectURL(t.blob); setUrl(u); el.src = u; void el.play(); setPlaying(t.id);
  }

  async function remove(t: Track) { if (playing === t.id) { audio.current?.pause(); setPlaying(null); } await dbDel(t.id); setTracks((l) => l.filter((x) => x.id !== t.id)); }

  function download(t: Track) { const a = document.createElement("a"); a.href = URL.createObjectURL(t.blob); a.download = `${t.name}.${ext(t)}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); }

  async function generate() {
    if (!session) { toast.error("Music banane ke liye login karein."); return; }
    if (prompt.trim().length < 3) { toast.error("Music ka description likhein."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/music", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ prompt, mood, musicType, duration, instruments }) });
      if (!res.ok) { const j = (await res.json().catch(() => null)) as { message?: string } | null; throw new Error(j?.message ?? `Failed (HTTP ${res.status})`); }
      const blob = await res.blob();
      await addTrack({ id: res.headers.get("X-Generation-Id") ?? crypto.randomUUID(), name: `${mood} ${musicType}`, source: "ai", tags: `ai ${mood} ${musicType} ${instruments.join(" ")}`, type: blob.type || "audio/mpeg", size: blob.size, added: Date.now(), blob });
      toast.success("Music ready — library mein add ho gaya.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="tool-page mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <Music className="h-8 w-8 text-primary" />
        <div><h1 className="font-display text-3xl font-bold">Music Studio</h1><p className="text-sm text-muted-foreground">Upload, library, search, preview aur AI music generation.</p></div>
      </div>

      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">AI Music Generate</h2>
        {available === false && <p className="mb-3 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">Music generation service abhi connect nahi hai. Generate karne par credit nahi katega.</p>}
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, MUSIC_PROMPT_MAX))} placeholder="Jaise: soft piano with slow strings for a sad village story ending" rows={3} />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <select aria-label="Mood" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={mood} onChange={(e) => setMood(e.target.value as typeof mood)}>{MUSIC_MOODS.map((m) => <option key={m}>{m}</option>)}</select>
          <select aria-label="Type" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={musicType} onChange={(e) => setMusicType(e.target.value as typeof musicType)}>{MUSIC_TYPES.map((m) => <option key={m}>{m}</option>)}</select>
          <select aria-label="Duration" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={duration} onChange={(e) => setDuration(Number(e.target.value) as MusicDuration)}>{MUSIC_DURATIONS.map((d) => <option key={d} value={d}>{d}s — {MUSIC_CREDIT_COSTS[d]} credits</option>)}</select>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{MUSIC_INSTRUMENTS.map((i) => { const on = instruments.includes(i); return <button key={i} type="button" onClick={() => setInstruments((l) => (on ? l.filter((x) => x !== i) : [...l, i]))} className={`rounded-full border px-3 py-1 text-xs ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{i}</button>; })}</div>
        <Button className="mt-4" onClick={generate} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}Generate — {MUSIC_CREDIT_COSTS[duration]} credits</Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-display text-lg font-semibold">Music Library ({tracks.length})</h2>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"><Upload className="h-4 w-4" />Upload<input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { void onUpload(e.target.files); e.target.value = ""; }} /></label>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search music" className="pl-9" placeholder="Search name ya tag…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {(["all", "upload", "ai"] as const).map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "upload" ? "Uploaded" : "AI"}</Button>)}
        </div>
        {shown.length === 0 && <p className="text-sm text-muted-foreground">{tracks.length ? "Koi match nahi mila." : "Abhi library khali hai — music upload karein ya generate karein."}</p>}
        <ul className="space-y-2">{shown.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Button size="icon" variant="outline" aria-label={playing === t.id ? "Pause" : "Play"} onClick={() => toggle(t)}>{playing === t.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
            <div className="min-w-0 flex-1"><p className="truncate font-medium">{t.name}</p><p className="text-xs text-muted-foreground">{t.source === "ai" ? "AI" : "Uploaded"} · {(t.size / 1024 / 1024).toFixed(1)} MB</p></div>
            <Button size="icon" variant="ghost" aria-label="Download" onClick={() => download(t)}><Download className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => void remove(t)}><Trash2 className="h-4 w-4" /></Button>
          </li>))}</ul>
        <audio ref={audio} onEnded={() => setPlaying(null)} className="hidden" />
      </section>
    </div>
  );
}
