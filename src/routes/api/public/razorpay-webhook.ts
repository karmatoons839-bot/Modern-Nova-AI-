import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

// Razorpay webhook: signature-verified; activation is idempotent in activate_payment().
export const Route = createFileRoute("/api/public/razorpay-webhook")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("x-razorpay-signature") ?? "";
        const { safeEq, settleFromGateway } = await import("@/lib/payments.server");
        if (!safeEq(createHmac("sha256", secret).update(body).digest("hex"), sig)) return new Response("Invalid signature", { status: 401 });
        const evt = JSON.parse(body) as { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
        const p = evt.payload?.payment?.entity;
        if (!p?.order_id) return new Response("ignored");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin.from("payments").select("order_id").eq("provider_order_id", p.order_id).maybeSingle();
        if (!row) return new Response("unknown order");
        // Never trust the webhook body for amounts: re-read the payment from Razorpay.
        await settleFromGateway(row.order_id, p.id);
        return new Response("ok");
      },
    },
  },
});
