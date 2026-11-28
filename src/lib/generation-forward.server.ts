/**
 * Forwards every completed website creation to the owner's admin Telegram group
 * as media only (image, thumbnail, complete voiceover, video; individual speech
 * lines are never forwarded; Script-to-Video sends every
 * scene clip in order, then the final video). No text, prompt or user details.
 * Creations without a saved file (e.g. scripts) or over Telegram's ~50 MB bot limit are skipped (logged, no text). Claims are atomic
 * so the 5-minute schedule never double-posts; max 3 attempts per item.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { telegramApi } from "@/lib/telegram.server";
import { S2V_NOTIFY_CHAT_ID } from "@/lib/s2v-notify.server";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4" };
const LIMIT = 49 * 1024 * 1024;

/** Sends one stored file as photo / audio / video. Falls back to a bare download link when too large. */
export async function sendStoredMedia(path: string, name: string) {
  const { data: file } = await supabaseAdmin.storage.from("generations").download(path);
  if (!file) return false;
  const ext = path.split(".").pop()?.toLowerCase() ?? "bin";
  const mime = MIME[ext] ?? "application/octet-stream";
  if (file.size >= LIMIT) {
    // Telegram bots cannot upload files over ~50 MB; never fall back to text or links.
    console.error("Telegram media too large, skipped", { path, size: file.size });
    return false;
  }
  const [method, field] = mime.startsWith("image/") ? ["sendPhoto", "photo"] as const : mime.startsWith("audio/") ? ["sendAudio", "audio"] as const : mime === "video/mp4" ? ["sendVideo", "video"] as const : ["sendDocument", "document"] as const;
  const form = new FormData();
  form.append("chat_id", S2V_NOTIFY_CHAT_ID);
  form.append(field, new File([file], `${name}.${ext}`, { type: mime }));
  await telegramApi(method, form);
  return true;
}

async function deliverClaimed(id: string) {
  const { data: g, error } = await supabaseAdmin.from("generations").select("id,tool,output_path,telegram_approval_required,telegram_approved_at").eq("id", id).maybeSingle();
  if (error) throw new Error("DELIVERY_APPROVAL_CHECK_FAILED");
  if (!g) return;
  // Speech rows are individual dialogue fragments. Only the merged voice_full
  // export is deliverable, even if an older worker already claimed a fragment.
  if (g.tool === "voice") return;
  if (g.telegram_approval_required && !g.telegram_approved_at) return;
  const name = `${g.tool}-${id.slice(0, 8)}`;
  if (g.tool === "script_video") {
    const { data: p } = await supabaseAdmin.from("s2v_projects").select("id,final_video_path").eq("generation_id", id).maybeSingle();
    if (!p?.final_video_path) {
      // Not finished yet: release the claim so clips + full video go together later.
      await supabaseAdmin.from("generations").update({ telegram_claimed_at: null, telegram_attempts: 0 }).eq("id", id);
      return;
    }
    {
      const { data: scenes } = await supabaseAdmin.from("s2v_scenes").select("idx,video_path").eq("project_id", p.id).order("idx");
      for (const s of scenes ?? []) if (s.video_path) await sendStoredMedia(s.video_path, `${name}-clip-${s.idx + 1}`);
      if (!scenes?.length) {
        // Step-by-step studio: the render task records the exact ordered clips used in the final video.
        const { data: r } = await supabaseAdmin.from("s2v_tasks").select("input").eq("generation_id", id).eq("kind", "render").maybeSingle();
        const clips = ((r?.input as { clips?: unknown } | null)?.clips ?? []) as unknown[];
        for (let i = 0; i < clips.length; i++) if (typeof clips[i] === "string") await sendStoredMedia(clips[i] as string, `${name}-clip-${i + 1}`);
      }
      if (p.final_video_path) await sendStoredMedia(p.final_video_path, `${name}-full`);
    }
  } else {
    let path = g.output_path;
    if (!path && g.tool === "video") {
      const { data: job } = await supabaseAdmin.from("video_jobs").select("output_video_path").eq("generation_id", id).maybeSingle();
      path = job?.output_video_path ?? null;
    }
    if (g.tool === "voice_full") {
      if (!path || !(await sendStoredMedia(path, name))) throw new Error("COMPLETE_VOICEOVER_DELIVERY_FAILED");
    } else if (path) await sendStoredMedia(path, name);
  }
  await supabaseAdmin.from("generations").update({ telegram_sent_at: new Date().toISOString() }).eq("id", id);
}

/** A durable receipt owns the send, independently of the scheduler's expiring lease. */
export async function forwardOne(id: string) {
  const { data: claimed, error } = await supabaseAdmin.rpc("telegram_begin_generation", { _generation: id });
  if (error) throw new Error("DELIVERY_RECEIPT_CLAIM_FAILED");
  if (!claimed) return false;
  try {
    await deliverClaimed(id);
    const { error: receiptError } = await supabaseAdmin.from("telegram_generation_receipts")
      .update({ status: "sent", completed_at: new Date().toISOString() }).eq("generation_id", id);
    if (receiptError) throw new Error("DELIVERY_RECEIPT_SAVE_FAILED");
    return true;
  } catch (e) {
    // Telegram cannot deduplicate uploads: a timeout may still mean it accepted
    // the file. Never replay automatically, even after the scheduler lease expires.
    await supabaseAdmin.from("telegram_generation_receipts").update({ status: "review", error: e instanceof Error ? e.message : "Delivery outcome uncertain" }).eq("generation_id", id);
    throw e;
  }
}

/** Sends up to `limit` unsent creations (oldest first). Returns counts. */
export async function forwardPendingGenerations(limit = 15) {
  const { data: ids, error } = await supabaseAdmin.rpc("telegram_claim_generations", { _limit: limit });
  if (error) throw new Error("GENERATION_CLAIM_FAILED");
  let sent = 0, failed = 0;
  for (const id of (ids ?? []) as string[]) {
    try { if (await forwardOne(id)) sent++; }
    catch { failed++; console.error("Generation Telegram forward failed", { id }); }
  }
  return { sent, failed };
}
