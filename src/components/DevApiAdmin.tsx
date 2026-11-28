import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Card, btn, btnOutline, input } from "@/components/Page";
import { adminApiOverview, adminDecideApiOrder, adminUpdateApiPackage } from "@/lib/devapi.functions";

export function DevApiAdmin() {
  const qc = useQueryClient();
  const load = useServerFn(adminApiOverview);
  const decide = useServerFn(adminDecideApiOrder);
  const save = useServerFn(adminUpdateApiPackage);
  const { data } = useQuery({ queryKey: ["admin-devapi"], queryFn: () => load() });
  const [prices, setPrices] = useState<Record<string, string>>({});
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-devapi"] });
  const act = async (fn: () => Promise<unknown>) => {
    try { await fn(); toast.success("Saved"); refresh(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };
  if (!data) return <Card>Loading…</Card>;
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 font-display font-bold text-foreground">API credit orders</h3>
        {data.orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
        {data.orders.map((o) => (
          <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
            <span>{o.email} · {o.credits.toLocaleString()} credits · ₹{o.amount_inr} · UTR {o.utr ?? "—"} · <b className="capitalize">{o.status}</b></span>
            {o.status === "submitted" && (
              <span className="flex gap-2">
                <button className={btn} onClick={() => act(() => decide({ data: { id: o.id, approve: true } }))}>Approve</button>
                <button className={btnOutline} onClick={() => act(() => decide({ data: { id: o.id, approve: false } }))}>Reject</button>
              </span>
            )}
          </div>
        ))}
      </Card>
      <Card>
        <h3 className="mb-3 font-display font-bold text-foreground">API credit packages (prices)</h3>
        {data.packages.filter((p) => !p.is_custom).map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-border py-2 text-sm last:border-0">
            <span className="flex-1">{p.name}</span>
            <input className={`${input} w-28`} inputMode="numeric" value={prices[p.id] ?? String(p.price_inr ?? "")} onChange={(e) => setPrices({ ...prices, [p.id]: e.target.value.replace(/\D/g, "") })} />
            <button className={btnOutline} onClick={() => act(() => save({ data: { id: p.id, price_inr: Number(prices[p.id] ?? p.price_inr), active: p.active } }))}>Save ₹</button>
            <button className={btnOutline} onClick={() => act(() => save({ data: { id: p.id, price_inr: Number(p.price_inr), active: !p.active } }))}>{p.active ? "Hide" : "Show"}</button>
          </div>
        ))}
      </Card>
      <Card>
        <h3 className="mb-3 font-display font-bold text-foreground">Developer APIs ({data.apis.length})</h3>
        {data.apis.map((a) => (
          <div key={a.id} className="border-b border-border py-2 text-sm last:border-0">{a.email} · <b>{a.name}</b> ({a.brand}) · {a.services.join(", ")} · {a.status}</div>
        ))}
      </Card>
    </div>
  );
}
