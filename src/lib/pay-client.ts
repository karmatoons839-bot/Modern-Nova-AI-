import { authHeaders } from "./auth";

export type PaymentRow = {
  order_id: string; plan: string; amount_paise: number; currency: string; status: string;
  provider_payment_id: string | null; payment_method: string | null; credits: number;
  created_at: string; verified_at: string | null; subscription_start: string | null; subscription_end: string | null;
};

export async function payApi<T = { payment: PaymentRow }>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.success) throw new Error(j.message || `Payment service returned ${res.status}.`);
  return j as T;
}

export function loadCheckout(): Promise<void> {
  return new Promise((ok, fail) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return ok();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => ok();
    s.onerror = () => fail(new Error("Could not load the secure payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

export const ist = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—");
