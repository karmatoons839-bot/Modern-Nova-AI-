import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getTelegramLink = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("telegram_account_links").select("telegram_user_id,notify_account,notify_announcements").eq("website_user_id", context.userId).maybeSingle();
  if (error) throw new Error("Telegram link unavailable.");
  return data;
});
export const setTelegramPreferences = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ notify_account: z.boolean(), notify_announcements: z.boolean() }).parse(v)).handler(async ({ context, data }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row, error } = await supabaseAdmin.from("telegram_account_links").update(data).eq("website_user_id", context.userId).select("telegram_user_id").maybeSingle();
  if (error || !row) throw new Error("Link your account first.");
  return { saved: true };
});
export const unlinkTelegram = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("telegram_account_links").delete().eq("website_user_id", context.userId);
  if (error) throw new Error("Could not unlink Telegram.");
  await supabaseAdmin.from("telegram_link_requests").update({ used_at: new Date().toISOString() }).eq("website_user_id", context.userId).is("used_at", null);
  return { unlinked: true };
});