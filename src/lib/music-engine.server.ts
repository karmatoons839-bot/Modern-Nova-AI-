/**
 * Isolated music provider interface (ZIP "Music Maker API" contract).
 * The provider receives the generation JSON and returns {"audio_url": "..."}.
 * Configure MUSIC_PROVIDER_URL (+ optional MUSIC_PROVIDER_API_KEY) to connect a real engine.
 */
import { z } from "zod";
import { MUSIC_INSTRUMENTS, MUSIC_MOODS, MUSIC_PROMPT_MAX, MUSIC_TYPES } from "./music";

export const musicRequestSchema = z
  .object({
    prompt: z.string().trim().min(3).max(MUSIC_PROMPT_MAX),
    mood: z.enum(MUSIC_MOODS),
    musicType: z.enum(MUSIC_TYPES),
    duration: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(90)]),
    instruments: z.array(z.enum(MUSIC_INSTRUMENTS)).max(7).default([]),
  })
  .strict(); // rejects creditCost or any other extra field from the browser

export type MusicRequest = z.infer<typeof musicRequestSchema>;

export class MusicEngineError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function musicProviderConfigured() {
  return Boolean(process.env["GOOGLE_AI_STUDIO_API_KEY"] || process.env["MUSIC_PROVIDER_URL"]);
}

function wavFromPcm(pcm: Uint8Array, rate: number, channels: number) {
  const h = new DataView(new ArrayBuffer(44));
  const w = (o: number, t: string) => { for (let i = 0; i < t.length; i++) h.setUint8(o + i, t.charCodeAt(i)); };
  w(0, "RIFF"); h.setUint32(4, 36 + pcm.byteLength, true); w(8, "WAVE"); w(12, "fmt ");
  h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, channels, true); h.setUint32(24, rate, true);
  h.setUint32(28, rate * channels * 2, true); h.setUint16(32, channels * 2, true); h.setUint16(34, 16, true);
  w(36, "data"); h.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength); out.set(new Uint8Array(h.buffer), 0); out.set(pcm, 44); return out;
}

/** Google AI Studio Lyria RealTime (user's own key): stream PCM until the requested duration is captured. */
async function generateWithGoogle(req: MusicRequest, key: string): Promise<{ bytes: Uint8Array; contentType: string }> {
  const prompts = [
    { text: req.prompt, weight: 1.0 },
    { text: `${req.mood} mood, ${req.musicType}`, weight: 0.6 },
    ...(req.instruments.length ? [{ text: req.instruments.join(", "), weight: 0.5 }] : []),
  ];
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic?key=${encodeURIComponent(key)}`);
    let rate = 48000, channels = 2, done = false;
    const chunks: Uint8Array[] = []; let total = 0;
    const finish = (err?: Error) => {
      if (done) return; done = true; clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      if (err) return reject(err);
      const pcm = new Uint8Array(total); let o = 0; for (const c of chunks) { pcm.set(c, o); o += c.byteLength; }
      resolve({ bytes: wavFromPcm(pcm.subarray(0, Math.min(total, rate * channels * 2 * req.duration)), rate, channels), contentType: "audio/wav" });
    };
    const timer = setTimeout(() => finish(total > 0 ? undefined : new MusicEngineError(504, "Google music engine timed out before sending audio.")), (req.duration * 2 + 30) * 1000);
    ws.addEventListener("open", () => ws.send(JSON.stringify({ setup: { model: "models/lyria-realtime-exp" } })));
    ws.addEventListener("message", async (ev) => {
      const text = typeof ev.data === "string" ? ev.data : await new Response(ev.data as Blob).text();
      let m: { setupComplete?: unknown; serverContent?: { audioChunks?: { data: string; mimeType?: string }[] }; filteredPrompt?: { filteredReason?: string } };
      try { m = JSON.parse(text); } catch { return; }
      if (m.setupComplete) {
        ws.send(JSON.stringify({ clientContent: { weightedPrompts: prompts } }));
        ws.send(JSON.stringify({ playbackControl: "PLAY" }));
      } else if (m.filteredPrompt) {
        finish(new MusicEngineError(400, `Google blocked this music prompt${m.filteredPrompt.filteredReason ? `: ${m.filteredPrompt.filteredReason}` : ""}.`));
      } else if (m.serverContent?.audioChunks) {
        for (const c of m.serverContent.audioChunks) {
          const r = /rate=(\d+)/.exec(c.mimeType ?? ""); const ch = /channels=(\d+)/.exec(c.mimeType ?? "");
          if (r) rate = Number(r[1]); if (ch) channels = Number(ch[1]);
          const b = Uint8Array.from(atob(c.data), (x) => x.charCodeAt(0)); chunks.push(b); total += b.byteLength;
        }
        if (total >= rate * channels * 2 * req.duration) finish();
      }
    });
    ws.addEventListener("error", () => finish(new MusicEngineError(502, "Could not connect to Google music engine (check the API key).")));
    ws.addEventListener("close", (ev) => { if (!done) finish(total > 0 ? undefined : new MusicEngineError(502, `Google music engine closed (${ev.code}${ev.reason ? `: ${ev.reason}` : ""}).`)); });
  });
}

export async function generateMusic(req: MusicRequest, generationId: string) {
  const googleKey = process.env["GOOGLE_AI_STUDIO_API_KEY"];
  if (googleKey) return generateWithGoogle(req, googleKey);
  const url = process.env["MUSIC_PROVIDER_URL"];
  if (!url) throw new MusicEngineError(503, "Music generation service is not connected yet. Your credits were not charged.");
  const key = process.env["MUSIC_PROVIDER_API_KEY"] ?? "";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ ...req, generation_id: generationId }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new MusicEngineError(502, `Music engine error (HTTP ${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`);
  }
  const data = (await res.json().catch(() => null)) as { audio_url?: string; url?: string } | null;
  const audioUrl = data?.audio_url || data?.url;
  if (!audioUrl) throw new MusicEngineError(502, "Music engine returned no audio.");
  const audio = await fetch(audioUrl);
  if (!audio.ok) throw new MusicEngineError(502, `Could not download generated audio (HTTP ${audio.status}).`);
  const contentType = audio.headers.get("content-type") || "audio/mpeg";
  if (!contentType.startsWith("audio/")) throw new MusicEngineError(502, "Music engine returned a non-audio file.");
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (bytes.byteLength < 1000) throw new MusicEngineError(502, "Music engine returned an empty audio file.");
  return { bytes, contentType };
}
