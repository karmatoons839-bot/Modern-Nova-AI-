import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TelegramCheck, TelegramHealth } from "./telegram-config";

type TelegramEnvelope<T> = { ok: boolean; result?: T; error_code?: number; description?: string; parameters?: { retry_after?: number } };
type TelegramBot = { id: number; username?: string; can_read_all_group_messages?: boolean };
type TelegramChat = { id: number; type: string; permissions?: { can_send_messages?: boolean } };
type TelegramMember = { status: string; can_send_messages?: boolean; is_member?: boolean };

export function telegramCredentialConfigured() {
  return Boolean(process.env["TELEGRAM_API_KEY"] && process.env["LOVABLE_API_KEY"]);
}

export async function telegramApi<T>(method: "getMe" | "getChat" | "getChatMember" | "getChatMemberCount" | "getChatAdministrators" | "getFile" | "getWebhookInfo" | "sendMessage" | "sendDocument" | "sendAudio" | "sendVideo" | "sendPhoto" | "answerCallbackQuery" | "setWebhook" | "createChatInviteLink" | "banChatMember" | "unbanChatMember" | "restrictChatMember" | "deleteMessage", body: object | FormData = {}, retryRateLimit = true): Promise<T> {
  const apiKey = process.env["TELEGRAM_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey || !lovableKey) throw new Error("Telegram connection is missing. Connect the bot securely in Lovable Connectors.");
  let response: Response;
  try {
    response = await fetch(`https://connector-gateway.lovable.dev/telegram/${method}`, {
      method: "POST", signal: AbortSignal.timeout(12_000),
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey, ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }) },
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error("Telegram did not respond. Check connectivity and try again.");
  }
  const envelope = await response.json().catch(() => null) as TelegramEnvelope<T> | null;
  if (!response.ok || !envelope?.ok || envelope.result === undefined) {
    // Provider text can reflect submitted values. Keep credentials, stack traces and raw errors out of logs/UI.
    const code = envelope?.error_code ?? response.status;
    console.error("Telegram provider rejected request", { method, status: response.status, code });
    // A rate-limit rejection did not send a message. Network/ambiguous failures are never blindly replayed.
    const delay = envelope?.parameters?.retry_after;
    if (code === 429 && retryRateLimit && delay && delay > 0 && delay <= 5) {
      await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      return telegramApi<T>(method, body, false);
    }
    if (code === 401) throw new Error("Telegram authorization failed (401). Update the bot connection securely.");
    if (code === 403) throw new Error("Telegram denied access (403). Check bot membership and permissions.");
    if (code === 400) throw new Error("Telegram rejected the check (400). Check the numeric chat ID and bot membership.");
    if (code === 429) throw new Error("Telegram rate limit reached (429). Wait before retrying.");
    throw new Error(`Telegram check failed (${code}). Check the connection and retry.`);
  }
  return envelope.result;
}

export async function inspectTelegramHealth(): Promise<TelegramHealth> {
  const checks: TelegramCheck[] = [];
  const checked_at = new Date().toISOString();
  const { data: config, error } = await supabaseAdmin.from("telegram_admin_config").select("*").eq("id", true).maybeSingle();
  checks.push({ name: "Website backend and database", status: error ? "failed" : "passed", message: error ? "Configuration storage could not be read. Retry or check Lovable Cloud availability." : "Authenticated server successfully read the configuration table." });
  checks.push({ name: "Bot credential", status: telegramCredentialConfigured() ? "passed" : "failed", message: telegramCredentialConfigured() ? "Secure Telegram connection configured. Token values are never displayed." : "Connect the bot in Lovable Connectors." });
  const razorpay = Boolean(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]);
  checks.push({ name: "Payment integration", status: "pending", message: razorpay ? "Razorpay credentials configured; provider connectivity has not been checked by this health test." : process.env["UPI_PAYEE_VPA"] ? "Manual UPI configured. Owner must verify funds in their bank; no automated provider verification or refund API is connected." : "Payment configuration missing." });
  checks.push({ name: "Owner Telegram identity", status: config?.owner_verified_at ? "passed" : "pending", message: config?.owner_verified_at ? "Owner identity verified through a one-time private Telegram interaction." : config ? "Numeric ID saved; identity proof through a private bot interaction is still required." : "Save your numeric Telegram user ID first." });
  let bot: TelegramBot | null = null;
  try {
    bot = await telegramApi<TelegramBot>("getMe");
    checks.push({ name: "Telegram API", status: "passed", message: "Telegram verified the connected bot identity." });
    checks.push({ name: "Group privacy mode", status: "passed", message: bot.can_read_all_group_messages ? "Privacy mode is disabled: relevant Help-group questions can be received." : "Privacy mode is enabled. In groups use /help@ModernNova_bot, mention the bot, or reply to its message. Ordinary group questions may not reach it unless it is a group administrator." });
  } catch (e) {
    checks.push({ name: "Telegram API", status: "failed", message: e instanceof Error ? e.message : "Telegram check failed." });
  }
  await Promise.all((["admin", "support"] as const).map(async (kind) => {
    const name = kind === "admin" ? "Private admin group" : "Support group";
    if (!config || !bot) {
      checks.push({ name, status: "pending", message: "Save group IDs and establish the bot connection first." });
      return;
    }
    const chatId = kind === "admin" ? config.admin_chat_id : config.support_chat_id;
    try {
      const [chat, member] = await Promise.all([
        telegramApi<TelegramChat>("getChat", { chat_id: chatId }),
        telegramApi<TelegramMember>("getChatMember", { chat_id: chatId, user_id: bot.id }),
      ]);
      const inGroup = ["group", "supergroup"].includes(chat.type) && !["left", "kicked"].includes(member.status);
      const sendable = member.status === "administrator" || member.status === "creator" || (member.status === "restricted" ? member.is_member === true && member.can_send_messages === true : chat.permissions?.can_send_messages !== false);
      checks.push({ name, status: inGroup && sendable ? "passed" : "failed", message: inGroup && sendable ? "Bot is a group member with permission to send. Use Test Configuration to check actual delivery." : "Add the bot to this group and allow it to send messages." });
    } catch (e) {
      checks.push({ name, status: "failed", message: e instanceof Error ? e.message : "Group check failed." });
    }
  }));
  try {
    const webhook = await telegramApi<{ url: string; pending_update_count: number; last_error_date?: number }>("getWebhookInfo");
    const expected = "https://modernnova.in/api/public/telegram/webhook";
    checks.push({ name: "Webhook and deployment", status: webhook.url === expected ? "passed" : "pending", message: webhook.url === expected ? "Telegram is registered to the website's secure endpoint. Check processed updates below to verify actual incoming delivery." : webhook.url ? "A different webhook is registered. Review it before changing incoming delivery." : "No webhook registered. Incoming Telegram messages cannot reach this website." });
    checks.push({ name: "Telegram pending updates", status: webhook.pending_update_count ? "pending" : "passed", message: `${webhook.pending_update_count} updates pending at Telegram.${webhook.last_error_date ? " Telegram reports a recent webhook delivery error; inspect webhook setup." : ""}` });
  } catch (e) {
    checks.push({ name: "Webhook and deployment", status: "failed", message: e instanceof Error ? e.message : "Webhook check failed." });
  }
  const { data: updates, error: updatesError } = await supabaseAdmin.from("telegram_updates").select("status,received_at,completed_at").order("received_at", { ascending: false }).limit(20);
  checks.push({ name: "Incoming processing", status: updatesError ? "failed" : updates?.some((item) => item.status === "done") ? "passed" : "pending", message: updatesError ? "Update history unavailable." : `Latest 20 updates: ${updates?.filter((item) => item.status === "done").length ?? 0} completed; ${updates?.filter((item) => item.status === "failed").length ?? 0} failed. Completion records processing, not proof that a recipient read the reply.` });
  checks.push({ name: "Notifications and process status", status: "pending", message: config?.enabled ? "Admin command processing enabled. Automatic notifications and delivery retries remain unavailable." : "Public DM/help replies are available through the webhook. Sensitive admin operations remain disabled pending owner verification and acceptance testing." });
  const health = { checked_at, checks, bot_username: bot?.username ?? null };
  if (config) {
    const { error: writeError } = await supabaseAdmin.from("telegram_admin_config").update({ last_health_check: checked_at, health }).eq("id", true);
    if (writeError) throw new Error("Health checks ran, but their results could not be saved. Retry.");
  }
  return health;
}