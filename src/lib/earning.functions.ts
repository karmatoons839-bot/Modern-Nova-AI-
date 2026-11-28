import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { DEFAULT_EARNING_REWARDS, activePaidAdExemption } from "./earning-policy";

export const getEarningStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [settings, profile, link] = await Promise.all([
    supabaseAdmin.from("earning_settings").select("*").eq("id", true).maybeSingle(),
    context.supabase.from("profiles").select("plan,subscription_status,plan_renews_at").eq("id", context.userId).single(),
    context.supabase.from("telegram_account_links").select("telegram_user_id").eq("website_user_id", context.userId).maybeSingle(),
  ]);
  if (settings.error || profile.error || link.error) throw new Error("Reward information unavailable");
  // RLS also allows administrator reads; explicitly filter account history even for admins.
  const own = await context.supabase.from("earning_rewards").select("id,source,amount,status,created_at,verification").or(link.data ? `user_id.eq.${context.userId},telegram_user_id.eq.${link.data.telegram_user_id}` : `user_id.eq.${context.userId}`).order("created_at", { ascending: false }).limit(100);
  if (own.error) throw new Error("Reward history unavailable");
  return { adReady: false, adsEnabled: false, adFree: activePaidAdExemption(profile.data.plan, profile.data.subscription_status, profile.data.plan_renews_at), telegramEnabled: settings.data?.telegram_enabled ?? false, adCredits: settings.data?.ad_credits ?? DEFAULT_EARNING_REWARDS.ad, memberCredits: settings.data?.member_credits ?? DEFAULT_EARNING_REWARDS.member, linked: Boolean(link.data), rewards: own.data };
});

export const claimMemberRewards = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: link, error } = await context.supabase.from("telegram_account_links").select("telegram_user_id").eq("website_user_id", context.userId).maybeSingle();
  if (error || !link) throw new Error("Link your signed-in website account to Telegram first.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await supabaseAdmin.rpc("earning_claim", { _sender: link.telegram_user_id });
  if (result.error) throw new Error("Rewards could not be claimed. No success is confirmed.");
  return { credits: result.data };
});

export const getEarningAdmin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ page: z.number().int().min(0).default(0) }).parse(input)).handler(async ({ context, data }) => {
  const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Admin/Owner access required");
  const [settings, history, audit, stats] = await Promise.all([
    context.supabase.from("earning_settings").select("*").eq("id", true).maybeSingle(),
    context.supabase.from("earning_rewards").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(data.page * 50, data.page * 50 + 49),
    context.supabase.from("earning_audit").select("*").order("created_at", { ascending: false }).limit(30),
    context.supabase.rpc("earning_statistics"),
  ]);
  if (settings.error || history.error || audit.error || stats.error) throw new Error("Reward dashboard unavailable");
  const missing = (history.data ?? []).filter(r => r.source === "telegram" && (!r.inviter_name || !r.member_name)).slice(0, 20);
  if (missing.length) {
    const { telegramApi } = await import("./telegram.server");
    const { telegramDisplayName } = await import("./earning-telegram.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lookup = async (chat: string, id: string | null) => { if (!id) return null; try { const m = await telegramApi<{ user: { username?: string; first_name?: string; last_name?: string } }>("getChatMember", { chat_id: chat, user_id: Number(id) }, false); return telegramDisplayName(m.user); } catch { return null; } };
    await Promise.all(missing.map(async r => {
      const chat = String(r.event_key ?? "").split(":")[1]; if (!chat) return;
      const [inviter, member] = await Promise.all([r.inviter_name ?? lookup(chat, r.telegram_user_id), r.member_name ?? lookup(chat, r.member_id)]);
      if (inviter !== r.inviter_name || member !== r.member_name) { r.inviter_name = inviter; r.member_name = member; await supabaseAdmin.from("earning_rewards").update({ inviter_name: inviter, member_name: member }).eq("id", r.id); }
    }));
  }
  const statistics = z.object({ ads_watched: z.number(), distributed: z.number(), pending: z.number(), approved: z.number(), rejected: z.number(), daily: z.array(z.object({ day: z.string(), events: z.number(), distributed: z.number() })), monthly: z.array(z.object({ month: z.string(), events: z.number(), distributed: z.number() })) }).parse(stats.data);
  return { settings: settings.data, history: history.data, count: history.count ?? 0, audit: audit.data, adRevenue: null, statistics };
});

export const saveEarningSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ telegram: z.boolean(), ad: z.number().int().min(1).max(100000), member: z.number().int().min(1).max(100000) }).parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("earning_save_settings", { _telegram: data.telegram, _ad: data.ad, _member: data.member });
  if (result.error) throw new Error(result.error.message);
  return { saved: true };
});
export const reviewEarningReward = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean(), reason: z.string().trim().max(500).optional() }).transform(v => ({ ...v, reason: v.reason && v.reason.length >= 8 ? v.reason : (v.approve ? "Admin approved genuine member" : "Admin rejected after review") })).parse(input)).handler(async ({ context, data }) => {
  const result = await context.supabase.rpc("earning_review", { _id: data.id, _approve: data.approve, _reason: data.reason });
  if (result.error) throw new Error(result.error.message);
  return { saved: true };
});