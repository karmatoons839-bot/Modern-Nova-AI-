import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { telegramConfigurationSchema, type TelegramHealth } from "./telegram-config";

export const getTelegramConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owner, error: denied } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (denied || !owner) throw new Error("Only the website owner can configure Telegram.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { telegramCredentialConfigured } = await import("./telegram.server");
    const { data, error } = await supabaseAdmin.from("telegram_admin_config").select("*").eq("id", true).maybeSingle();
    if (error) throw new Error("Telegram configuration could not be read.");
    return { config: data ? { owner_telegram_id: data.owner_telegram_id, admin_chat_id: data.admin_chat_id, support_chat_id: data.support_chat_id } : null, token_configured: telegramCredentialConfigured(), health: data?.health as TelegramHealth | null, enabled: data?.enabled ?? false, owner_verified: Boolean(data?.owner_verified_at) };
  });

export const createTelegramOwnerVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owner, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !owner) throw new Error("Only the website owner can verify Telegram identity.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash, randomBytes } = await import("crypto");
    const token = randomBytes(24).toString("base64url");
    const { data, error: writeError } = await supabaseAdmin.from("telegram_admin_config").update({ verification_hash: createHash("sha256").update(token).digest("hex"), verification_expires_at: new Date(Date.now() + 10 * 60_000).toISOString() }).eq("id", true).eq("website_owner_id", context.userId).select("id").maybeSingle();
    if (writeError || !data) throw new Error("Save your owner configuration before requesting verification.");
    // This single-use authorization link is intentional user-facing capability, not a provider credential.
    return { url: `https://t.me/ModernNova_bot?start=verify_${token}` };
  });

export const createTelegramAccountLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createHash, randomBytes } = await import("crypto");
    const token = randomBytes(24).toString("base64url");
    const { error } = await supabaseAdmin.from("telegram_link_requests").insert({ token_hash: createHash("sha256").update(token).digest("hex"), website_user_id: context.userId, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
    if (error) throw new Error("Account link could not be created.");
    return { url: `https://t.me/ModernNova_bot?start=link_${token}` };
  });

export const saveTelegramConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => telegramConfigurationSchema.parse(value))
  .handler(async ({ context, data }) => {
    const { data: owner, error: denied } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (denied || !owner) throw new Error("Only the website owner can configure Telegram.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("save_telegram_config", { _owner: context.userId, _telegram: data.owner_telegram_id, _admin: data.admin_chat_id, _support: data.support_chat_id });
    if (error) throw new Error("Configuration could not be saved. Check the numeric IDs and retry.");
    return { saved: true, enabled: false };
  });

export const validateTelegramConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owner, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !owner) throw new Error("Only the website owner can validate Telegram.");
    const { inspectTelegramHealth } = await import("./telegram.server");
    return inspectTelegramHealth();
  });

export const testTelegramConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: owner, error: denied } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (denied || !owner) throw new Error("Only the website owner can test Telegram.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { inspectTelegramHealth, telegramApi } = await import("./telegram.server");
    const health = await inspectTelegramHealth();
    const { data: config, error } = await supabaseAdmin.from("telegram_admin_config").select("admin_chat_id, support_chat_id").eq("id", true).maybeSingle();
    if (error || !config) throw new Error("Save the owner and group IDs before testing delivery.");
    const results: { group: string; sent: boolean; message: string }[] = [];
    const groups: [string, string][] = [["Private admin group", config.admin_chat_id], ["Support group", config.support_chat_id]];
    for (const [group, chat_id] of groups) {
      if (!health.checks.some((check) => check.name === group && check.status === "passed")) {
        results.push({ group, sent: false, message: "Group permission check failed; no message sent." });
        continue;
      }
      try {
        const sent = await telegramApi<{ message_id: number }>("sendMessage", { chat_id, text: `Modern Nova AI outgoing-delivery check · ${new Date().toISOString()}\nThis only tests sending. To test incoming replies, send /help@ModernNova_bot. Sensitive admin actions require verified owner activation.` });
        results.push({ group, sent: Boolean(sent.message_id), message: `Telegram accepted test message ${sent.message_id}. This does not prove it was read.` });
      } catch (e) { results.push({ group, sent: false, message: e instanceof Error ? e.message : "Delivery failed." }); }
    }
    const { error: auditError } = await supabaseAdmin.from("admin_audit_log").insert({ admin_id: context.userId, action: "telegram_configuration_test", details: { results } });
    if (auditError) throw new Error("Delivery checks ran, but the audit record could not be saved. Do not assume the whole test succeeded.");
    return results;
  });