import type { PaidPlanId } from "./plans";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PLANS } from "./plans";

// Razorpay (India, UPI) — official Orders API + Checkout + signature/webhook verification.
// Keys live only in server secrets RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET.

export class PayError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function payErr(e: unknown) {
  if (e instanceof PayError) return Response.json({ success: false, error: e.code, message: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : "Payment error";
  return Response.json({ success: false, error: "PAYMENT_ERROR", message: msg }, { status: 500 });
}

function keys() {
  const id = process.env["RAZORPAY_KEY_ID"];
  const secret = process.env["RAZORPAY_KEY_SECRET"];
  if (!id || !secret)
    throw new PayError(503, "PAYMENT_NOT_CONFIGURED", "Online payment is not configured yet. No money was taken and your plan is unchanged.");
  return { id, secret };
}

async function rzp<T>(path: string, init?: RequestInit): Promise<T> {
  const { id, secret } = keys();
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/json" },
  });
  const j = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) throw new PayError(res.status === 401 ? 503 : 502, "GATEWAY_ERROR", j.error?.description || `Payment gateway returned ${res.status}.`);
  return j;
}

export function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function priceFor(plan: PaidPlanId, code: string | undefined, userId: string) {
  const p = PLANS.find((x) => x.id === plan);
  if (!p) throw new PayError(400, "INVALID_PLAN", "Invalid plan.");
  let percent = 0, promo: string | null = null;
  if (code) {
    const { data } = await supabaseAdmin.from("promo_codes").select("code, percent, active, max_uses, uses, expires_at, allowed_plan, created_by").eq("code", code.trim().toUpperCase()).maybeSingle();
    const ok = data && data.active && (!data.expires_at || new Date(data.expires_at) > new Date()) && (data.max_uses == null || data.uses < data.max_uses);
    if (!ok) throw new PayError(400, "PROMO_INVALID", "Invalid or expired promo code.");
    if (data.created_by && data.created_by === userId) throw new PayError(403, "PROMO_SELF_USE", "You can't use a promo code you created.");
    if (data.allowed_plan && data.allowed_plan !== plan) throw new PayError(400, "PROMO_PLAN_NOT_ALLOWED", "This coupon is only valid for the Standard ₹499 plan.");
    percent = data.percent; promo = data.code;
  }
  const amount = Math.round(p.priceInr * 100 * (100 - percent) / 100);
  const bonus = percent === 100 ? 0 : Math.round((p.credits * percent) / 100);
  return { amount, credits: p.credits + bonus, bonus, percent, promo };
}

export function gatewayConfigured() {
  return !!(process.env["RAZORPAY_KEY_ID"] && process.env["RAZORPAY_KEY_SECRET"]);
}

/** Direct UPI to the owner's UPI ID. The link is built on the server; the plan only activates after the admin confirms the money arrived. */
export async function createUpiOrder(userId: string, plan: PaidPlanId, code?: string) {
  const vpa = process.env["UPI_PAYEE_VPA"];
  const name = process.env["UPI_PAYEE_NAME"] ?? "Modern Nova AI";
  if (!vpa) throw new PayError(503, "PAYMENT_NOT_CONFIGURED", "Online payment is not configured yet. No money was taken and your plan is unchanged.");
  const price = await priceFor(plan, code, userId);
  if (price.amount < 100) throw new PayError(400, "AMOUNT_TOO_LOW", "Discounted price must be at least ₹1.");
  const orderId = `MN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const { error } = await supabaseAdmin.from("payments").insert({
    user_id: userId, plan, amount_paise: price.amount, currency: "INR", order_id: orderId, payment_method: "upi_manual",
    status: "pending", credits: price.credits, promo_code: price.promo, discount_percent: price.percent, bonus_credits: price.bonus,
  });
  if (error) throw new PayError(500, "ORDER_SAVE_FAILED", "Could not save the order. No money was taken.");
  const am = (price.amount / 100).toFixed(2);
  const q = new URLSearchParams({ pa: vpa, pn: name, am, cu: "INR", tn: `Modern Nova ${plan} ${orderId}`, tr: orderId });
  return { mode: "upi" as const, order_id: orderId, upi_link: `upi://pay?${q.toString().replace(/\+/g, "%20")}`, amount_paise: price.amount, credits: price.credits, plan };
}

export async function createOrder(userId: string, plan: PaidPlanId, code?: string) {
  const price = await priceFor(plan, code, userId);
  if (price.percent === 100 && price.promo) {
    const orderId = `MN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { error } = await supabaseAdmin.rpc("redeem_free_promo", {
      _user: userId, _plan: plan, _code: price.promo, _credits: price.credits, _order: orderId,
    });
    if (error) throw new PayError(409, "PROMO_REDEMPTION_REFUSED", error.message);
    try {
      const { notifyUserById } = await import("./email-notify.server");
      await notifyUserById(userId, "payment-receipt", { planName: PLANS.find((x) => x.id === plan)?.name ?? plan, credits: price.credits, amountInr: 0, orderId, method: `Coupon ${price.promo}` }, `payment-receipt-${orderId}`, "payment");
    } catch (e) { console.error("Payment receipt email failed", e); }
    return { mode: "free" as const, order_id: orderId, amount_paise: 0, credits: price.credits, plan };
  }
  if (!gatewayConfigured()) return createUpiOrder(userId, plan, code);
  const { id: keyId } = keys();
  if (price.amount < 100) throw new PayError(400, "AMOUNT_TOO_LOW", "Discounted price must be at least ₹1.");
  const orderId = `MN-${Date.now().toString(36).toUpperCase()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const order = await rzp<{ id: string }>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: price.amount, currency: "INR", receipt: orderId, notes: { order_id: orderId, plan, user_id: userId } }),
  });
  const { error } = await supabaseAdmin.from("payments").insert({
    user_id: userId, plan, amount_paise: price.amount, currency: "INR", order_id: orderId, provider_order_id: order.id,
    status: "pending", credits: price.credits, promo_code: price.promo, discount_percent: price.percent, bonus_credits: price.bonus,
  });
  if (error) throw new PayError(500, "ORDER_SAVE_FAILED", "Could not save the order. No money was taken.");
  return { mode: "gateway" as const, order_id: orderId, gateway_order_id: order.id, key_id: keyId, amount_paise: price.amount, credits: price.credits, plan };
}

type RzpPayment = { id: string; order_id: string; amount: number; currency: string; status: string; method: string; error_description?: string };

/** Asks Razorpay directly; only a captured payment with matching order + amount activates. */
export async function settleFromGateway(orderId: string, paymentId?: string) {
  const { data: row } = await supabaseAdmin.from("payments").select("*").eq("order_id", orderId).maybeSingle();
  if (!row) throw new PayError(404, "ORDER_NOT_FOUND", "Order not found.");
  if (row.status !== "pending" || !row.provider_order_id) return row.status;
  let pays: RzpPayment[] = [];
  if (paymentId) pays = [await rzp<RzpPayment>(`/payments/${encodeURIComponent(paymentId)}`)];
  else pays = (await rzp<{ items: RzpPayment[] }>(`/orders/${row.provider_order_id}/payments`)).items ?? [];
  const ok = pays.find((p) => p.status === "captured" && p.order_id === row.provider_order_id && p.amount === row.amount_paise && p.currency === "INR");
  if (ok) {
    const { error } = await supabaseAdmin.rpc("activate_payment", { _order: orderId, _txn: ok.id, _method: ok.method, _amount_paise: ok.amount });
    if (error) throw new PayError(409, "ACTIVATION_REFUSED", error.message);
    try {
      const { notifyUserById } = await import("./email-notify.server");
      await notifyUserById(row.user_id, "payment-receipt", { planName: PLANS.find((x) => x.id === row.plan)?.name ?? row.plan, credits: row.credits, amountInr: row.amount_paise / 100, orderId, method: `Razorpay ${ok.method}` }, `payment-receipt-${orderId}`, "payment");
    } catch (e) { console.error("Payment receipt email failed", e); }
    return "success";
  }
  const failed = pays.length > 0 && pays.every((p) => p.status === "failed");
  if (failed) {
    await supabaseAdmin.rpc("close_payment", { _order: orderId, _status: "failed", _reason: pays[0]?.error_description ?? "failed" });
    return "failed";
  }
  return "pending";
}

export function checkoutSignatureValid(gatewayOrderId: string, paymentId: string, signature: string) {
  const { secret } = keys();
  return safeEq(createHmac("sha256", secret).update(`${gatewayOrderId}|${paymentId}`).digest("hex"), signature);
}
