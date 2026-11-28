import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Gift, Play, Check, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useAuth } from "@/lib/auth";
import { getEarningStatus, claimMemberRewards, getEarningAdmin, saveEarningSettings, reviewEarningReward } from "@/lib/earning.functions";
import { DEFAULT_EARNING_REWARDS } from "@/lib/earning-policy";

export function ToolEarningBox() {
  const { session } = useAuth();
  const load = useServerFn(getEarningStatus);
  const q = useQuery({ queryKey: ["earning-status", session?.user.id], queryFn: () => load(), enabled: Boolean(session), staleTime: 60000 });
  if (!session || !q.data || q.data.adFree) return null;
  return <section aria-label="Watch ads and earn credits" className="mb-6 flex flex-wrap items-center justify-between gap-4 border-y border-border bg-accent/30 px-4 py-5">
    <div className="flex min-w-0 items-center gap-3"><Gift className="size-6 shrink-0 text-primary" /><div><h2 className="font-display font-bold">WATCH ADS & EARN CREDITS</h2><p className="text-sm text-muted-foreground">{q.data.adCredits.toLocaleString()} credits / completed verified ad · Ads not available yet</p></div></div>
    <Button disabled><Play /> Watch ad</Button>
  </section>;
}

export function MemberRewards() {
  const { session } = useAuth();
  const load = useServerFn(getEarningStatus), claim = useServerFn(claimMemberRewards);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["earning-status", session?.user.id], queryFn: () => load() });
  const amount = q.data?.rewards.filter(r => r.status === "approved").reduce((s, r) => s + r.amount, 0) ?? 0;
  return <section className="space-y-4 border-t border-border pt-6"><h2 className="font-display text-xl font-bold">Telegram Member Rewards</h2>
    {q.error && <p role="alert">Reward information unavailable.</p>}
    <p className="text-sm text-muted-foreground">{q.data?.telegramEnabled ? `${q.data.memberCredits.toLocaleString()} credits per approved genuine new member` : "Member rewards are currently switched off."}</p>
    <p className="font-bold">Available to claim: {amount.toLocaleString()} credits</p>
    {q.data && !q.data.linked && <Button asChild variant="outline"><Link to="/settings">Link Telegram account</Link></Button>}
    <Button disabled={!q.data?.linked || amount === 0 || busy} onClick={async () => { setBusy(true); try { const r = await claim(); toast.success(`${r.credits.toLocaleString()} credits added`); await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ["profile"] })]); } catch(e) { toast.error(e instanceof Error ? e.message : "Claim failed"); } finally { setBusy(false); } }}><Gift /> Claim approved credits</Button>
    <div className="divide-y divide-border">{q.data?.rewards.map(r => <div key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{new Date(r.created_at).toLocaleDateString()} · {r.source}</span><span>{r.amount.toLocaleString()} credits · {r.status}</span></div>)}</div>
  </section>;
}

export function EarningAdmin() {
  const load = useServerFn(getEarningAdmin), save = useServerFn(saveEarningSettings), review = useServerFn(reviewEarningReward);
  const [page, setPage] = useState(0), [reason, setReason] = useState(""), [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["earning-admin", page], queryFn: () => load({ data: { page } }) });
  const [draft, setDraft] = useState<{ telegram: boolean; ad: number; member: number } | null>(null);
  const settings = draft ?? { telegram: q.data?.settings?.telegram_enabled ?? false, ad: q.data?.settings?.ad_credits ?? DEFAULT_EARNING_REWARDS.ad, member: q.data?.settings?.member_credits ?? DEFAULT_EARNING_REWARDS.member };
  const run = async (work: () => Promise<unknown>) => { setBusy(true); try { await work(); toast.success("Saved"); await q.refetch(); } catch(e) { toast.error(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); } };
  return <section className="space-y-6"><h2 className="font-display text-xl font-bold">Ad & Member Rewards</h2>
    {q.error && <p role="alert">Admin/Owner reward access unavailable.</p>}
    {q.data && <div className="flex flex-wrap gap-x-6 gap-y-2 border-y border-border py-3 text-sm"><span>Ads watched: <b>{q.data.statistics.ads_watched}</b></span><span>Credits distributed: <b>{q.data.statistics.distributed.toLocaleString()}</b></span><span>Pending: {q.data.statistics.pending}</span><span>Approved: {q.data.statistics.approved}</span><span>Rejected: {q.data.statistics.rejected}</span></div>}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3"><h3 className="font-bold">Reward settings</h3><label className="flex items-center gap-2"><input type="checkbox" checked={settings.telegram} onChange={e => setDraft({ ...settings, telegram: e.target.checked })} /> Telegram member rewards</label>
      <label className="block text-sm">Credits per completed ad<Input type="number" min={1} max={100000} value={settings.ad} onChange={e => setDraft({ ...settings, ad: Number(e.target.value) })} /></label>
      <label className="block text-sm">Credits per genuine member<Input type="number" min={1} max={100000} value={settings.member} onChange={e => setDraft({ ...settings, member: Number(e.target.value) })} /></label>
      <Button disabled={busy || !q.data} onClick={() => void run(() => save({ data: settings }))}>Save settings</Button></div>
      <div className="space-y-3"><h3 className="font-bold">Ad provider · Not connected</h3><p className="text-sm text-muted-foreground">Ads are OFF. Google Ad Manager approval, real rewarded/video and banner ad units, and authenticated web completion verification are required.</p><Button asChild variant="outline"><a href="https://admanager.google.com/" target="_blank" rel="noreferrer">Open Google Ad Manager</a></Button><p className="text-sm">Ad revenue: unavailable · No live ads</p><p className="text-sm">New-member events stay pending until genuine membership is reviewed. Telegram cannot prove whether an unseen member joined before tracking began.</p></div>
    </div>
    <div><h3 className="mb-3 font-bold">Reward history · {q.data?.count ?? 0} records</h3><label className="text-sm">Reason (optional)<Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Optional reason" /></label>
      <div className="mt-3 divide-y divide-border">{q.data?.history.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p>{r.source} · {r.amount.toLocaleString()} credits · {r.status}</p><p className="break-all text-muted-foreground">Added by: <b className="text-foreground">{r.inviter_name ?? "Unknown"}</b> ({r.telegram_user_id ?? "—"}) · Member: <b className="text-foreground">{r.member_name ?? "Unknown"}</b> ({r.member_id ?? "—"})</p><p className="break-words text-muted-foreground">{r.verification}</p></div>{r.status === "pending" && r.source === "telegram" && <div className="flex gap-2"><Button aria-label="Approve reward" title="Approve reward" size="icon" disabled={busy} onClick={() => void run(() => review({ data: { id: r.id, approve: true, reason } }))}><Check /></Button><Button aria-label="Reject reward" title="Reject reward" variant="outline" size="icon" disabled={busy} onClick={() => void run(() => review({ data: { id: r.id, approve: false, reason } }))}><X /></Button></div>}</div>)}</div>
      {!q.data?.history.length && <p className="py-4 text-sm text-muted-foreground">No reward events recorded.</p>}
      <div className="flex items-center gap-3"><Button aria-label="Previous rewards" size="icon" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft /></Button><span>{page + 1}</span><Button aria-label="Next rewards" size="icon" variant="outline" disabled={(page + 1) * 50 >= (q.data?.count ?? 0)} onClick={() => setPage(p => p + 1)}><ChevronRight /></Button></div>
    </div><div className="grid gap-4 sm:grid-cols-2"><div><h3 className="font-bold">Daily statistics · IST</h3>{q.data?.statistics.daily.map(d => <p key={d.day} className="py-1 text-sm">{d.day} · {d.events} events · {d.distributed.toLocaleString()} credits</p>)}{!q.data?.statistics.daily.length && <p className="text-sm text-muted-foreground">No daily reward activity.</p>}</div><div><h3 className="font-bold">Monthly statistics · IST</h3>{q.data?.statistics.monthly.map(m => <p key={m.month} className="py-1 text-sm">{m.month} · {m.events} events · {m.distributed.toLocaleString()} credits</p>)}{!q.data?.statistics.monthly.length && <p className="text-sm text-muted-foreground">No monthly reward activity.</p>}</div></div><div><h3 className="font-bold">Audit history</h3>{q.data?.audit.map(a => <p key={a.id} className="border-b border-border py-2 text-sm">{new Date(a.created_at).toLocaleString()} · {a.action}</p>)}</div>
  </section>;
}