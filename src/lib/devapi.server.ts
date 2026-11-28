/**
 * Developer API engine. External websites call /api/public/v1/<service>/generate with
 * Authorization: Bearer mnva_live_… . Flow: key hash lookup → status → service permission →
 * rate limit → atomic API-wallet spend → real AI engine → refund on failure → usage log.
 * The API wallet is fully separate from website credits; nothing here touches profiles.credits.
 */
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { API_SERVICES, apiCost, type ApiServiceId } from "./devapi-config";

export function newApiKey() {
  const key = `mnva_live_${randomBytes(24).toString("base64url")}`;
  return { key, hash: hashKey(key), prefix: `${key.slice(0, 14)}…${key.slice(-4)}` };
}
export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function fail(status: number, error: string, message: string) {
  return Response.json({ success: false, error, message }, { status, headers: { "Cache-Control": "no-store" } });
}

const Story = z.object({
  prompt: z.string().trim().min(1).max(300),
  duration: z.number().int().min(1).max(30).default(5),
  style: z.enum(["horror", "moral"]).default("horror"),
  language: z.string().trim().min(2).max(40).default("Hindi"),
});
const Speech = z.object({
  text: z.string().trim().min(1).max(4000),
  voice_id: z.string().trim().min(1).max(40).default("ZV001"),
  emotion: z.string().trim().max(30).optional(),
});
const Img = z.object({
  prompt: z.string().trim().min(3).max(5000),
  style: z.string().max(40).optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  text: z.string().max(100).optional(),
});

async function run(service: ApiServiceId, body: unknown): Promise<{ cost: number; exec: () => Promise<Record<string, unknown>> }> {
  switch (service) {
    case "story": {
      const b = Story.parse(body);
      return {
        cost: apiCost(service, b),
        exec: async () => {
          const eng = await import("./story-engine.server");
          const raw = b.style === "horror"
            ? await eng.runHorrorEngine({ topic: b.prompt, language: b.language, minutes: b.duration })
            : await eng.runMoralEngine({ title: b.prompt, language: b.language, minutes: b.duration });
          return { result: eng.cleanStory(raw) };
        },
      };
    }
    case "story-voice":
    case "text-to-speech": {
      const b = Speech.parse(body);
      return {
        cost: apiCost(service, b),
        exec: async () => {
          const v = await import("./voice-engine.server");
          const profile = v.findVoice(b.voice_id);
          if (!profile) throw Object.assign(new Error(`No voice profile found for ${b.voice_id}.`), { status: 404 });
          const r = await v.generateSpeech({ profile, text: b.text, emotion: b.emotion ?? null });
          if (!r.ok) throw Object.assign(new Error(r.message), { status: r.status });
          const bytes = new Uint8Array(await new Response(r.body).arrayBuffer());
          let bin = "";
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return { result: { audio_base64: btoa(bin), content_type: r.contentType, voice_id: b.voice_id } };
        },
      };
    }
    case "text-to-image":
    case "background": {
      const b = Img.parse(body);
      return {
        cost: apiCost(service, b),
        exec: async () => {
          const img = await import("./image-engine.server");
          const prompt = service === "background"
            ? `Background scene only, no people or characters, no text, wide clean composition usable behind content: ${b.prompt}`
            : b.prompt;
          const req = img.parseImageRequest({ prompt, style: b.style ?? (service === "background" ? "cinematic" : "2d-animation"), width: b.width, height: b.height });
          const out = await img.createImage(req);
          return { result: { image_base64: out.data[0]!.b64_json, width: req.width, height: req.height } };
        },
      };
    }
    case "thumbnail": {
      const b = Img.parse(body);
      return {
        cost: apiCost(service, b),
        exec: async () => {
          const img = await import("./image-engine.server");
          const req = img.parseThumbRequest({ prompt: b.prompt, style: b.style ?? "youtube", width: b.width ?? 1536, height: b.height ?? 1024, text: b.text });
          const out = await img.createThumbnail(req);
          return { result: { image_base64: out.data[0]!.b64_json, width: req.width, height: req.height } };
        },
      };
    }
    default:
      throw Object.assign(new Error("This service is not available yet."), { status: 404, code: "SERVICE_NOT_AVAILABLE" });
  }
}

export async function handleApiRequest(request: Request, service: string) {
  const started = Date.now();
  const auth = request.headers.get("authorization") ?? "";
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!key.startsWith("mnva_live_") || key.length > 100) return fail(401, "INVALID_API_KEY", "Send a valid key in the Authorization: Bearer header.");

  const { data: api } = await supabaseAdmin.from("api_projects").select("id, user_id, status, services, rate_limit_per_min").eq("key_hash", hashKey(key)).maybeSingle();
  if (!api) return fail(401, "INVALID_API_KEY", "This API key is invalid or was revoked.");
  try { const { requireGenerationAvailable } = await import("./maintenance.server"); await requireGenerationAvailable(api.user_id); }
  catch (e) { const error = e as Error & { status?: number; code?: string }; return fail(error.status ?? 503, error.code ?? "SERVER_ISSUE", error.message); }
  if (api.status !== "active") return fail(403, "API_DISABLED", "This API is disabled.");
  const def = API_SERVICES.find((s) => s.id === service);
  if (!def || !def.available) return fail(404, "SERVICE_NOT_AVAILABLE", "Unknown or unavailable service.");
  if (!api.services.includes(service)) return fail(403, "SERVICE_NOT_ENABLED", "This service is not enabled for this API.");

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabaseAdmin.from("api_requests").select("id", { count: "exact", head: true }).eq("api_id", api.id).gte("created_at", since);
  if ((count ?? 0) >= api.rate_limit_per_min) return fail(429, "RATE_LIMIT_EXCEEDED", `Limit is ${api.rate_limit_per_min} requests per minute.`);

  const log = (status_code: number, credits_used = 0) =>
    supabaseAdmin.from("api_requests").insert({ api_id: api.id, user_id: api.user_id, service, status_code, credits_used, duration_ms: Date.now() - started });

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 20000) { await log(413); return fail(413, "PAYLOAD_TOO_LARGE", "Request body is too large."); }
    body = JSON.parse(text || "{}");
  } catch {
    await log(400);
    return fail(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  let job;
  try {
    job = await run(service as ApiServiceId, body);
  } catch (e) {
    await log(400);
    const msg = e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : e instanceof Error ? e.message : "Invalid request";
    return fail(400, "INVALID_REQUEST", msg);
  }

  const requestId = `req_${randomBytes(10).toString("hex")}`;
  const { data: tx, error: spendErr } = await supabaseAdmin.rpc("api_spend", { _user: api.user_id, _api: api.id, _service: service, _cost: job.cost, _request: requestId });
  if (spendErr) {
    await log(402);
    if (spendErr.message.includes("INSUFFICIENT_API_CREDITS")) return fail(402, "INSUFFICIENT_API_CREDITS", `This request needs ${job.cost} API credits.`);
    return fail(500, "CREDIT_ERROR", "Could not check API credits.");
  }

  try {
    const out = await job.exec();
    await supabaseAdmin.rpc("api_finish", { _tx: tx as string, _ok: true });
    await log(200, job.cost);
    const { data: w } = await supabaseAdmin.from("api_wallets").select("balance").eq("user_id", api.user_id).maybeSingle();
    return Response.json({ success: true, request_id: requestId, service, ...out, credits_used: job.cost, remaining_credits: w?.balance ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await supabaseAdmin.rpc("api_finish", { _tx: tx as string, _ok: false });
    const status = (e as { status?: number }).status ?? 502;
    await log(status);
    return fail(status >= 400 && status < 600 ? status : 502, "GENERATION_FAILED", `Server issue. ${e instanceof Error ? e.message : "Generation failed."} Credits were refunded.`);
  }
}
