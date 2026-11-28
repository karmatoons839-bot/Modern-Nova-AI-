import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, ExternalLink, Mail, MailX, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btn, btnOutline, Card, input, Page } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { adminAdjustCredits, adminSetPlan, adminCreatePromo, adminListPromos, adminSetPromoActive, adminListGenerations, adminListPayments, adminReviewUpiPayment, adminListUsers, adminSaveSettings, adminSetStatus, adminStats, adminMusicReport, adminListTeam, adminSaveTeamMember, adminRemoveTeamMember, ADMIN_SECTIONS } from "@/lib/admin.functions";
import { MUSIC_CREDIT_COSTS, MUSIC_DURATIONS } from "@/lib/music";
import { ist, useInvalidateAdmin, type AdminNotification } from "@/lib/admin-client";
import { useProfile } from "@/lib/auth";
import { DevApiAdmin } from "@/components/DevApiAdmin";
import { Button } from "@/components/ui/button";
import { MaintenanceControl } from "@/components/MaintenanceGate";
import { ApiProvidersAdmin } from '@/components/ApiProvidersAdmin';
import { EarningAdmin } from '@/components/EarningRewards';

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Admin Dashboard — Modern Nova AI" },
      { name: "description", content: "Admin notifications, users, audit log and settings." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Admin Dashboard — Modern Nova AI" },
      { property: "og:description", content: "Admin area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const TABS = ["Admins", "Users", "Payments", "Generations", "Music", "Developer API", "APIs", "Promo Codes", "Notifications", "Audit Log", "Settings", "Rewards"] as const;

const TAB_SECTION: Record<(typeof TABS)[number], string> = {
  APIs: "owner",
  Admins: "owner", Users: "users", Payments: "payments", Generations: "generations", Music: "generations",
  "Developer API": "devapi", "Promo Codes": "promos", Notifications: "notifications", "Audit Log": "audit", Settings: "settings", Rewards: "owner",
};

const SECTION_LABELS: { id: (typeof ADMIN_SECTIONS)[number]; label: string; hint: string }[] = [
  { id: "users", label: "Users", hint: "See users; with edit: add/remove credits, suspend" },
  { id: "payments", label: "Payments", hint: "See payments; with edit: approve/reject UPI" },
  { id: "generations", label: "Generations", hint: "See all users' generations" },
  { id: "devapi", label: "Developer API", hint: "See API orders; with edit: approve, change prices" },
  { id: "promos", label: "Promo Codes", hint: "See promos; with edit: create, turn on/off" },
  { id: "notifications", label: "Notifications", hint: "See alerts and bell; with edit: mark read/delete" },
  { id: "audit", label: "Audit Log", hint: "See admin action history" },
  { id: "settings", label: "Settings", hint: "See settings; with edit: change them" },
];

function Team() {
  const list = useServerFn(adminListTeam);
  const save = useServerFn(adminSaveTeamMember);
  const remove = useServerFn(adminRemoveTeamMember);
  const { data, refetch } = useQuery({ queryKey: ["admin-team"], queryFn: () => list() });
  const [email, setEmail] = useState("");
  const [sections, setSections] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const submit = async () => {
    setBusy(true);
    try {
      await save({ data: { email, sections: sections as never, can_edit: canEdit } });
      toast.success("Admin saved");
      setEmail(""); setSections([]); setCanEdit(false);
      void refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-display font-bold text-foreground">Make someone an admin</h3>
        <p className="mb-3 text-sm text-muted-foreground">They must already have an account. Choose what they can see and do. Only you can manage admins.</p>
        <input className={input} type="email" placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <p className="mt-4 text-sm font-bold text-foreground">What they can see</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {SECTION_LABELS.map((x) => (
            <label key={x.id} className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-2.5 text-sm">
              <input type="checkbox" className="mt-1" checked={sections.includes(x.id)} onChange={() => toggle(x.id)} />
              <span><b className="text-foreground">{x.label}</b><span className="block text-xs text-muted-foreground">{x.hint}</span></span>
            </label>
          ))}
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={canEdit} onChange={(e) => setCanEdit(e.target.checked)} /> <b>Can make changes</b> <span className="text-muted-foreground">(off = view only)</span></label>
        <button className={`${btn} mt-4`} disabled={busy || !email} onClick={() => void submit()}><Plus className="h-4 w-4" /> Save admin</button>
      </Card>
      <Card>
        <h3 className="mb-3 font-display font-bold text-foreground">Team admins ({data?.length ?? 0})</h3>
        {!data?.length && <p className="text-sm text-muted-foreground">No team admins yet.</p>}
        {data?.map((m) => (
          <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2 text-sm last:border-0">
            <span>
              <b>{m.email}</b> · {m.can_edit ? "Can edit" : "View only"}
              <span className="block text-xs text-muted-foreground">{m.sections.map((s: string) => SECTION_LABELS.find((x) => x.id === s)?.label ?? s).join(", ") || "No sections"}</span>
            </span>
            <span className="flex gap-2">
              <button className={btnOutline} onClick={() => { setEmail(m.email ?? ""); setSections(m.sections); setCanEdit(m.can_edit); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
              <button className={btnOutline} onClick={() => void remove({ data: { userId: m.user_id } }).then(() => { toast.success("Removed"); void refetch(); })}>Remove</button>
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}

function AdminPage() {
  const { data: p, isLoading } = useProfile();
  const owner = Boolean(p?.is_admin);
  const tabs = TABS.filter((t) => owner || (TAB_SECTION[t] !== "owner" && p?.team?.sections.includes(TAB_SECTION[t])));
  const [picked, setTab] = useState<(typeof TABS)[number] | null>(null);
  const tab = picked && tabs.includes(picked) ? picked : tabs[0];
  if (isLoading) return <Page title="Admin Dashboard"><Card>Loading…</Card></Page>;
  if (!owner && !p?.team)
    return (
      <Page title="Access denied">
        <Card className="text-sm text-muted-foreground">This area is for administrators only. <Link to="/" className="font-bold text-primary">Go home</Link></Card>
      </Page>
    );
  return (
    <Page title="Admin Dashboard" sub="All times shown in IST (Asia/Kolkata).">
      {owner && (
        <div className="flex flex-wrap gap-2">
          <Link to="/site-editor" className={`${btn} inline-flex w-fit items-center gap-2`}>Edit Website</Link>
          <Button asChild variant="outline"><Link to="/telegram">Telegram Admin Setup</Link></Button>
        </div>
      )}
      {owner && <MaintenanceControl />}
      {owner && <Button asChild variant="outline" className="w-fit"><Link to="/script-video-admin">🎬 Script to Video Admin</Link></Button>}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>{t}</button>
        ))}
      </div>
      {!owner && <Card className="text-sm text-muted-foreground">Team admin access · {p?.team?.can_edit ? "can make changes" : "view only"}</Card>}
      <Stats />
      {tab === "Admins" && <Team />}
      {tab === "Payments" && <Payments />}
      {tab === "Generations" && <Generations />}
      {tab === "Music" && <MusicAdmin />}
      {tab === "Developer API" && <DevApiAdmin />}
      {tab === "APIs" && owner && <ApiProvidersAdmin />}
      {tab === "Promo Codes" && <Promos />}
      {tab === "Notifications" && <Notifications />}
      {tab === "Users" && <Users />}
      {tab === "Audit Log" && <Audit />}
      {tab === "Settings" && <Settings />}
      {tab === 'Rewards' && owner && <EarningAdmin />}
    </Page>
  );
}

const TYPES = ["all", "user", "security", "payment", "subscription", "credits", "generation", "api", "system", "support"];
const sel = "rounded-xl border border-input bg-background px-3 py-2 text-sm";

function Notifications() {
  const invalidate = useInvalidateAdmin();
  const [read, setRead] = useState("all");
  const [type, setType] = useState("all");
  const [prio, setPrio] = useState("all");
  const [from, setFrom] = useState("");
  const { data = [], refetch } = useQuery({
    queryKey: ["admin-notifications", read, type, prio, from],
    queryFn: async () => {
      let q = supabase.from("admin_notifications").select("*").order("updated_at", { ascending: false }).limit(200);
      if (read !== "all") q = q.eq("is_read", read === "read");
      if (type !== "all") q = q.eq("type", type);
      if (prio !== "all") q = q.eq("priority", prio);
      if (from) q = q.gte("created_at", new Date(from + "T00:00:00+05:30").toISOString());
      return ((await q).data ?? []) as AdminNotification[];
    },
  });
  const act = async (fn: () => PromiseLike<unknown>) => {
    await fn();
    invalidate();
    void refetch();
  };
  return (
    <>
      <Card className="flex flex-wrap items-center gap-2">
        <select className={sel} value={read} onChange={(e) => setRead(e.target.value)}>
          <option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option>
        </select>
        <select className={sel} value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All types" : t}</option>)}
        </select>
        <select className={sel} value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <button className={btnOutline} onClick={() => void act(() => supabase.from("admin_notifications").update({ is_read: true }).eq("is_read", false))}>Mark all as read</button>
      </Card>
      {data.length === 0 && <Card className="text-sm text-muted-foreground">No notifications.</Card>}
      {data.map((n) => (
        <Card key={n.id} className={n.is_read ? "" : "border-primary/40"}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase">
                <span className={n.priority === "high" ? "text-destructive" : n.priority === "medium" ? "text-primary" : "text-muted-foreground"}>{n.priority}</span>
                <span className="text-muted-foreground"> · {n.type}{n.occurrences > 1 ? ` · ×${n.occurrences}` : ""}</span>
              </p>
              <p className="mt-1 font-bold text-foreground">{n.title}</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">{n.message}</p>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {ist(n.updated_at)}
                {n.user_id && <span>· User {n.user_id.slice(0, 8)}</span>}
                {n.transaction_id && <span>· Ref {n.transaction_id.slice(0, 12)}</span>}
                <span className="inline-flex items-center gap-1">
                  · {n.email_sent ? <><Mail className="h-3 w-3" /> Emailed</> : <><MailX className="h-3 w-3" /> Email not sent</>}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              {!n.is_read && (
                <button aria-label="Mark as read" className="rounded-lg p-2 hover:bg-accent" onClick={() => void act(() => supabase.from("admin_notifications").update({ is_read: true }).eq("id", n.id))}><Check className="h-4 w-4" /></button>
              )}
              <button aria-label="Delete" className="rounded-lg p-2 text-destructive hover:bg-accent" onClick={() => void act(() => supabase.from("admin_notifications").delete().eq("id", n.id))}><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>
        </Card>
      ))}
    </>
  );
}

function Users() {
  const list = useServerFn(adminListUsers);
  const adjust = useServerFn(adminAdjustCredits);
  const setPlan = useServerFn(adminSetPlan);
  const setStatus = useServerFn(adminSetStatus);
  const [q, setQ] = useState("");
  const { data = [], refetch } = useQuery({ queryKey: ["admin-users", q], queryFn: () => list({ data: { q } }) });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };
  return (
    <>
      <input className={input} placeholder="Search by email" value={q} onChange={(e) => setQ(e.target.value)} />
      {data.map((u) => (
        <Card key={u.id}>
          <p className="font-bold text-foreground">{u.display_name} <span className="text-sm font-normal text-muted-foreground">{u.email}</span></p>
          <p className="text-xs text-muted-foreground">{u.plan.toUpperCase()} · {u.credits.toLocaleString()} credits · {u.status} · joined {ist(u.created_at)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CreditBox onSubmit={(a, r) => run(() => adjust({ data: { userId: u.id, amount: a, reason: r } }), a > 0 ? `${a} credits added to ${u.email}` : `${-a} credits removed`)} />
            <select
              aria-label="Plan"
              className={sel}
              value={u.plan}
              onChange={(e) => {
                const plan = e.target.value as "free" | "creator" | "pro" | "premium";
                if (plan === u.plan) return;
                const msg = plan === "free" ? `Remove ${u.plan.toUpperCase()} plan from ${u.email}?` : `Give ${plan.toUpperCase()} plan to ${u.email}? Plan credits will be added.`;
                if (!confirm(msg)) { e.target.value = u.plan; return; }
                void run(() => setPlan({ data: { userId: u.id, plan, addCredits: true } }), plan === "free" ? "Plan removed" : `${plan.toUpperCase()} plan given`);
              }}
            >
              <option value="free">Plan: FREE</option>
              <option value="creator">Plan: CREATOR</option>
              <option value="pro">Plan: PRO</option>
              <option value="premium">Plan: PREMIUM</option>
            </select>
            <button className={btnOutline} onClick={() => {
              const next = u.status === "active" ? "suspended" : "active";
              const r = prompt(next === "suspended" ? "Reason for suspension" : "Note (optional)") ?? "";
              void run(() => setStatus({ data: { userId: u.id, status: next, reason: r } }), next === "suspended" ? "User suspended" : "User activated");
            }}>{u.status === "active" ? "Suspend" : "Activate"}</button>
          </div>
        </Card>
      ))}
    </>
  );
}

function Audit() {
  const { data = [] } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <Card>
      {data.length === 0 && <p className="text-sm text-muted-foreground">No admin actions yet.</p>}
      {data.map((a) => (
        <div key={a.id} className="border-b border-border py-2.5 text-sm last:border-0">
          <p className="font-semibold text-foreground">{a.action.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted-foreground">
            {ist(a.created_at)} · by {a.admin_email}
            {a.target_user && ` · user ${a.target_user.slice(0, 8)}`}
            {a.reason && ` · ${a.reason}`}
            {a.related_id && ` · ref ${a.related_id.slice(0, 8)}`}
          </p>
        </div>
      ))}
    </Card>
  );
}

const TOGGLES = [
  ["email_enabled", "Email notifications"],
  ["security_alerts", "Security alerts"],
  ["user_notifications", "User notifications"],
  ["payment_notifications", "Payment notifications"],
  ["subscription_notifications", "Subscription notifications"],
  ["api_notifications", "AI/API error notifications"],
  ["support_notifications", "Support notifications"],
  ["system_notifications", "System error notifications"],
] as const;
type Key = (typeof TOGGLES)[number][0];

function Settings() {
  const save = useServerFn(adminSaveSettings);
  const { data } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => (await supabase.from("admin_settings").select("*").single()).data,
  });
  const [s, setS] = useState<Record<Key, boolean> | null>(null);
  useEffect(() => {
    if (data) setS(Object.fromEntries(TOGGLES.map(([k]) => [k, data[k]])) as Record<Key, boolean>);
  }, [data]);
  if (!s || !data) return <Card>Loading…</Card>;
  return (
    <Card className="space-y-1">
      <p className="font-bold text-foreground">Notification settings</p>
      <p className="pb-2 text-sm text-muted-foreground">Admin email: <span className="font-semibold text-foreground">{data.admin_email}</span> (locked — changing it needs a verified backend change)</p>
      {TOGGLES.map(([k, label]) => (
        <label key={k} className="flex items-center justify-between border-b border-border py-2.5 text-sm last:border-0">
          <span className="text-foreground">{label}</span>
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.checked })} />
        </label>
      ))}
      <div className="pt-3">
        <button className={btn} onClick={() => void save({ data: s }).then(() => toast.success("Settings saved"), (e: Error) => toast.error(e.message))}>Save settings</button>
      </div>
    </Card>
  );
}

function CreditBox({ onSubmit }: { onSubmit: (amount: number, reason: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button className={`${btn} inline-flex items-center gap-1`} onClick={() => setOpen(true)} aria-label="Add credits">
        <Plus className="h-4 w-4" /> Credits
      </button>
    );
  const go = async (sign: 1 | -1) => {
    const n = Math.floor(Number(amt));
    if (!n || n <= 0) { toast.error("Enter a credit amount"); return; }
    setBusy(true);
    await onSubmit(sign * n, sign > 0 ? "Added by admin" : "Removed by admin");
    setBusy(false);
    setAmt("");
    setOpen(false);
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input autoFocus type="number" min={1} className={`${sel} w-32`} placeholder="e.g. 500" value={amt} onChange={(e) => setAmt(e.target.value)} />
      <button disabled={busy} className={btn} onClick={() => void go(1)}>Add</button>
      <button disabled={busy} className={btnOutline} onClick={() => void go(-1)}>Remove</button>
      <button className="text-xs text-muted-foreground" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}

function Stats() {
  const stats = useServerFn(adminStats);
  const { data } = useQuery({ queryKey: ["admin-stats"], queryFn: () => stats() });
  if (!data) return null;
  const items = [["Users", data.users], ["Generations", data.generations], ["Failed", data.failed], ["Paid payments", data.payments]] as const;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([l, v]) => (
        <Card key={l}><p className="text-xs font-bold uppercase text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold text-foreground">{v.toLocaleString()}</p></Card>
      ))}
    </div>
  );
}

function Generations() {
  const list = useServerFn(adminListGenerations);
  const [tool, setTool] = useState("all");
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({ queryKey: ["admin-gens", tool, q], queryFn: () => list({ data: { tool, q } }) });
  return (
    <>
      <Card className="flex flex-wrap gap-2">
        <select className={sel} value={tool} onChange={(e) => setTool(e.target.value)}>
          <option value="all">All tools</option><option value="voice_full">Voice over (full)</option><option value="story">Story</option><option value="voice">Voice lines</option><option value="image">Image</option><option value="thumbnail">Thumbnail</option><option value="music">AI Music Maker</option>
        </select>
        <input className={`${sel} flex-1`} placeholder="Filter by email" value={q} onChange={(e) => setQ(e.target.value)} />
      </Card>
      {data.length === 0 && <Card className="text-sm text-muted-foreground">No generations yet.</Card>}
      {data.map((g) => (
        <Card key={g.id}>
          <p className="text-xs font-bold uppercase">
            <span className={g.status === "failed" ? "text-destructive" : g.status === "done" ? "text-primary" : "text-muted-foreground"}>{g.status}</span>
            <span className="text-muted-foreground"> · {g.tool}{g.style ? ` · ${g.style}` : ""} · {g.cost} credits</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">{g.email}</p>
          {g.prompt && (
            <details className="mt-1 text-sm text-muted-foreground">
              <summary className="cursor-pointer line-clamp-2 break-words">{g.prompt}</summary>
              <p className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-accent p-3 text-foreground">{g.prompt}</p>
              <button className="mt-2 text-xs font-bold text-primary" onClick={() => { void navigator.clipboard.writeText(g.prompt!); toast.success("Story copied"); }}>Copy full story / prompt</button>
            </details>
          )}
          {g.error && <p className="mt-1 text-xs text-destructive">{g.error}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{ist(g.created_at)}</p>
          {g.output_url && (
            <div className="mt-3">
              {g.tool === "voice" || g.tool === "voice_full" || g.tool === "music" ? <audio controls preload="metadata" src={g.output_url} className="w-full" /> : <img src={g.output_url} alt={`${g.tool} generated by ${g.email}`} className="max-h-72 w-auto rounded-xl border border-border object-contain" />}
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={g.output_url} target="_blank" rel="noreferrer" className={btnOutline}><ExternalLink className="h-4 w-4" /> Open</a>
                <a href={g.output_url} download={`${g.tool}-${g.id}`} className={btnOutline}><Download className="h-4 w-4" /> Download</a>
              </div>
            </div>
          )}
        </Card>
      ))}
    </>
  );
}

const PAY_STATUS = ["all", "pending", "success", "failed", "cancelled", "refunded"] as const;
function Payments() {
  const list = useServerFn(adminListPayments);
  const [status, setStatus] = useState<string>("all");
  const review = useServerFn(adminReviewUpiPayment);
  const { data = [], isLoading, refetch } = useQuery({ queryKey: ["admin-payments", status], queryFn: () => list({ data: { status } }) });
  async function act(order_id: string, approve: boolean) {
    if (!confirm(approve ? "Confirm you received this money in your bank/UPI app?" : "Reject this payment?")) return;
    try { await review({ data: { order_id, approve } }); toast.success(approve ? "Plan activated" : "Payment rejected"); void refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  return (
    <Card>
      <div className="flex flex-wrap gap-2">
        {PAY_STATUS.map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`rounded-xl px-3 py-1.5 text-xs font-bold capitalize ${status === s ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>{s}</button>
        ))}
      </div>
      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
      {!isLoading && data.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No payments.</p>}
      <div className="mt-3 divide-y divide-border">
        {data.map((p) => (
          <div key={p.order_id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-foreground">{p.email} · {p.plan.toUpperCase()} · ₹{(p.amount_paise / 100).toFixed(2)}</span>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold uppercase text-foreground">{p.status}</span>
            </div>
            <p className="text-muted-foreground">Order {p.order_id} · Txn {p.provider_payment_id ?? "—"} · {p.payment_method ?? "—"} · {p.credits.toLocaleString()} credits{p.promo_code ? ` · promo ${p.promo_code}` : ""}</p>
            {p.status === "pending" && p.payment_method === "upi_manual" && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button className={btn} disabled={!p.provider_payment_id} onClick={() => void act(p.order_id, true)}>{p.provider_payment_id ? "Approve (money received)" : "Waiting for UTR"}</button>
                <button className={btnOutline} onClick={() => void act(p.order_id, false)}>Reject</button>
              </div>
            )}
            <p className="text-muted-foreground">Created {ist(p.created_at)}{p.verified_at ? ` · verified ${ist(p.verified_at)}` : ""}{p.subscription_end ? ` · ends ${ist(p.subscription_end)}` : ""}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Promos() {
  const list = useServerFn(adminListPromos);
  const create = useServerFn(adminCreatePromo);
  const setActive = useServerFn(adminSetPromoActive);
  const { data = [], refetch } = useQuery({ queryKey: ["admin-promos"], queryFn: () => list() });
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [busy, setBusy] = useState(false);
  const active = data.filter((p) => p.active).length;
  async function add() {
    setBusy(true);
    try {
      await create({ data: { code: code.trim().toUpperCase(), percent: Number(percent), max_uses: maxUses ? Number(maxUses) : null } });
      toast.success("Promo code created");
      setCode("");
      await refetch();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <>
      <Card>
        <p className="font-display font-bold text-foreground">New promo code</p>
        <p className="text-xs text-muted-foreground">Users get this % off the price and the same % extra credits.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <input className={input} placeholder="CODE e.g. NOVA20" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          <input className={input} type="number" min={1} max={90} placeholder="% off" value={percent} onChange={(e) => setPercent(e.target.value)} />
          <input className={input} type="number" min={1} placeholder="Max uses (optional)" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
          <button disabled={busy || code.length < 3} className={btn} onClick={() => void add()}><Plus className="h-4 w-4" /> Create</button>
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{active} active · {data.length - active} inactive</p>
      {data.map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-lg font-bold text-foreground">{p.code} <span className="text-sm text-primary">{p.percent}% off + {p.percent}% credits</span></p>
            <p className="text-xs text-muted-foreground">Used {p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""} · {ist(p.created_at)}</p>
          </div>
          <button className={p.active ? btnOutline : btn} onClick={async () => { await setActive({ data: { id: p.id, active: !p.active } }); await refetch(); }}>
            {p.active ? "Deactivate" : "Activate"}
          </button>
        </Card>
      ))}
    </>
  );
}

function MusicAdmin() {
  const report = useServerFn(adminMusicReport);
  const { data } = useQuery({ queryKey: ["admin-music"], queryFn: () => report() });
  return (
    <>
      <Card>
        <p className="text-xs font-bold uppercase text-muted-foreground">AI Music Maker pricing (fixed, server-side)</p>
        <div className="mt-2 grid grid-cols-4 gap-2 text-sm">
          {MUSIC_DURATIONS.map((d) => <div key={d} className="rounded-xl bg-accent p-2 text-center"><b>{d} sec</b><br />{MUSIC_CREDIT_COSTS[d]} Credits</div>)}
        </div>
      </Card>
      {data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["Music generations", data.total], ["Credits consumed", data.consumed], ["Failed", data.failed], ["Refunded credits", data.refunded]] as const).map(([l, v]) => (
            <Card key={l}><p className="text-xs font-bold uppercase text-muted-foreground">{l}</p><p className="font-display text-2xl font-bold text-foreground">{v.toLocaleString()}</p></Card>
          ))}
        </div>
      )}
      {data?.rows.length === 0 && <Card className="text-sm text-muted-foreground">No music generations yet.</Card>}
      {data?.rows.map((r) => (
        <Card key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div><p className="font-semibold text-foreground">{r.email}</p><p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p></div>
          <p>{r.duration} sec · <b className={r.status === "refunded" ? "text-destructive" : "text-primary"}>{r.status === "refunded" ? `+${r.credit_cost} Refunded` : r.status === "completed" ? `-${r.credit_cost} Completed` : `-${r.credit_cost} Running`}</b></p>
        </Card>
      ))}
    </>
  );
}
