import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, Page } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ist } from "@/lib/pay-client";

export const Route = createFileRoute("/_authenticated/payments")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Payment History — Modern Nova AI" }, { name: "description", content: "Your plan payments." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Payment History — Modern Nova AI" }, { property: "og:description", content: "Plan payments." }] }),
  component: PaymentsPage,
});

function PaymentsPage() {
  const { session } = useAuth();
  const { data = [] } = useQuery({
    queryKey: ["payments", session?.user.id],
    queryFn: async () =>
      (await supabase.from("payments").select("order_id, plan, amount_paise, status, created_at, payment_method, provider_payment_id, subscription_end").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <Page title="Payment History">
      {data.length === 0 && <Card><p className="text-sm text-muted-foreground">No payments yet.</p></Card>}
      {data.map((p) => {
        const sub = p.status !== "success" ? "—" : p.subscription_end && new Date(p.subscription_end) > new Date() ? "Active" : "Expired";
        return (
          <Link key={p.order_id} to="/payment/$orderId" params={{ orderId: p.order_id }} className="block rounded-3xl border border-border bg-card p-4 text-sm hover:border-primary">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-foreground">{p.plan.toUpperCase()} · ₹{(p.amount_paise / 100).toFixed(0)}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${p.status === "success" ? "bg-primary/10 text-primary" : p.status === "pending" ? "bg-accent text-foreground" : "bg-destructive/10 text-destructive"}`}>{p.status.toUpperCase()}</span>
            </div>
            <p className="mt-1 text-muted-foreground">Order {p.order_id} · {ist(p.created_at)}</p>
            <p className="text-muted-foreground">Method: {p.payment_method ?? "—"} · Txn: {p.provider_payment_id ?? "—"} · Subscription: {sub}</p>
          </Link>
        );
      })}
    </Page>
  );
}
