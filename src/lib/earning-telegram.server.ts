import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { queueTelegram } from "./telegram-delivery.server";
import { isDirectNewMember } from "./earning-policy";

type TgUser = { id: number; is_bot?: boolean | undefined; username?: string | undefined; first_name?: string | undefined; last_name?: string | undefined };
export function telegramDisplayName(u: Omit<TgUser, "id">) { const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim(); return [full, u.username ? `@${u.username}` : ""].filter(Boolean).join(" · ") || null; }
type MemberChange = { chat: { id: number }; from: TgUser; old_chat_member: { status: string }; new_chat_member: { status: string; user: TgUser }; via_join_request?: boolean | undefined; invite_link?: unknown };
export async function observeRewardMember(change: MemberChange, update: number) {
  const member = change.new_chat_member.user, inviter = String(change.from.id);
  const result = await supabaseAdmin.rpc("earning_observe_member", {
    _chat: String(change.chat.id), _member: String(member.id), _inviter: inviter, _update: update, _bot: Boolean(member.is_bot),
    _eligible: !change.via_join_request && !change.invite_link && isDirectNewMember(change.old_chat_member.status, change.new_chat_member.status, inviter, String(member.id), Boolean(member.is_bot)),
  });
  if (result.error) throw new Error("MEMBER_REWARD_STORAGE_UNAVAILABLE");
  await supabaseAdmin.from("earning_rewards").update({ inviter_name: telegramDisplayName(change.from), member_name: telegramDisplayName(member) }).eq("event_key", `telegram:${change.chat.id}:${member.id}`);
  const data = result.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || data["status"] !== "pending") return;
  const amount = typeof data["amount"] === "number" ? data["amount"] : 0;
  // Telegram only allows a DM after the inviter has started the bot; otherwise ask in the group to /start it.
  const { data: link } = await supabaseAdmin.from("telegram_account_links").select("telegram_user_id").eq("telegram_user_id", inviter).maybeSingle();
  await queueTelegram(`member-reward:${update}`, link ? inviter : String(change.chat.id), link
    ? `🎁 आपने group में नया member add किया! ${amount.toLocaleString()} credits का reward मिला है। Approve होते ही नीचे Claim Reward दबाएँ।`
    : "नया member add करने का reward मिला है! जिसने add किया है, @ModernNova_bot पर /start करें और website से Telegram connect करें।",
    link ? { payload: { reply_markup: { inline_keyboard: [[{ text: "🎁 Claim Reward", callback_data: "claim_reward" }]] } } } : {});
}

export async function rewardTelegramCommand(text: string, sender: string, chat: string, privateChat: boolean, update: number) {
  if (!/^\/(start|rewards|claimrewards)(?:@\w+)?$/.test(text)) return false;
  if (!privateChat) {
    if (text.startsWith("/start")) return false;
    await queueTelegram(`rewards:${update}`, chat, "Rewards privately देखें: https://t.me/ModernNova_bot । Group में email न भेजें।");
    return true;
  }
  const [settings, history, link] = await Promise.all([
    supabaseAdmin.from("earning_settings").select("telegram_enabled").eq("id", true).maybeSingle(),
    supabaseAdmin.from("earning_rewards").select("status,amount").eq("telegram_user_id", sender).limit(10000),
    supabaseAdmin.from("telegram_account_links").select("website_user_id").eq("telegram_user_id", sender).maybeSingle(),
  ]);
  if (history.error || settings.error || link.error) throw new Error("REWARDS_UNAVAILABLE");
  if (text.startsWith("/start") && !settings.data?.telegram_enabled && !history.data?.length) return false;
  let reply: string;
  if (text.startsWith("/claimrewards") && link.data) {
    const claim = await supabaseAdmin.rpc("earning_claim", { _sender: sender });
    if (claim.error) throw new Error("REWARD_CLAIM_FAILED");
    reply = claim.data > 0 ? `Congratulations! आपके linked Modern Nova AI account में ${claim.data.toLocaleString()} credits successfully add हुए। https://modernnova.in/credits` : "कोई approved unclaimed reward बाकी नहीं है।";
  } else {
    const rows = history.data ?? [];
    const sum = (status: string) => rows.filter(r => r.status === status).reduce((s, r) => s + r.amount, 0);
    reply = `Welcome to Modern Nova AI Rewards!\nAvailable: ${sum("approved").toLocaleString()} credits\nPending genuine-member review: ${sum("pending").toLocaleString()} credits\nAlready claimed: ${sum("claimed").toLocaleString()} credits${rows.length === 10000 ? "\nHistory limit reached; website dashboard review required." : ""}\n${link.data ? "Approved credits लेने के लिए /claimrewards भेजें।" : "Sign in → Settings → Telegram → Link account करें। सिर्फ email भेजना ownership proof नहीं है। https://modernnova.in/settings"}`;
  }
  await queueTelegram(`rewards:${update}`, sender, reply);
  return true;
}