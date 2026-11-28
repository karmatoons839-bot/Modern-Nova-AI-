/**
 * Server-side port of the two uploaded ZIP APIs:
 *  - Professional Text-to-Image API     (POST /v1/images/generations)
 *  - Professional Text-to-Thumbnail API (POST /v1/thumbnails/generations)
 *
 * Request validation, style presets, prompt enhancement, negative prompts and
 * response shapes are copied from the ZIPs' FastAPI code (kept for reference in
 * src/data/*-api-original). The ZIPs' SDXL pipeline needs a GPU Python server,
 * so generation runs in one of two real backends:
 *   1. If IMAGE_API_BASE_URL / THUMBNAIL_API_BASE_URL (+ *_API_KEY) are set,
 *      requests are proxied to the user's self-hosted ZIP server unchanged.
 *   2. Otherwise the real Lovable AI image model generates the image.
 * No placeholder or cached images are ever returned.
 */
import { astraText } from "./ai.server";

const GATEWAY = "https://ai.gateway.lovable.dev";
export const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
  }
}

// ---------- Styles (verbatim from the ZIPs) ----------
export const IMAGE_STYLES: Record<string, string> = {
  "2d-animation": "high-quality 2D animation illustration, clean line art, expressive characters, polished background",
  "3d-animation": "high-quality 3D animated film render, stylized characters, detailed materials, cinematic lighting",
  anime: "premium anime illustration, detailed character design, cinematic composition",
  cartoon: "professional cartoon illustration, clean shapes, expressive characters, polished colors",
  comic: "cinematic comic-book illustration, strong composition, detailed ink and shading",
  horror: "atmospheric horror animation art, eerie environment, suspenseful cinematic lighting, unsettling mood",
  "moral-story": "warm Indian moral-story animation illustration, expressive characters, storybook composition",
  cinematic: "cinematic concept art, dramatic lighting, depth, highly detailed environment",
  realistic: "photorealistic cinematic image, natural lighting, realistic materials",
  fantasy: "epic fantasy illustration, cinematic environment, magical atmosphere",
  storybook: "beautiful children's storybook illustration, polished hand-painted look",
  watercolor: "detailed watercolor illustration, soft paper texture, artistic composition",
  "pixel-art": "high-quality pixel art, carefully composed scene, crisp pixels",
  custom: "",
};

// Thumbnail ZIP styles, plus 2D/3D/realistic presets the website requires.
export const THUMBNAIL_STYLES: Record<string, string> = {
  youtube: "professional YouTube thumbnail, extremely strong visual hierarchy, cinematic composition, dramatic lighting, expressive subject, high contrast, clear focal point, polished creator thumbnail",
  horror: "professional horror YouTube thumbnail, terrifying atmosphere, dramatic cinematic lighting, suspense, expressive face, dark environment, strong focal point",
  story: "professional animated story thumbnail, expressive characters, cinematic scene, colorful polished environment, strong storytelling composition",
  "moral-story": "professional family-friendly moral story thumbnail, expressive characters, colorful cinematic environment, clear storytelling",
  gaming: "professional gaming thumbnail, dynamic action, dramatic lighting, energetic composition, polished high-impact creator design",
  cinematic: "professional cinematic thumbnail, dramatic lighting, depth, premium composition, striking focal subject",
  kids: "professional colorful kids animation thumbnail, friendly expressive characters, bright polished environment, clear focal point",
  news: "professional editorial news thumbnail, clean composition, strong subject separation, dramatic but credible visual treatment",
  "2d-animation": "professional 2D animation YouTube thumbnail, clean bold line art, expressive exaggerated characters, vivid colors, high contrast, clear focal point",
  "3d-animation": "professional 3D animated film YouTube thumbnail, Pixar-quality stylized characters, cinematic rim lighting, depth of field, high contrast",
  realistic: "professional photorealistic YouTube thumbnail, cinematic lighting, sharp subject, shallow depth of field, high contrast, expressive face",
  cartoon: "professional cartoon YouTube thumbnail, bold outlines, funny exaggerated expressive characters, bright saturated colors, high contrast, clear focal point",
  custom: "professional high-impact YouTube thumbnail, strong composition, cinematic lighting, clear focal point",
};

const IMAGE_NEG =
  "low quality, blurry, distorted anatomy, duplicate characters, bad hands, text, watermark, logo, cropped, oversaturated";
const THUMB_NEG =
  "blurry, low quality, cluttered composition, duplicate subjects, distorted face, bad hands, watermark, logo, unreadable text, cropped subject";

// ---------- Validation (mirrors the pydantic models) ----------
function int(v: unknown, def: number, min: number, max: number, field: string) {
  if (v === undefined || v === null) return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new ApiError(422, `${field} must be an integer between ${min} and ${max}`);
  return n;
}

type Body = { prompt?: unknown; style?: unknown; negative_prompt?: unknown; guidance_scale?: unknown; width?: unknown; height?: unknown; steps?: unknown; seed?: unknown };

export type ImageRequest = {
  prompt: string;
  negative_prompt: string | null;
  style: string;
  width: number;
  height: number;
  steps: number;
  guidance_scale: number;
  seed: number | null;
};

export function parseImageRequest(body: unknown): ImageRequest {
  const b = (body ?? {}) as Body;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (prompt.length < 1 || prompt.length > 100000) throw new ApiError(422, "prompt is too long");
  const style = typeof b.style === "string" ? b.style : "2d-animation";
  if (!(style in IMAGE_STYLES)) throw new ApiError(422, `style must be one of: ${Object.keys(IMAGE_STYLES).join(", ")}`);
  const neg = typeof b.negative_prompt === "string" ? b.negative_prompt.slice(0, 3000) : null;
  const g = b.guidance_scale === undefined ? 7 : Number(b.guidance_scale);
  if (!Number.isFinite(g) || g < 1 || g > 20) throw new ApiError(422, "guidance_scale must be between 1 and 20");
  return {
    prompt,
    negative_prompt: neg,
    style,
    width: int(b.width, 1024, 512, 1536, "width"),
    height: int(b.height, 1024, 512, 1536, "height"),
    steps: int(b.steps, 30, 10, 60, "steps"),
    guidance_scale: g,
    seed: b.seed === undefined || b.seed === null ? null : int(b.seed, 0, 0, 2 ** 32 - 1, "seed"),
  };
}

export type ThumbRequest = { prompt: string; style: string; width: number; height: number; seed: number | null; text?: string | undefined };

function thumbText(b: Body): string | undefined {
  const t = (b as { text?: unknown }).text;
  if (t === undefined || t === null || t === "") return undefined;
  if (typeof t !== "string" || t.trim().length > 2000) throw new ApiError(422, "text is too long");
  return t.trim() || undefined;
}

export function parseThumbRequest(body: unknown): ThumbRequest {
  const b = (body ?? {}) as Body;
  const prompt = typeof b.prompt === "string" ? b.prompt.trim() : "";
  if (prompt.length < 3 || prompt.length > 100000) throw new ApiError(422, "prompt is too long");
  const style = typeof b.style === "string" ? b.style : "youtube";
  if (!(style in THUMBNAIL_STYLES))
    throw new ApiError(422, `style must be one of: ${Object.keys(THUMBNAIL_STYLES).join(", ")}`);
  return {
    prompt,
    style,
    width: int(b.width, 1280, 360, 1536, "width"),
    height: int(b.height, 720, 360, 1536, "height"),
    seed: b.seed === undefined || b.seed === null ? null : int(b.seed, 0, 0, 2 ** 32 - 1, "seed"),
    ...(thumbText(b) ? { text: thumbText(b) } : {}),
  };
}

// ---------- Real generation backends ----------
function engineSize(w: number, h: number) {
  const r = w / h;
  if (r > 1.6) return "1536x864"; // 16:9 thumbnails
  if (r > 1.15) return "1536x1024";
  if (r < 0.87) return "1024x1536";
  return "1024x1024";
}

async function gatewayImage(prompt: string, size: string, quality: string, service: "image" | "thumbnail" = "image"): Promise<string> {
  const { resolveProvider } = await import("./api-providers.server");
  const provider = await resolveProvider(service, { base: GATEWAY, model: IMAGE_MODEL });
  if (!provider) throw new ApiError(500, "Image engine credentials are not configured on the server");
  const apiKey = provider.key;
  const res = await fetch(`${provider.base}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({ model: provider.model, prompt, size, quality, stream: true, partial_images: 1 }),
  });
  if (!res.ok || !res.body) {
    let msg = `Image engine returned HTTP ${res.status}`;
    try {
      const t = await res.text();
      const j = JSON.parse(t) as { error?: { message?: string }; message?: string };
      msg = j.error?.message || j.message || msg;
    } catch {
      /* keep status message */
    }
    if (res.status === 402)
      throw new ApiError(503, "Generation service is temporarily unavailable. Your credits were not charged — please try again later.");
    throw new ApiError(res.status === 429 || res.status === 403 ? res.status : 502, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let final: string | null = null;
  let error: string | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data) as { type?: string; b64_json?: string; error?: { message?: string } };
        if (ev.type === "image_generation.completed" && ev.b64_json) final = ev.b64_json;
        else if (ev.type === "error") error = ev.error?.message || "Image engine reported an error";
      } catch {
        /* partial JSON line, ignore */
      }
    }
  }
  if (error) throw new ApiError(400, error);
  if (!final) throw new ApiError(502, "Image engine stream ended without a completed image");
  return final;
}

async function proxy(baseEnv: string, keyEnv: string, path: string, body: unknown) {
  const base = process.env[baseEnv]?.replace(/\/$/, "");
  if (!base) return null;
  const key = process.env[keyEnv] ?? "";
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, `Self-hosted API error: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as { data: { url: string }[] };
  // Fetch the PNG server-side so the browser never needs the API key.
  const img = await fetch(`${base}${json.data[0]!.url}`, { headers: { "X-API-Key": key } });
  if (!img.ok) throw new ApiError(img.status, "Self-hosted API could not return the image file");
  const bytes = new Uint8Array(await img.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { json, b64: btoa(bin) };
}

const randSeed = () => Math.floor(Math.random() * 2 ** 32);

export async function createImage(req: ImageRequest, hd = false) {
  const started = Date.now();
  const seed = req.seed ?? randSeed();
  const proxied = await proxy("IMAGE_API_BASE_URL", "IMAGE_API_KEY_UPSTREAM", "/v1/images/generations", { ...req, seed });
  let b64: string;
  let model: string;
  if (proxied) {
    b64 = proxied.b64;
    model = "self-hosted-zip-api";
  } else {
    const prefix = IMAGE_STYLES[req.style] ?? "";
    const full = `${prefix ? `${prefix}. ` : ""}${req.prompt}`;
    const prompt = `${full}\n\nAvoid: ${req.negative_prompt || IMAGE_NEG}. Variation seed ${seed}.`;
    b64 = await gatewayImage(prompt, engineSize(req.width, req.height), hd ? "high" : "medium");
    model = IMAGE_MODEL;
  }
  return {
    id: crypto.randomUUID(),
    object: "image.generation",
    created: Math.floor(Date.now() / 1000),
    model,
    data: [{ url: `data:image/png;base64,${b64}`, b64_json: b64, width: req.width, height: req.height, seed }],
    usage: { generation_time_seconds: Math.round((Date.now() - started) / 10) / 100, steps: req.steps },
  };
}

async function analyzeThumbnailPrompt(prompt: string, style: string) {
  try {
    const out = await astraText(
      "You are a senior YouTube thumbnail art director. Read the user's video/story idea and write ONE dense visual brief (max 90 words) for a single thumbnail image: the main subject and its exaggerated facial expression, the key story moment, foreground/background layering, camera angle, lighting and color contrast. Stay faithful to the idea; do not invent unrelated elements. No text or letters in the image. Output only the brief.",
      `Style: ${style}\nIdea: ${prompt}`,
    );
    return out.trim() || null;
  } catch {
    return null; // analysis is an enhancement; generation still uses the user's real prompt
  }
}

export async function createThumbnail(req: ThumbRequest, hd = true) {
  const started = Date.now();
  const seed = req.seed ?? randSeed();
  const proxied = await proxy("THUMBNAIL_API_BASE_URL", "THUMBNAIL_API_KEY_UPSTREAM", "/v1/thumbnails/generations", {
    ...req,
    seed,
  });
  let b64: string;
  let brief: string | null = null;
  if (proxied) {
    b64 = proxied.b64;
  } else {
    brief = await analyzeThumbnailPrompt(req.prompt, req.style);
    const style = THUMBNAIL_STYLES[req.style] ?? THUMBNAIL_STYLES["custom"];
    const enhanced = `${style}. Subject/story: ${req.prompt}.${brief ? ` Art direction: ${brief}` : ""} ${req.text ? ` Add this exact title text in large, bold, perfectly spelled, highly readable thumbnail lettering with strong outline/shadow, placed where it does not cover the main face: "${req.text}". No other text.` : " No random text."} No watermark, no logo, no distorted anatomy, no clutter.\n\nAvoid: ${req.text ? THUMB_NEG.replace(", unreadable text", "") + ", misspelled text" : THUMB_NEG}. Variation seed ${seed}.`;
    b64 = await gatewayImage(enhanced, engineSize(req.width, req.height), hd ? "high" : "medium", "thumbnail");
  }
  return {
    id: crypto.randomUUID(),
    object: "thumbnail.generation",
    data: [{ url: `data:image/png;base64,${b64}`, b64_json: b64, width: req.width, height: req.height, seed }],
    usage: { generation_time_seconds: Math.round((Date.now() - started) / 10) / 100 },
    analysis: brief,
  };
}

export function errorResponse(e: unknown) {
  const status = e instanceof ApiError ? e.status : 500;
  const detail = e instanceof Error ? e.message : "Unknown error";
  return Response.json({ detail }, { status, headers: { "Cache-Control": "no-store" } });
}

/** ZIP auth: X-API-Key must equal the server's API key (for external callers). */
export function checkApiKey(request: Request, envName: string) {
  const key = process.env[envName];
  if (!key) throw new ApiError(500, "API_KEY is not configured");
  if (request.headers.get("x-api-key") !== key) throw new ApiError(401, "Invalid API key");
}
