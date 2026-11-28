import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { telegramOfferSchema } from "./telegram-workflows";

export const getTelegramOperations = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!owner) throw new Error("Owner access required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [tickets, offers, deliveries, actions, config] = await Promise.all([
    supabaseAdmin.from("telegram_tickets").select("id,kind,status,created_at,website_user_id").order("created_at", { ascending: false }).limit(25),
    supabaseAdmin.from("telegram_offers").select("id,name,user_id,amount_paise,credits,days,tier,status,order_id,expires_at").order("created_at", { ascending: false }).limit(25),
    supabaseAdmin.from("telegram_deliveries").select("id,status,attempts,message_id,error_code,created_at").order("created_at", { ascending: false }).limit(25),
    supabaseAdmin.from("telegram_actions").select("id,kind,target_user,amount,status,expires_at,reason").order("created_at", { ascending: false }).limit(25),
    supabaseAdmin.from("telegram_admin_config").select("original_qr_file_id,enabled,commissioning_confirmed_at").eq("id", true).maybeSingle(),
  ]);
  if (tickets.error || offers.error || deliveries.error || actions.error || config.error) throw new Error("Operations could not be read.");
  const { knowledgeReviewStatus } = await import("./telegram-knowledge.server");
  return { tickets: tickets.data, offers: offers.data, deliveries: deliveries.data, actions: actions.data, qr_configured: Boolean(config.data?.original_qr_file_id), enabled: config.data?.enabled ?? false, knowledge: knowledgeReviewStatus() };
});

export const setTelegramActivation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ enabled: z.boolean(), acceptance_confirmed: z.boolean() }).parse(v)).handler(async ({ context, data }) => {
  const { data: owner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!owner) throw new Error("Owner access required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("telegram_set_activation", { _owner: context.userId, _enabled: data.enabled, _accepted: data.acceptance_confirmed });
  if (error) throw new Error("Activation refused. Verify owner identity, refresh health, and complete live acceptance before enabling.");
  return { enabled: data.enabled };
});

export const processTelegramQueue = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: owner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!owner) throw new Error("Owner access required.");
  const { drainTelegramDeliveries } = await import("./telegram-delivery.server");
  return drainTelegramDeliveries();
});

/** Explicit per-creation approval, separate from permission to generate paid media. */
export const approveTelegramCreation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ generationId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ context, data }) => {
    const { data: owner, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !owner) throw new Error("Owner approval required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: approvalError } = await supabaseAdmin.rpc("telegram_approve_creation", { _owner: context.userId, _generation: data.generationId });
    if (approvalError) throw new Error("Delivery is not ready for approval.");
    return { approved: true, generationId: data.generationId };
  });