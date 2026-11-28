import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CreditError, creditErrorResponse, requireUser } from "@/lib/credits.server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), plan: z.enum(["creator", "pro", "premium"]), promo: z.string().trim().max(30).optional() }),
  z.object({ action: z.literal("verify"), order_id: z.string().max(60), payment_id: z.string().max(60), signature: z.string().max(200) }),
  z.object({ action: z.literal("status"), order_id: z.string().max(60) }),
  z.object({ action: z.literal("cancel"), order_id: z.string().max(60) }),
  z.object({ action: z.literal("submit_utr"), order_id: z.string().max(60), utr: z.string().trim().regex(/^\d{12}$/, "UTR must be 12 digits") }),
]);

export const Route = createFileRoute("/api/payments")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const pay = await import("@/lib/payments.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        try {
          const user = await requireUser(request);
          const parsed = Body.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return Response.json({ success: false, error: "INVALID_INPUT", message: "Invalid payment request." }, { status: 400 });
          const b = parsed.data;
          if (b.action === "create") return Response.json({ success: true, ...(await pay.createOrder(user.id, b.plan, b.promo || undefined)) });

          const { data: row } = await supabaseAdmin.from("payments").select("*").eq("order_id", b.order_id).eq("user_id", user.id).maybeSingle();
          if (!row) return Response.json({ success: false, error: "ORDER_NOT_FOUND", message: "Order not found." }, { status: 404 });

          if (b.action === "submit_utr") {
            if (row.status !== "pending" || row.payment_method !== "upi_manual")
              return Response.json({ success: false, error: "ORDER_CLOSED", message: "This order can no longer be updated." }, { status: 409 });
            const { data: used } = await supabaseAdmin.from("payments").select("order_id").eq("provider_payment_id", b.utr).maybeSingle();
            if (used && used.order_id !== b.order_id)
              return Response.json({ success: false, error: "UTR_USED", message: "This UTR has already been used for another order." }, { status: 409 });
            await supabaseAdmin.from("payments").update({ provider_payment_id: b.utr }).eq("order_id", b.order_id);
            await supabaseAdmin.rpc("admin_notify", {
              _type: "payment", _title: "[Modern Nova AI] UPI Payment Waiting for Verification",
              _message: `${user.email ?? "?"} says they paid ₹${(row.amount_paise / 100).toFixed(2)} for ${row.plan.toUpperCase()}. UTR ${b.utr}, order ${b.order_id}. Check your bank/UPI app, then approve or reject in Admin → Payments.`,
              _priority: "high", _user: user.id, _txn: b.utr, _meta: { order_id: b.order_id, plan: row.plan, amount_paise: row.amount_paise, utr: b.utr },
            });
          } else if (b.action === "verify") {
            if (!row.provider_order_id || !pay.checkoutSignatureValid(row.provider_order_id, b.payment_id, b.signature))
              return Response.json({ success: false, error: "SIGNATURE_INVALID", message: "Payment could not be verified." }, { status: 400 });
            await pay.settleFromGateway(b.order_id, b.payment_id);
          } else if (b.action === "cancel" && row.payment_method === "upi_manual") {
            if (!row.provider_payment_id) await supabaseAdmin.rpc("close_payment", { _order: b.order_id, _status: "cancelled", _reason: "user cancelled" });
          } else if (b.action === "cancel") {
            // Re-check the gateway first so a real payment is never marked cancelled.
            if ((await pay.settleFromGateway(b.order_id)) === "pending")
              await supabaseAdmin.rpc("close_payment", { _order: b.order_id, _status: "cancelled", _reason: "user closed checkout" });
          } else if (row.status === "pending" && row.payment_method !== "upi_manual") {
            await pay.settleFromGateway(b.order_id);
          }
          const { data: fresh } = await supabaseAdmin
            .from("payments")
            .select("order_id, plan, amount_paise, currency, status, provider_payment_id, payment_method, credits, created_at, verified_at, subscription_start, subscription_end")
            .eq("order_id", b.order_id).maybeSingle();
          return Response.json({ success: true, payment: fresh });
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          return pay.payErr(e);
        }
      },
    },
  },
});
