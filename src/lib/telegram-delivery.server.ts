import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { telegramApi } from "./telegram.server";
import { recoveryAllowed } from "./telegram-workflows";

export async function deliverTelegram(id: string) {
  const { data: claimed, error } = await supabaseAdmin.rpc("telegram_claim_delivery", { _id: id });
  if (error) throw new Error("DELIVERY_CLAIM_FAILED");
  if (!claimed) return false;
  const { data: row } = await supabaseAdmin.from("telegram_deliveries").select("*").eq("id", id).single();
  if (!row) throw new Error("DELIVERY_NOT_FOUND");
  try {
    if (row.website_user_id) {
      const { data: link } = await supabaseAdmin.from("telegram_account_links").select("website_user_id,notify_account,notify_announcements").eq("telegram_user_id", row.chat_id).maybeSingle();
      if (link?.website_user_id !== row.website_user_id) throw new Error("LINK_REVOKED");
      if (row.dedupe_key.startsWith("broadcast:") && !link.notify_announcements) throw new Error("CONSENT_REVOKED");
      if (/^(generation|payment):/.test(row.dedupe_key) && !link.notify_account) throw new Error("CONSENT_REVOKED");
    }
    let result: { message_id: number };
    if (row.generation_id) {
      const { data: generation } = await supabaseAdmin.from("generations").select("user_id,status,output_path").eq("id", row.generation_id).maybeSingle();
      if (!generation || !recoveryAllowed(row.website_user_id ?? undefined, generation) || !generation.output_path) throw new Error("RECOVERY_FORBIDDEN");
      const { data: file, error: fileError } = await supabaseAdmin.storage.from("generations").download(generation.output_path);
      if (fileError || !file) throw new Error("STORED_FILE_MISSING");
      if (file.size > 45 * 1024 * 1024) throw new Error("FILE_TOO_LARGE_USE_WEBSITE");
      const form = new FormData();
      form.set("chat_id", row.chat_id);
      form.set("caption", row.message);
      form.set("document", file, generation.output_path.split("/").pop() ?? "generation");
      result = await telegramApi("sendDocument", form);
    } else {
      const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
      result = await telegramApi(row.delivery_method === "sendPhoto" ? "sendPhoto" : "sendMessage", { ...payload, chat_id: row.chat_id, ...(row.delivery_method === "sendPhoto" ? { caption: row.message } : { text: row.message }) });
    }
    const { error: saved } = await supabaseAdmin.from("telegram_deliveries").update({ status: "sent", message_id: result.message_id, delivered_at: new Date().toISOString() }).eq("id", id);
    if (saved) throw new Error("RECEIPT_SAVE_AMBIGUOUS");
    return true;
  } catch {
    await supabaseAdmin.from("telegram_deliveries").update({ status: "review", error_code: "DELIVERY_REQUIRES_REVIEW" }).eq("id", id);
    // Never replay a send after an ambiguous network outcome.
    throw new Error("DELIVERY_REQUIRES_REVIEW");
  }
}

export async function queueTelegram(key: string, chatId: string, text: string, options: { website_user_id?: string; generation_id?: string; update_id?: number; delivery_method?: string; payload?: { [key: string]: string | object } } = {}) {
  const { data: existing } = await supabaseAdmin.from("telegram_deliveries").select("id,status").eq("dedupe_key", key).maybeSingle();
  if (existing) { if (existing.status === "pending") await deliverTelegram(existing.id); return; }
  const { data, error } = await supabaseAdmin.from("telegram_deliveries").insert({ dedupe_key: key, chat_id: chatId, message: text.slice(0, 4000), ...options, payload: options.payload ? JSON.parse(JSON.stringify(options.payload)) : undefined }).select("id").single();
  if (error || !data) throw new Error("DELIVERY_SAVE_FAILED");
  await deliverTelegram(data.id);
}

export async function drainTelegramDeliveries() {
  const { data: config } = await supabaseAdmin.from("telegram_admin_config").select("enabled").eq("id", true).maybeSingle();
  if (!config?.enabled) return { sent: 0, review: 0 };
  const { data, error } = await supabaseAdmin.from("telegram_deliveries").select("id").eq("status", "pending").order("created_at").limit(10);
  if (error) throw new Error("QUEUE_UNAVAILABLE");
  let sent = 0, review = 0;
  for (const row of data ?? []) { try { if (await deliverTelegram(row.id)) sent++; } catch { review++; } }
  return { sent, review };
}