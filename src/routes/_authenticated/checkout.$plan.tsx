import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { btn, btnOutline, Card, input, Page, Row } from "@/components/Page";
import { checkPromo } from "@/lib/promo.functions";
import { PLANS } from "@/lib/plans";
import { loadCheckout, payApi } from "@/lib/pay-client";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/checkout/$plan")({
  staticData: { sitemap: false },
  beforeLoad: ({ params }) => {
    if (!["creator", "pro", "premium"].includes(params.plan)) throw notFound();
  },
  head: ({ params }) => ({
    meta: [
      { title: `Checkout ${params.plan.charAt(0).toUpperCase() + params.plan.slice(1)} — Modern Nova AI` },
      { name: "description", content: "Secure UPI checkout for your Modern Nova AI plan." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Secure Checkout — Modern Nova AI" },
      { property: "og:description", content: "Pay securely by UPI. Your plan activates only after verification." },
    ],
  }),
  component: Checkout,
});

type Rzp = new (o: Record<string, unknown>) => { open: () => void };

function Checkout() {
  const { plan: planId } = Route.useParams() as { plan: "creator" | "pro" | "premium" };
  const plan = PLANS.find((p) => p.id === planId)!;
  const { data: profile } = useProfile();
  const navigate = useNavigate();
  const check = useServerFn(checkPromo);
  const [code, setCode] = useState("");
  const [promo, setPromo] = useState<{ code: string; price: number; credits: number; percent: number } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [upi, setUpi] = useState<{ link: string; amount: number } | null>(null);
  const [utr, setUtr] = useState("");

  async function submitUtr() {
    setBusy(true); setError(null);
    try {
      await payApi({ action: "submit_utr", order_id: orderId, utr });
      navigate({ to: "/payment/$orderId", params: { orderId: orderId! } });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not submit."); } finally { setBusy(false); }
  }

  async function apply() {
    setPromoErr(null);
    const r = await check({ data: { code, plan: planId } });
    if (r.ok) setPromo(r); else { setPromo(null); setPromoErr(r.error); }
  }

  async function pay() {
    setBusy(true); setError(null);
    try {
      const o = await payApi<{ mode: "upi" | "gateway" | "free"; upi_link?: string; order_id: string; gateway_order_id: string; key_id: string; amount_paise: number }>({ action: "create", plan: planId, promo: promo?.code });
      setOrderId(o.order_id);
      if (o.mode === "free") {
        navigate({ to: "/payment/$orderId", params: { orderId: o.order_id } });
        return;
      }
      if (o.mode === "upi") {
        setUpi({ link: o.upi_link!, amount: o.amount_paise });
        // Auto-open UPI app: currently enabled only for the admin account (role verified from the database).
        if (profile?.is_admin) window.location.href = o.upi_link!;
        return;
      }
      await loadCheckout();
      const R = (window as unknown as { Razorpay: Rzp }).Razorpay;
      new R({
        key: o.key_id, order_id: o.gateway_order_id, amount: o.amount_paise, currency: "INR",
        name: "Modern Nova AI", description: `${plan.name} plan · 1 month`,
        prefill: { email: profile?.email ?? undefined },
        config: { display: { preferences: { show_default_blocks: true }, blocks: { upi: { name: "Pay by UPI", instruments: [{ method: "upi" }] } }, sequence: ["block.upi"] } },
        theme: { color: "#2563eb" },
        handler: async (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try { await payApi({ action: "verify", order_id: o.order_id, payment_id: r.razorpay_payment_id, signature: r.razorpay_signature }); } catch { /* result page re-checks */ }
          navigate({ to: "/payment/$orderId", params: { orderId: o.order_id } });
        },
        modal: {
          ondismiss: async () => {
            try { await payApi({ action: "cancel", order_id: o.order_id }); } catch { /* ignore */ }
            navigate({ to: "/payment/$orderId", params: { orderId: o.order_id } });
          },
        },
      }).open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start.");
    } finally { setBusy(false); }
  }

  const price = promo ? promo.price : plan.priceInr;
  const credits = promo ? promo.credits : plan.credits;
  return (
    <Page title={`${plan.name.toUpperCase()} PLAN`} sub="Secure payment. Your plan activates only after our server verifies the payment.">
      <Card>
        <Row label="Selected plan" value={plan.name} />
        <Row label="Price" value={<>{promo && <s className="mr-2 text-muted-foreground">₹{plan.priceInr}</s>}₹{price} / month</>} />
        <Row label="Billing period" value="1 month (30 days)" />
        <Row label="Credits included" value={credits.toLocaleString()} />
        <Row label="Payment method" value="UPI (GPay, PhonePe, Paytm, BHIM…)" />
        <Row label="Order ID" value={orderId ?? "Created when you continue"} />
        <Row label="Payment status" value={orderId ? "Pending" : "Not started"} />
      </Card>
      <Card>
        <p className="font-display font-bold text-foreground">Promo code</p>
        <div className="mt-2 flex gap-2">
          <input className={`${input} flex-1`} placeholder="Enter promo code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <button className={btnOutline} disabled={code.trim().length < 3} onClick={() => void apply()}>Apply</button>
        </div>
        {promoErr && <p className="mt-2 text-sm text-destructive">{promoErr}</p>}
        {promo && <p className="mt-2 text-sm text-primary">{promo.percent === 100 ? "100% off · No payment required · Once per account" : `${promo.percent}% off and ${promo.percent}% bonus credits applied.`}</p>}
      </Card>
      <Card className="text-sm text-muted-foreground">
        <p className="flex items-center gap-2 font-bold text-foreground"><ShieldCheck className="h-4 w-4 text-primary" />How it works</p>
        <p className="mt-2">Tap Continue — a secure payment window opens. On your phone, pick your UPI app and approve the payment there. Opening the app or closing the window is not a payment; we activate your plan only after the payment is confirmed by the gateway.</p>
      </Card>
      {upi && (
        <Card className="space-y-3 border-primary">
          <p className="font-display font-bold text-foreground">Step 1 — Pay ₹{(upi.amount / 100).toFixed(2)} by UPI</p>
          <a href={upi.link} className={`${btn} w-full`}>OPEN UPI APP</a>
          <p className="text-xs text-muted-foreground">Works on your phone (GPay, PhonePe, Paytm, BHIM). Keep order ID {orderId} for reference.</p>
          <p className="font-display font-bold text-foreground">Step 2 — Enter the 12-digit UTR / reference number</p>
          <input className={`${input} w-full`} inputMode="numeric" maxLength={12} placeholder="e.g. 412345678901" value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} />
          <button className={`${btn} w-full`} disabled={busy || utr.length !== 12} onClick={() => void submitUtr()}>I HAVE PAID — SUBMIT FOR VERIFICATION</button>
          <p className="text-xs text-muted-foreground">Your plan activates after we confirm the payment was received. Submitting a UTR is not proof by itself.</p>
        </Card>
      )}
      {error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!upi && <button className={`${btn} flex-1`} disabled={busy} onClick={() => void pay()}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{price === 0 ? "REDEEM FREE PLAN" : `CONTINUE TO PAYMENT · ₹${price}`}
        </button>}
        <button className={`${btnOutline} flex-1`} onClick={async () => { if (orderId && !utr) { try { await payApi({ action: "cancel", order_id: orderId }); } catch { /* ignore */ } } navigate({ to: "/pricing" }); }}>Cancel payment</button>
      </div>
    </Page>
  );
}
