import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { btn, btnOutline, Card, Page, Row } from "@/components/Page";
import { ist, payApi } from "@/lib/pay-client";
import { useRefreshProfile } from "@/lib/auth";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/payment/$orderId")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Payment Status — Modern Nova AI" },
      { name: "description", content: "Verified status of your Modern Nova AI payment." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Payment Status — Modern Nova AI" },
      { property: "og:description", content: "Payment verification status." },
    ],
  }),
  component: Result,
});

function Result() {
  const { orderId } = Route.useParams();
  const refresh = useRefreshProfile();
  const q = useQuery({
    queryKey: ["payment", orderId],
    queryFn: () => payApi({ action: "status", order_id: orderId }),
    refetchInterval: (s) => (s.state.data?.payment.status === "pending" ? 5000 : false),
  });
  const p = q.data?.payment;
  useEffect(() => { if (p?.status === "success") void refresh(); }, [p?.status, refresh]);

  if (q.error) return <Page title="Payment"><Card><p className="text-sm text-destructive">{(q.error as Error).message}</p></Card></Page>;
  if (!p) return <Page title="Checking payment…"><Card><p className="text-sm text-muted-foreground">Checking your payment…</p></Card></Page>;

  const details = (
    <Card>
      <Row label="Plan" value={p.plan.toUpperCase()} />
      <Row label="Amount" value={`₹${(p.amount_paise / 100).toFixed(2)}`} />
      <Row label="Order ID" value={p.order_id} />
      <Row label="Transaction ID" value={p.provider_payment_id ?? "—"} />
      <Row label="Credits" value={p.credits.toLocaleString()} />
      {p.status === "success" && <><Row label="Subscription start" value={ist(p.subscription_start)} /><Row label="Subscription end" value={ist(p.subscription_end)} /></>}
    </Card>
  );

  if (p.status === "success")
    return (
      <Page title="PAYMENT SUCCESSFUL">
        <Card className="space-y-1 text-sm font-semibold text-foreground">
          <p className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Payment verified</p>
          <p className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Plan activated</p>
          <p className="flex gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Credits added</p>
        </Card>
        {details}
        <Link to="/tools" className={`${btn} w-full`}>GO TO DASHBOARD</Link>
      </Page>
    );
  if (p.status === "pending")
    return (
      <Page title="PAYMENT PENDING">
        <Card className="flex gap-3 text-sm text-foreground"><Clock className="h-5 w-5 shrink-0 text-primary" />Your payment is being verified. Your plan will be activated after successful verification (usually within a few hours).</Card>
        {details}
        <button className={`${btn} w-full`} onClick={() => void q.refetch()} disabled={q.isFetching}>CHECK PAYMENT STATUS</button>
      </Page>
    );
  return (
    <Page title={p.status === "cancelled" ? "PAYMENT CANCELLED" : p.status === "refunded" ? "PAYMENT REFUNDED" : "PAYMENT FAILED"}>
      <Card className="flex gap-3 text-sm text-foreground"><XCircle className="h-5 w-5 shrink-0 text-destructive" />The payment could not be verified, so your plan was not changed and no credits were added.</Card>
      {details}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link to="/checkout/$plan" params={{ plan: p.plan }} className={`${btn} flex-1`}>TRY AGAIN</Link>
        <Link to="/pricing" className={`${btnOutline} flex-1`}>BACK TO PRICING</Link>
      </div>
    </Page>
  );
}
