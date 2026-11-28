import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Pause, Play, Plus, Save, Trash2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { authHeaders, useAuth } from "@/lib/auth";
import { DEFAULT_EDIT, sfxCost, SFX_PRESETS, SURFACES, applyEdits, buildSfxPrompt, encodeWav, mixTimeline, type EditSettings } from "@/lib/sfx";

const RATE = 44100;
type Sound = { id: string; name: string; raw: Float32Array; edit: EditSettings };
type Clip = { id: string; soundId: string; start: number; gain: number };

let ctx: AudioContext | null = null;
const audioCtx = () => (ctx ??= new AudioContext({ sampleRate: RATE }));
async function decode(buf: ArrayBuffer): Promise<Float32Array> {
  const b = await audioCtx().decodeAudioData(buf);
  const out = new Float32Array(b.length);
  for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) out[i]! += d[i]! / b.numberOfChannels; }
  return out;
}
const render = (s: Sound) => applyEdits(s.raw, RATE, s.edit);

// IndexedDB library (saved sounds stay in this browser)
const DB = "nova-sfx";
function db() { return new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore("sounds", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function dbAll(): Promise<Sound[]> { const d = await db(); return new Promise((res) => { const q = d.transaction("sounds").objectStore("sounds").getAll(); q.onsuccess = () => res(q.result as Sound[]); }); }
async function dbPut(s: Sound) { const d = await db(); d.transaction("sounds", "readwrite").objectStore("sounds").put(s); }
async function dbDel(id: string) { const d = await db(); d.transaction("sounds", "readwrite").objectStore("sounds").delete(id); }

function download(blob: Blob, name: string) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function exportAudio(data: Float32Array, name: string, fmt: "wav" | "mp3") {
  const wav = encodeWav(data, RATE);
  if (fmt === "wav") return download(wav, `${name}.wav`);
  const { wavToMp3 } = await import("@/lib/studio-audio");
  download(await wavToMp3(wav), `${name}.mp3`);
}

export function SfxMaker() {
  const { session } = useAuth();
  const [preset, setPreset] = useState<string>("walking");
  const [base, setBase] = useState<string>(SFX_PRESETS[0].prompt);
  const [surface, setSurface] = useState("");
  const [extra, setExtra] = useState("");
  const [duration, setDuration] = useState(4);
  const [busy, setBusy] = useState(false);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [playing, setPlaying] = useState<string | null>(null);
  const node = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => { dbAll().then(setSounds).catch(() => {}); }, []);
  const current = sounds.find((s) => s.id === sel) ?? null;

  function stop() { node.current?.stop(); node.current = null; setPlaying(null); }
  function play(key: string, data: Float32Array) {
    stop(); const c = audioCtx(); void c.resume();
    const b = c.createBuffer(1, Math.max(1, data.length), RATE); b.copyToChannel(new Float32Array(data), 0);
    const n = c.createBufferSource(); n.buffer = b; n.connect(c.destination); n.onended = () => setPlaying((p) => (p === key ? null : p));
    n.start(); node.current = n; setPlaying(key);
  }
  function add(name: string, raw: Float32Array) {
    const s: Sound = { id: crypto.randomUUID(), name, raw, edit: { ...DEFAULT_EDIT } };
    setSounds((l) => [s, ...l]); setSel(s.id); return s;
  }
  function updateEdit(patch: Partial<EditSettings>) {
    if (!current) return;
    setSounds((l) => l.map((s) => (s.id === current.id ? { ...s, edit: { ...s.edit, ...patch } } : s)));
  }

  async function generate() {
    if (!session) { toast.error("Please log in to generate sounds."); return; }
    const prompt = buildSfxPrompt(base, surface, extra);
    if (prompt.length < 3) { toast.error("Describe the sound first."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/sfx", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) }, body: JSON.stringify({ prompt, duration }) });
      if (!res.ok) { const j = (await res.json().catch(() => null)) as { message?: string } | null; throw new Error(j?.message ?? `Failed (HTTP ${res.status})`); }
      const raw = await decode(await res.arrayBuffer());
      const s = add(SFX_PRESETS.find((p) => p.id === preset)?.label ?? "Sound", raw);
      play(s.id, raw); toast.success(`Sound ready — ${sfxCost(duration)} credits used.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Generation failed"); }
    finally { setBusy(false); }
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error("File too large (max 25 MB)."); return; }
    try { add(f.name.replace(/\.[^.]+$/, ""), await decode(await f.arrayBuffer())); toast.success("Audio added."); }
    catch { toast.error("This file could not be read as audio."); }
  }

  const timelineLen = Math.max(10, ...clips.map((c) => { const s = sounds.find((x) => x.id === c.soundId); return s ? c.start + render(s).length / RATE : 0; }));
  const mix = () => mixTimeline(clips.flatMap((c) => { const s = sounds.find((x) => x.id === c.soundId); return s ? [{ id: c.id, data: render(s), start: c.start, gain: c.gain }] : []; }), RATE);

  const sl = (label: string, v: number, min: number, max: number, step: number, k: keyof EditSettings, fmt = (x: number) => x.toFixed(2)) => (
    <label className="block text-sm"><span className="flex justify-between text-muted-foreground"><span>{label}</span><span>{fmt(v)}</span></span>
      <Slider className="mt-2" min={min} max={max} step={step} value={[v]} onValueChange={(x) => updateEdit({ [k]: x[0] ?? v })} /></label>
  );

  return (
    <div className="tool-page space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">SFX Maker</h1>
        <p className="mt-1 text-muted-foreground">Create real AI sound effects for your animation, edit them and arrange them on a timeline.</p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold">1. Create a sound</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SFX_PRESETS.map((p) => (
            <Button key={p.id} size="sm" variant={preset === p.id ? "default" : "outline"} onClick={() => { setPreset(p.id); setBase(p.prompt); }}>{p.label}</Button>
          ))}
        </div>
        <Textarea className="mt-3" rows={3} maxLength={450} value={base} onChange={(e) => setBase(e.target.value)} placeholder="Describe your sound, e.g. a balloon popping in a cartoon" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm text-muted-foreground">Surface / place
            <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-foreground" value={surface} onChange={(e) => setSurface(e.target.value)}>
              {SURFACES.map((s) => <option key={s} value={s}>{s || "Any"}</option>)}
            </select></label>
          <label className="text-sm text-muted-foreground">Extra detail
            <input className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-foreground" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="e.g. echo, small child, slow" /></label>
          <label className="text-sm text-muted-foreground">Length: {duration}s
            <Slider className="mt-3" min={0.5} max={22} step={0.5} value={[duration]} onValueChange={(v) => setDuration(v[0] ?? 4)} /></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={generate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Generate ({sfxCost(duration)} credits)</Button>
          <Button variant="outline" asChild><label className="cursor-pointer"><Upload className="h-4 w-4" /> Upload audio<input type="file" accept="audio/*" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold">2. Your sounds</h2>
          {!sounds.length && <p className="mt-2 text-sm text-muted-foreground">Generated or uploaded sounds appear here.</p>}
          <ul className="mt-3 space-y-2">
            {sounds.map((s) => (
              <li key={s.id} className={`flex items-center gap-2 rounded-md border p-2 ${sel === s.id ? "border-primary" : "border-border"}`}>
                <button className="flex-1 truncate text-left text-sm font-medium" onClick={() => setSel(s.id)}>{s.name} · {(render(s).length / RATE).toFixed(1)}s</button>
                <Button size="icon" variant="ghost" aria-label="Preview" onClick={() => (playing === s.id ? stop() : play(s.id, render(s)))}>{playing === s.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                <Button size="icon" variant="ghost" aria-label="Add to timeline" onClick={() => setClips((c) => [...c, { id: crypto.randomUUID(), soundId: s.id, start: 0, gain: 1 }])}><Plus className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Save" onClick={() => { void dbPut(s).then(() => toast.success("Saved in this browser.")); }}><Save className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => { void dbDel(s.id); setSounds((l) => l.filter((x) => x.id !== s.id)); setClips((c) => c.filter((x) => x.soundId !== s.id)); }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 className="font-display text-lg font-bold">3. Edit {current ? `— ${current.name}` : ""}</h2>
          {!current ? <p className="mt-2 text-sm text-muted-foreground">Select a sound to edit.</p> : (
            <div className="mt-3 space-y-4">
              {sl("Volume", current.edit.volume, 0, 2, 0.05, "volume")}
              {sl("Intensity", current.edit.intensity, 0, 1, 0.05, "intensity")}
              {sl("Pitch (semitones)", current.edit.pitch, -12, 12, 1, "pitch", (x) => `${x > 0 ? "+" : ""}${x}`)}
              {sl("Speed", current.edit.speed, 0.5, 2, 0.05, "speed", (x) => `${x.toFixed(2)}x`)}
              {sl("Duration (0 = natural)", current.edit.duration, 0, 30, 0.5, "duration", (x) => (x ? `${x}s` : "natural"))}
              {sl("Fade out", current.edit.fadeOut, 0, 3, 0.05, "fadeOut", (x) => `${x.toFixed(2)}s`)}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => play(current.id, render(current))}><Play className="h-4 w-4" /> Preview</Button>
                <Button size="sm" variant="outline" onClick={() => updateEdit(DEFAULT_EDIT)}>Reset</Button>
                <Button size="sm" variant="outline" onClick={() => void exportAudio(render(current), current.name, "mp3")}><Download className="h-4 w-4" /> MP3</Button>
                <Button size="sm" variant="outline" onClick={() => void exportAudio(render(current), current.name, "wav")}><Download className="h-4 w-4" /> WAV</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
        <h2 className="font-display text-lg font-bold">4. Animation timeline</h2>
        {!clips.length && <p className="mt-2 text-sm text-muted-foreground">Press + on a sound to place it on the timeline.</p>}
        <div className="mt-3 space-y-3">
          {clips.map((c) => {
            const s = sounds.find((x) => x.id === c.soundId); if (!s) return null;
            const len = render(s).length / RATE;
            return (
              <div key={c.id} className="rounded-md border border-border p-2">
                <div className="relative h-7 rounded bg-muted">
                  <div className="absolute inset-y-0 rounded bg-primary/70 px-2 text-xs leading-7 text-primary-foreground" style={{ left: `${(c.start / timelineLen) * 100}%`, width: `${Math.max(2, (len / timelineLen) * 100)}%` }}>{s.name}</div>
                </div>
                <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-center gap-3 text-xs text-muted-foreground">
                  <label>Start {c.start.toFixed(1)}s<Slider className="mt-2" min={0} max={60} step={0.1} value={[c.start]} onValueChange={(v) => setClips((l) => l.map((x) => (x.id === c.id ? { ...x, start: v[0] ?? 0 } : x)))} /></label>
                  <label>Level {c.gain.toFixed(2)}<Slider className="mt-2" min={0} max={1.5} step={0.05} value={[c.gain]} onValueChange={(v) => setClips((l) => l.map((x) => (x.id === c.id ? { ...x, gain: v[0] ?? 1 } : x)))} /></label>
                  <Button size="icon" variant="ghost" aria-label="Remove clip" onClick={() => setClips((l) => l.filter((x) => x.id !== c.id))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            );
          })}
        </div>
        {!!clips.length && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => (playing === "mix" ? stop() : play("mix", mix()))}>{playing === "mix" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} Play timeline</Button>
            <Button size="sm" variant="outline" onClick={() => void exportAudio(mix(), "sfx-timeline", "mp3")}><Download className="h-4 w-4" /> Export MP3</Button>
            <Button size="sm" variant="outline" onClick={() => void exportAudio(mix(), "sfx-timeline", "wav")}><Download className="h-4 w-4" /> Export WAV</Button>
          </div>
        )}
      </section>
    </div>
  );
}
