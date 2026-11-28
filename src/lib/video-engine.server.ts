/**
 * Server-only video engine. Talks to the Lovable AI Gateway video model
 * (google/gemini-omni-1.1-flash) — the only capabilities advertised to the
 * UI are the ones verified from the live model listing:
 *   - durations: 3-10s (we offer every whole second 3-10)
 *   - aspect ratios: 16:9 and 9:16 only (1:1 is NOT supported)
 *   - resolution: 720p (billed per second)
 * The browser never sees the gateway key and cannot pick the engine model.
 */
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev";
export const VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export const VIDEO_PROVIDER = "lovable-ai-gateway";

export const VIDEO_ASPECTS = ["16:9", "9:16"] as const;
export const VIDEO_DURATIONS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export const VIDEO_STYLES = ["realistic", "cinematic", "horror", "animation", "cartoon"] as const;

/** Transparent price: 1,000 credits per generated second (5s=5,000, 10s=10,000). */
export const VIDEO_CREDITS_PER_SECOND = 1000;
export function videoCost(seconds: number) {
  return seconds * VIDEO_CREDITS_PER_SECOND;
}

const STYLE_PROMPTS: Record<(typeof VIDEO_STYLES)[number], string> = {
  realistic: "Photorealistic footage, natural lighting, real-world detail",
  cinematic: "Cinematic film look, dramatic lighting, shallow depth of field, film grain",
  horror: "Dark horror atmosphere, eerie mood, unsettling shadows, muted cold colors",
  animation: "High-quality 3D animated style, smooth motion, vibrant rendering",
  cartoon: "Colorful 2D cartoon style, bold outlines, playful motion",
};

export const videoRequestSchema = z
  .object({
    mode: z.enum(["text", "image"]),
    prompt: z.string().trim().min(3).max(4000),
    negativePrompt: z.string().trim().max(1000).optional(),
    aspectRatio: z.enum(VIDEO_ASPECTS),
    duration: z.number().int().min(3).max(10),
    style: z.enum(VIDEO_STYLES),
    imageData: z.string().max(14_000_000).optional(), // base64, ~10MB decoded
    imageMime: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
  })
  .strict()
  .refine((v) => v.mode !== "image" || (v.imageData && v.imageMime), {
    message: "IMAGE_REQUIRED",
  });

export type VideoRequest = z.infer<typeof videoRequestSchema>;

export class VideoEngineError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function videoConfigured() {
  return Boolean(process.env["LOVABLE_API_KEY"]);
}

export function composePrompt(req: VideoRequest) {
  const parts = [`${STYLE_PROMPTS[req.style]}. ${req.prompt}`];
  if (req.negativePrompt) parts.push(`No ${req.negativePrompt.replace(/^no\s+/i, "")}.`);
  return parts.join("\n");
}

export type VideoJob = {
  id: string;
  status: "queued" | "in_progress" | "completed" | "failed";
  progress?: number;
  error?: { code: string; message: string };
};

async function jobResponse(res: Response): Promise<VideoJob> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; error?: { message?: string } } | null;
    const message = body?.error?.message || body?.message || `Video engine error (HTTP ${res.status})`;
    if (res.status === 402) throw new VideoEngineError(503, "ENGINE_UNAVAILABLE", "Video service is temporarily unavailable. Please try again later.");
    if (res.status === 429) throw new VideoEngineError(429, "RATE_LIMITED", "The video engine is busy right now. Please try again in a minute.");
    throw new VideoEngineError(res.status >= 500 ? 502 : res.status, "ENGINE_ERROR", message);
  }
  return res.json() as Promise<VideoJob>;
}

function apiKey() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new VideoEngineError(503, "NOT_CONFIGURED", "Video generation is not configured on the server yet. Your credits were not charged.");
  return key;
}

export async function createVideo(req: VideoRequest): Promise<VideoJob> {
  const input: unknown = req.mode === "image"
    ? [
        { type: "text", text: composePrompt(req) },
        { type: "image", data: req.imageData!, mime_type: req.imageMime! },
      ]
    : composePrompt(req);
  return jobResponse(
    await fetch(`${GATEWAY}/v1/videos`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: VIDEO_MODEL,
        input,
        response_format: {
          type: "video",
          resolution: "720p",
          duration: `${req.duration}s`,
          aspect_ratio: req.aspectRatio,
        },
      }),
    }),
  );
}

export async function pollVideo(providerJobId: string): Promise<VideoJob> {
  return jobResponse(
    await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(providerJobId)}`, {
      headers: { Authorization: `Bearer ${apiKey()}` },
    }),
  );
}

export async function downloadVideo(providerJobId: string): Promise<Uint8Array> {
  const res = await fetch(`${GATEWAY}/v1/videos/${encodeURIComponent(providerJobId)}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) throw new VideoEngineError(502, "DOWNLOAD_FAILED", `Could not download the finished video (HTTP ${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength < 1000) throw new VideoEngineError(502, "DOWNLOAD_FAILED", "The video engine returned an empty file.");
  return bytes;
}

export function videoErrorResponse(e: unknown) {
  if (e instanceof VideoEngineError)
    return Response.json({ detail: e.message, error: e.code, message: e.message }, { status: e.status });
  if (e instanceof z.ZodError)
    return Response.json({ detail: e.issues[0]?.message ?? "Invalid request", error: "INVALID_REQUEST", message: e.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  return Response.json({ detail: "Video generation failed. Please try again.", error: "ENGINE_ERROR", message: "Video generation failed." }, { status: 502 });
}
