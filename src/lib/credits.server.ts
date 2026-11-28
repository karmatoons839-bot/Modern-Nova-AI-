/**
 * Server-only credit enforcement. The browser never decides a balance:
 * every generation route verifies the bearer token here, then atomically
 * deducts credits in the database before calling the real AI engine and
 * refunds automatically if the engine fails.
 */
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireGenerationAvailable } from "./maintenance.server";

export const COSTS = { image: 1500, thumbnail: 2000, voicePerMinute: 1000 } as const;

export class CreditError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new CreditError(401, "LOGIN_REQUIRED", "Please log in to generate.");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) throw new CreditError(401, "LOGIN_REQUIRED", "Your session expired. Please log in again.");
  try { await requireGenerationAvailable(data.user.id); }
  catch (e) { const err = e as Error & { status?: number; code?: string }; throw new CreditError(err.status ?? 503, err.code ?? "SERVER_ISSUE", err.message); }
  return data.user;
}

/** ~150 spoken words per minute; minimum 1 credit per request. */
export function voiceCost(text: string) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil((words / 150) * COSTS.voicePerMinute));
}

/** Story price: 1 min = 20, each extra minute +15 (30 min = 455). */
export function storyCost(minutes: number) {
  return 20 + (Math.min(30, Math.max(1, Math.round(minutes))) - 1) * 15;
}

/** Website Script Studio only: 500 first minute + 200 each extra (30 min = 6,300). */
export function scriptStudioCost(minutes: number) {
  return 500 + (Math.min(30, Math.max(1, Math.round(minutes))) - 1) * 200;
}

export async function spend(userId: string, tool: "voice" | "image" | "thumbnail" | "music" | "story" | "video" | "script_video" | "sfx", cost: number, prompt: string, style: string | null) {
  try { await requireGenerationAvailable(userId); }
  catch (e) { const err = e as Error & { status?: number; code?: string }; throw new CreditError(err.status ?? 503, err.code ?? "SERVER_ISSUE", err.message); }
  const { data, error } = await supabaseAdmin.rpc("spend_credits", {
    _user: userId,
    _tool: tool,
    _cost: cost,
    _prompt: prompt,
    _style: style ?? "",
  });
  if (error) {
    if (error.message.includes("INSUFFICIENT_CREDITS"))
      throw new CreditError(402, "INSUFFICIENT_CREDITS", `Not enough credits. This needs ${cost} credits — upgrade your plan to continue.`);
    if (error.message.includes("ACCOUNT_SUSPENDED"))
      throw new CreditError(403, "ACCOUNT_SUSPENDED", "Your account is suspended. Please contact support.");
    if (error.message.includes("PROFILE_NOT_FOUND"))
      throw new CreditError(403, "PROFILE_NOT_FOUND", "Account not ready. Please log out and log in again.");
    throw new CreditError(500, "CREDIT_ERROR", "Could not check your credits. Please try again.");
  }
  return data as string;
}

export async function finish(generationId: string, ok: boolean, errorMessage?: string) {
  await supabaseAdmin.rpc("finish_generation", { _gid: generationId, _ok: ok, _error: errorMessage ?? "" });
}

export async function saveOutput(userId: string, generationId: string, b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const path = `${userId}/${generationId}.png`;
  const { error } = await supabaseAdmin.storage.from("generations").upload(path, bytes, { contentType: "image/png", upsert: true });
  if (!error) await supabaseAdmin.from("generations").update({ output_path: path }).eq("id", generationId);
}

export async function saveBinaryOutput(userId: string, generationId: string, bytes: Uint8Array, contentType: string) {
  const extension = contentType.includes("mpeg") ? "mp3" : contentType.includes("ogg") ? "ogg" : "wav";
  const path = `${userId}/${generationId}.${extension}`;
  const { error } = await supabaseAdmin.storage.from("generations").upload(path, bytes, { contentType, upsert: true });
  if (error) return false;
  await supabaseAdmin.from("generations").update({ output_path: path }).eq("id", generationId);
  return true;
}

export async function notifyGenerationComplete(generationId: string, outputStored: boolean) {
  const { data: generation } = await supabaseAdmin.from("generations").select("id, user_id, tool, prompt, style, cost").eq("id", generationId).maybeSingle();
  if (!generation) return;
  const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", generation.user_id).maybeSingle();
  const email = profile?.email ?? "Unknown user";
  const prompt = generation.prompt ?? "";
  await supabaseAdmin.rpc("admin_notify", {
    _type: "generation",
    _title: `[Modern Nova AI] ${generation.tool === "voice" ? "Voice-over" : generation.tool === "image" ? "Image" : "Thumbnail"} Generated`,
    _message: `${email} generated ${generation.tool}. Prompt: ${prompt.slice(0, 1200)}`,
    _priority: "low",
    _user: generation.user_id,
    _txn: generation.id,
    _meta: { email, tool: generation.tool, prompt: prompt.slice(0, 2000), style: generation.style, cost: generation.cost, output_stored: outputStored },
  });
}

export async function userPlan(userId: string): Promise<"free" | "creator" | "pro" | "premium"> {
  await supabaseAdmin.rpc("expire_subscriptions", { _user: userId });
  const { data } = await supabaseAdmin.from("profiles").select("plan").eq("id", userId).maybeSingle();
  return (data?.plan as "free" | "creator" | "pro" | "premium") ?? "free";
}

/** Owner voice access is independent of purchased plan; never inferred from credit balance or client flags. */
export async function userVoicePlan(userId: string): Promise<"free" | "creator" | "pro" | "premium"> {
  const { data, error } = await supabaseAdmin.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (error) throw new CreditError(503, 'VOICE_ACCESS_CHECK_FAILED', 'Could not verify voice access. Please try again.');
  return data === true ? 'premium' : userPlan(userId);
}

export function creditErrorResponse(e: CreditError) {
  return Response.json({ detail: e.message, error: e.code, message: e.message }, { status: e.status });
}
