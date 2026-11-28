import type { SfxRequest } from "./sfx";

export class SfxEngineError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Real ElevenLabs sound-generation call; key stays server-side. */
export async function generateSfx(req: SfxRequest) {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new SfxEngineError(503, "Sound effects engine is not connected yet. Your credits were refunded.");
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ text: req.prompt, duration_seconds: req.duration, prompt_influence: req.influence }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`SFX engine failed [${res.status}]: ${body}`);
    throw new SfxEngineError(502, `Sound engine error (HTTP ${res.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 500) throw new SfxEngineError(502, "Sound engine returned empty audio.");
  return bytes;
}
