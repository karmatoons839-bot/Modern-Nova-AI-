import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { input } from "./Page";
import { getTelegramOperations, processTelegramQueue, setTelegramActivation } from "@/lib/telegram-admin.functions";
import { TelegramMemory } from "./TelegramMemory";

export function TelegramOperations() {
  const load = useServerFn(getTelegramOperations), activate = useServerFn(setTelegramActivation), drain = useServerFn(processTelegramQueue);
  const q = useQuery({ queryKey: ["telegram-operations"], queryFn: () => load() });
  const [busy, setBusy] = useState(false), [accepted, setAccepted] = useState(false);
  const [tab, setTab] = useState<"tickets" | "offers" | "deliveries" | "actions">("tickets");
  async function run(work: () => Promise<unknown>) { setBusy(true); try { await work(); await q.refetch(); toast.success("Request completed."); } catch (e) { toast.error(e instanceof Error ? e.message : "Request failed."); } finally { setBusy(false); } }
  return <section className="space-y-5 border-t border-border py-6">
    <h2 className="font-display text-lg font-bold">Telegram operations</h2>
    <TelegramMemory />
    {q.error && <p role="alert" className="text-destructive">Operations unavailable</p>}
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={busy} onClick={() => void q.refetch()}>Refresh</Button><Button variant="outline" disabled={busy || !q.data?.enabled} onClick={() => void run(async () => { const r = await drain(); toast.info(`${r.sent} accepted; ${r.review} require review`); })}>Process pending deliveries</Button></div>
    <p className="text-sm">Original QR: <strong>{q.data?.qr_configured ? "Configured" : "Missing"}</strong></p>
    {!q.data?.qr_configured && <p className="text-sm text-muted-foreground">Send your original QR photo privately to @ModernNova_bot with caption /originalqr from your verified owner account.</p>}
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} /><span>I have completed live identity, reply, confirmation, privacy and recovery acceptance checks and approve administrative processing.</span></label>
    <Button disabled={busy || (!q.data?.enabled && !accepted)} variant={q.data?.enabled ? "destructive" : "default"} onClick={() => void run(() => activate({ data: { enabled: !q.data?.enabled, acceptance_confirmed: accepted } }))}>{q.data?.enabled ? "Disable administrative processing" : "Activate administrative processing"}</Button>
    <div className="flex flex-wrap gap-2 border-t border-border pt-5" role="tablist">{(["tickets", "offers", "deliveries", "actions"] as const).map((v) => <Button key={v} role="tab" aria-selected={tab === v} variant={tab === v ? "default" : "outline"} onClick={() => setTab(v)}>{v}</Button>)}</div>
    <div className="divide-y divide-border overflow-x-auto">{(q.data?.[tab] ?? []).map((row) => <div key={row.id} className="space-y-1 py-3 text-sm"><p className="break-all font-semibold">{row.id}</p><p className="text-muted-foreground">{Object.entries(row).filter(([key]) => key !== "id").map(([key,value]) => `${key}: ${value ?? "—"}`).join(" · ")}</p></div>)}{q.data && q.data[tab].length === 0 && <p className="py-4 text-muted-foreground">No records</p>}</div>
  </section>;
}