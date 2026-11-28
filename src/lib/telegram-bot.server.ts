// Owner choice (2026-11-27): the bot only does member-add rewards.
// 1) Website account linking via one-time /start link_<token>.
// 2) When someone adds a genuine member to a group, the inviter gets a DM.
// 3) "Claim Reward" button / /claimrewards adds approved reward credits to the linked website account.
// No promotions, posters, AI chat, moderation or generation forwarding.
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { queueTelegram, drainTelegramDeliveries } from "./telegram-delivery.server";
import { telegramApi } from "./telegram.server";

const user = z.object({ id: z.number().int().positive().refine(Number.isSafeInteger), is_bot: z.boolean().optional(), username: z.string().max(100).optional(), first_name: z.string().max(200).optional(), last_name: z.string().max(200).optional() });
const chat = z.object({ id: z.number().int().refine(Number.isSafeInteger), type: z.string().max(30), title: z.string().max(300).optional(), username: z.string().max(100).optional() });
const message = z.object({ message_id: z.number().int(), from: user.optional(), chat, text: z.string().max(8000).optional() }).passthrough();
export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative().refine(Number.isSafeInteger),
  message: message.optional(),
  callback_query: z.object({ id: z.string().max(200), from: user, data: z.string().max(64).optional(), message: message.optional() }).optional(),
  chat_member: z.object({ chat, from: user, old_chat_member: z.object({ status: z.string().max(30) }), new_chat_member: z.object({ status: z.string().max(30), user }), via_join_request: z.boolean().optional(), invite_link: z.unknown().optional() }).optional(),
}).passthrough();

export function telegramWebhookSecret() {
  const key = process.env["TELEGRAM_API_KEY"];
  if (!key) throw new Error("Telegram connection missing");
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
export function validTelegramWebhookSecret(actual: string) {
  if (!process.env["TELEGRAM_API_KEY"]) return false;
  const expected = Buffer.from(telegramWebhookSecret());
  const value = Buffer.from(actual);
  return expected.length === value.length && timingSafeEqual(expected, value);
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const CLAIM_BUTTON = { inline_keyboard: [[{ text: "🎁 Claim Reward", callback_data: "claim_reward" }]] };
const say = (chatId: string, text: string, update: number, markup?: object) =>
  queueTelegram(`reply:${update}:${randomUUID()}`, chatId, text, { update_id: update, payload: markup ? { reply_markup: markup } : {} });

async function claim(sender: string, update: number) {
  const { data: link } = await supabaseAdmin.from("telegram_account_links").select("website_user_id").eq("telegram_user_id", sender).maybeSingle();
  if (!link) return say(sender, "पहले website से Telegram connect करें: Sign in → Settings → Telegram → Link account.\nhttps://modernnova.in/settings", update);
  const result = await supabaseAdmin.rpc("earning_claim", { _sender: sender });
  if (result.error) throw new Error("REWARD_CLAIM_FAILED");
  return say(sender, result.data > 0 ? `🎉 ${result.data.toLocaleString()} credits आपके Modern Nova AI account में add हो गए।\nhttps://modernnova.in/credits` : "अभी कोई approved reward claim के लिए बाकी नहीं है। Genuine member approve होते ही यहाँ Claim Reward दबाएँ।", update);
}

export async function processTelegramUpdate(raw: unknown) {
  const u = telegramUpdateSchema.parse(raw);
  if (u.chat_member) {
    const { observeRewardMember } = await import("./earning-telegram.server");
    await observeRewardMember(u.chat_member, u.update_id);
    await drainTelegramDeliveries();
    return;
  }
  const sender = u.callback_query?.from ?? u.message?.from;
  const incoming = u.message ?? u.callback_query?.message;
  if (!sender || sender.is_bot || !incoming) return;
  const senderId = String(sender.id);
  const privateChat = incoming.chat.type === "private" && String(incoming.chat.id) === senderId;
  const { data: accepted, error } = await supabaseAdmin.rpc("telegram_accept_update", { _update: u.update_id, _sender: senderId });
  if (error) throw new Error("UPDATE_STORAGE_UNAVAILABLE");
  if (!accepted) return;
  try {
    if (u.callback_query) {
      await telegramApi("answerCallbackQuery", { callback_query_id: u.callback_query.id });
      if (u.callback_query.data === "claim_reward") await claim(senderId, u.update_id);
    } else if (privateChat) {
      const text = u.message?.text?.trim() ?? "";
      const token = text.match(/^\/start(?:@\w+)? link_([a-zA-Z0-9_-]+)$/)?.[1];
      if (token) {
        const { data, error: linkError } = await supabaseAdmin.rpc("telegram_consume_link", { _sender: senderId, _hash: hash(token) });
        await say(senderId, !linkError && data ? "✅ आपका Telegram, Modern Nova AI website account से connect हो गया। अब group में member add करने का reward यहीं मिलेगा।" : "Link invalid या expire हो गया। Website पर Settings → Telegram से नया link बनाएँ।", u.update_id, !linkError && data ? CLAIM_BUTTON : undefined);
      } else if (/^\/claimrewards(?:@\w+)?$/.test(text)) {
        await claim(senderId, u.update_id);
      } else {
        await say(senderId, "Modern Nova AI Rewards\nGroup में genuine member add करें, approve होने पर Claim Reward दबाएँ।\nWebsite connect: https://modernnova.in/settings", u.update_id, CLAIM_BUTTON);
      }
    }
    await supabaseAdmin.from("telegram_updates").update({ status: "done", completed_at: new Date().toISOString() }).eq("update_id", u.update_id);
    await drainTelegramDeliveries();
  } catch (e) {
    await supabaseAdmin.from("telegram_updates").update({ status: "failed", completed_at: new Date().toISOString() }).eq("update_id", u.update_id);
    throw e;
  }
}
