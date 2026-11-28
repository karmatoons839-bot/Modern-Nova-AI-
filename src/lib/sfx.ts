/** Client-safe SFX Maker config + real PCM DSP (no audio library, no samples). */
import { z } from "zod";

export const SFX_CREDITS_PER_SECOND = 200;
/** Charged per started second of requested length. */
export const sfxCost = (seconds: number) => Math.ceil(seconds) * SFX_CREDITS_PER_SECOND;
export const SFX_PROMPT_MAX = 450;

export const SFX_PRESETS = [
  { id: "walking", label: "Walking", prompt: "calm footsteps of a person walking at a normal pace" },
  { id: "running", label: "Running", prompt: "fast footsteps of a person running, heavy breathing" },
  { id: "crying", label: "Crying", prompt: "a child crying and sobbing softly, cartoon animation" },
  { id: "laughing", label: "Laughing", prompt: "a cheerful cartoon character laughing out loud" },
  { id: "footsteps", label: "Footsteps", prompt: "clear single footsteps on a wooden floor" },
  { id: "jump", label: "Jump & Fall", prompt: "cartoon character jumps with a whoosh then falls with a thud" },
  { id: "door", label: "Door Open/Close", prompt: "old wooden door creaking open then closing with a thump" },
  { id: "nature", label: "Nature & Animals", prompt: "forest ambience with birds chirping and a dog barking in the distance" },
  { id: "custom", label: "Custom", prompt: "" },
] as const;
export const SURFACES = ["", "wooden floor", "concrete", "grass", "gravel", "snow", "water", "metal"] as const;

export const sfxRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(SFX_PROMPT_MAX),
  duration: z.number().min(0.5).max(22),
  influence: z.number().min(0).max(1).default(0.4),
}).strict();
export type SfxRequest = z.infer<typeof sfxRequestSchema>;

export function buildSfxPrompt(base: string, surface: string, extra: string) {
  return [base.trim(), surface ? `on ${surface}` : "", extra.trim()].filter(Boolean).join(", ").slice(0, SFX_PROMPT_MAX);
}

export type EditSettings = { volume: number; intensity: number; pitch: number; speed: number; duration: number; fadeOut: number };
export const DEFAULT_EDIT: EditSettings = { volume: 1, intensity: 0, pitch: 0, speed: 1, duration: 0, fadeOut: 0.05 };

/** Overlap-add time stretch: factor>1 makes audio longer, pitch unchanged. */
export function timeStretch(input: Float32Array, factor: number): Float32Array {
  if (Math.abs(factor - 1) < 1e-3) return input.slice();
  const win = 1024, synHop = 256, anaHop = synHop / factor;
  const outLen = Math.floor(input.length * factor);
  const out = new Float32Array(outLen + win);
  const norm = new Float32Array(outLen + win);
  const w = new Float32Array(win);
  for (let i = 0; i < win; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / win);
  for (let s = 0, a = 0; s < outLen; s += synHop, a += anaHop) {
    const start = Math.floor(a);
    for (let i = 0; i < win; i++) {
      const v = input[start + i] ?? 0;
      out[s + i]! += v * w[i]!;
      norm[s + i]! += w[i]!;
    }
  }
  const res = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) res[i] = norm[i]! > 1e-3 ? out[i]! / norm[i]! : 0;
  return res;
}

/** Linear resample; ratio>1 shortens (raises pitch). */
export function resample(input: Float32Array, ratio: number): Float32Array {
  const len = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const p = i * ratio, j = Math.floor(p), f = p - j;
    out[i] = (input[j] ?? 0) * (1 - f) + (input[j + 1] ?? 0) * f;
  }
  return out;
}

/** Applies pitch (semitones), speed, intensity, volume, duration (loop/trim) and fade. */
export function applyEdits(src: Float32Array, rate: number, e: EditSettings): Float32Array {
  const ratio = Math.pow(2, e.pitch / 12);
  // pitch shift = stretch by ratio then resample by ratio (keeps length); speed = stretch by 1/speed
  let x = timeStretch(src, ratio / e.speed);
  x = resample(x, ratio);
  if (e.duration > 0) {
    const target = Math.floor(e.duration * rate);
    const y = new Float32Array(target);
    for (let i = 0; i < target; i++) y[i] = x.length ? x[i % x.length]! : 0;
    x = y;
  }
  const drive = 1 + e.intensity * 6, k = Math.tanh(drive);
  const fade = Math.floor(Math.max(0, e.fadeOut) * rate);
  for (let i = 0; i < x.length; i++) {
    let v = e.intensity > 0 ? Math.tanh(x[i]! * drive) / k : x[i]!;
    v *= e.volume;
    const left = x.length - i;
    if (fade && left < fade) v *= left / fade;
    x[i] = Math.max(-1, Math.min(1, v));
  }
  return x;
}

export type TimelineClip = { id: string; data: Float32Array; start: number; gain: number };
export function mixTimeline(clips: TimelineClip[], rate: number): Float32Array {
  const len = clips.reduce((m, c) => Math.max(m, Math.floor(c.start * rate) + c.data.length), 0);
  const out = new Float32Array(len);
  for (const c of clips) {
    const off = Math.floor(c.start * rate);
    for (let i = 0; i < c.data.length; i++) out[off + i]! += c.data[i]! * c.gain;
  }
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i]!));
  return out;
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const s = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); s(8, "WAVE"); s(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  s(36, "data"); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), true);
  return new Blob([buf], { type: "audio/wav" });
}
