import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { btn, Card, Page, Row } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { ReferralCard } from '@/components/ReferralCard';
import { MemberRewards } from '@/components/EarningRewards';

export const Route = createFileRoute("/_authenticated/credits")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "My Credits — Modern Nova AI" }, { name: "description", content: "Your credit balance and usage." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "My Credits — Modern Nova AI" }, { property: "og:description", content: "Credit balance and usage." }] }),
  component: CreditsPage,
});

function CreditsPage() {
  const { data: p } = useProfile();
  const { data: ledger = [] } = useQuery({
    queryKey: ["ledger", p?.id],
    enabled: Boolean(p),
    queryFn: async () =>
      (await supabase.from("credit_ledger").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const used = ledger.filter((l) => l.amount < 0).reduce((s, l) => s - l.amount, 0);
  return (
    <Page title="My Credits">
      <ReferralCard />
      <Card>
        <Row label="Balance" value={<span className="text-xl">{p?.credits.toLocaleString() ?? "—"}</span>} />
        <Row label="Plan" value={p?.plan.toUpperCase()} />
        <Row label="Used (recent)" value={used.toLocaleString()} />
        <div className="pt-3"><Link to="/upgrade" className={btn}>Upgrade plan</Link></div>
      </Card>
      <MemberRewards />
      <Card>
        <p className="mb-2 font-bold text-foreground">Recent activity</p>
        {ledger.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        {ledger.map((l) => (
          <Row
            key={l.id}
            label={`${l.reason} · ${new Date(l.created_at).toLocaleString()}`}
            value={<span className={l.amount < 0 ? "text-destructive" : "text-primary"}>{l.amount > 0 ? "+" : ""}{l.amount}</span>}
          />
        ))}
      </Card>
    </Page>
  );
}
