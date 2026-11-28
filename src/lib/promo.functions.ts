import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/lib/plans";

/** Server-side promo check: price and bonus credits are computed here, never trusted from the browser. */
export const checkPromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; plan: string }) =>
    z.object({ code: z.string().trim().toUpperCase().min(3).max(30), plan: z.enum(["creator", "pro", "premium"]) }).parse(d))
  .handler(async ({ data, context }) => {
    // Limited lookup as the signed-in user: only validity, discount and plan restriction are revealed.
    const { data: raw, error: lookupError } = await context.supabase.rpc("check_promo_code", { _code: data.code, _plan: data.plan });
    if (lookupError) throw new Error("Could not check the promo code.");
    const p = raw as { code: string; percent: number; allowed_plan: string | null } | null;
    if (!p) return { ok: false as const, error: "Invalid or expired promo code" };
    if (p.allowed_plan && p.allowed_plan !== data.plan) return { ok: false as const, error: "This coupon is only valid for the Standard ₹499 plan." };
    if (p.percent === 100) {
      const { data: used, error } = await context.supabase.from("payments").select("id").eq("user_id", context.userId).eq("promo_code", p.code).eq("status", "success").limit(1);
      if (error) throw new Error("Could not check coupon eligibility.");
      if (used?.length) return { ok: false as const, error: "You have already used this coupon." };
    }
    const plan = PLANS.find((x) => x.id === data.plan);
    if (!plan) throw new Error("Invalid plan.");
    const price = Math.round(plan.priceInr * (100 - p.percent)) / 100;
    const bonus = p.percent === 100 ? 0 : Math.round((plan.credits * p.percent) / 100);
    return { ok: true as const, code: p.code, percent: p.percent, price, credits: plan.credits + bonus, bonus };
  });
