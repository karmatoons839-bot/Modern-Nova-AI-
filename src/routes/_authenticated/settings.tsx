import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell, ChevronRight, FileText, HelpCircle, History, Languages, LogOut, Moon, Shield, Sun, Trash2, User, Wallet,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { btn, btnOutline, Card, input, Page } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { clearHistory, deleteAccount } from "@/lib/account.functions";
import { signOut, useAuth, useProfile, useRefreshProfile } from "@/lib/auth";
import { LANG_OPTIONS, useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { applyTheme, getTheme, type Theme } from "@/lib/theme";
import { TelegramAccount } from "@/components/TelegramAccount";

export const Route = createFileRoute("/_authenticated/settings")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Settings — Modern Nova AI" },
      { name: "description", content: "Manage your profile, security, notifications, plan, language and appearance." },
      { property: "og:title", content: "Settings — Modern Nova AI" },
      { property: "og:description", content: "Your Modern Nova AI account settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ icon: Icon, title, children, danger }: { icon: typeof User; title: string; children: ReactNode; danger?: boolean }) {
  return (
    <Card className={danger ? "border-destructive/40" : ""}>
      <h2 className={`flex items-center gap-2 font-display text-lg font-bold ${danger ? "text-destructive" : "text-foreground"}`}>
        <Icon className="h-5 w-5" /> {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </Card>
  );
}

function LinkRow({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:bg-accent">
      {label} <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground">
      {label}
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={`relative h-6 w-11 rounded-full transition ${on ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function SettingsPage() {
  const { uiLang, setLang } = useI18n();
  const { session } = useAuth();
  const { data: p } = useProfile();
  const refresh = useRefreshProfile();
  const clear = useServerFn(clearHistory);
  const del = useServerFn(deleteAccount);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);
  const [pw, setPw] = useState("");
  const [theme, setTheme] = useState<Theme>("light");
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState("");

  useEffect(() => setTheme(getTheme()), []);
  useEffect(() => { if (p) setName(p.display_name ?? ""); }, [p]);

  if (!p) return <Page title="Settings"><Card>Loading…</Card></Page>;
  const email = p.email ?? session?.user.email ?? "";

  const update = async (patch: Record<string, unknown>, ok = "Saved.") => {
    const { error } = await supabase.from("profiles").update(patch as never).eq("id", p.id);
    if (error) toast.error("Could not save. Please try again.");
    else toast.success(ok);
    void refresh();
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) return void toast.error("Please choose an image.");
    if (file.size > 2 * 1024 * 1024) return void toast.error("Image must be under 2 MB.");
    setBusy(true);
    const path = `${p.id}/avatar-${Date.now()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setBusy(false); return void toast.error("Upload failed."); }
    const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
    await update({ avatar_url: data?.signedUrl ?? null }, "Profile picture updated.");
    // Remove older pictures so their old links stop working.
    const { data: old } = await supabase.storage.from("avatars").list(p.id);
    const stale = (old ?? []).filter((f) => `${p.id}/${f.name}` !== path).map((f) => `${p.id}/${f.name}`);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
    setBusy(false);
  };

  const changePassword = async () => {
    if (pw.length < 8) return void toast.error("Password must be at least 8 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Password changed."); setPw(""); }
  };

  const forgot = async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) toast.error(error.message);
    else toast.success(`Reset link sent to ${email}.`);
  };

  const plan = PLANS.find((x) => x.id === p.plan);

  return (
    <Page title="Settings">
      <Section icon={User} title="Profile">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-xl font-bold text-foreground">
            {p.avatar_url ? <img src={p.avatar_url} alt="Profile" className="h-full w-full object-cover" /> : (p.display_name ?? email).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-foreground">{p.display_name ?? "—"}</p>
            <p className="truncate text-sm text-muted-foreground">{email}</p>
            <label className="mt-1 inline-block cursor-pointer text-xs font-bold text-primary">
              {busy ? "Uploading…" : "Change picture"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void uploadAvatar(e.target.files[0])} />
            </label>
          </div>
        </div>
        {editing ? (
          <div className="flex flex-wrap gap-2">
            <input className={`${input} flex-1`} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            <button className={btn} onClick={() => { if (name.trim()) void update({ display_name: name.trim() }, "Profile updated."); setEditing(false); }}>Save</button>
            <button className={btnOutline} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <button className={btnOutline} onClick={() => setEditing(true)}>Edit Profile</button>
        )}
      </Section>

      <Section icon={Shield} title="Security">
        <div className="flex flex-wrap gap-2">
          <input type="password" className={`${input} flex-1`} placeholder="New password (min 8 characters)" value={pw} onChange={(e) => setPw(e.target.value)} />
          <button className={btn} disabled={busy || !pw} onClick={() => void changePassword()}>Change Password</button>
        </div>
        <button className={btnOutline} onClick={() => void forgot()}>Forgot Password — email me a reset link</button>
      </Section>

      <Section icon={Bell} title="Notifications">
        <Toggle label="Email Notifications" on={p.notify_email ?? true} onChange={(v) => void update({ notify_email: v })} />
        <Toggle label="Generation Notifications" on={p.notify_generation ?? true} onChange={(v) => void update({ notify_generation: v })} />
        <Toggle label="Payment Notifications" on={p.notify_payment ?? true} onChange={(v) => void update({ notify_payment: v })} />
      </Section>
      <TelegramAccount />

      <Section icon={Wallet} title="Subscription">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-accent p-3"><p className="text-xs text-muted-foreground">Current Plan</p><p className="font-bold text-foreground">{plan?.name ?? p.plan}</p></div>
          <div className="rounded-2xl bg-accent p-3"><p className="text-xs text-muted-foreground">Remaining Credits</p><p className="font-bold text-foreground">{p.credits.toLocaleString()}</p></div>
        </div>
        <LinkRow to="/upgrade" label="Upgrade Plan" />
        <LinkRow to="/payments" label="Payment History" />
      </Section>

      <Section icon={History} title="History">
        <LinkRow to="/history" label="Generation History" />
        <button className={btnOutline} onClick={async () => {
          if (!confirm("Clear all your generation history? This cannot be undone.")) return;
          try { await clear(); toast.success("History cleared."); } catch { toast.error("Could not clear history."); }
        }}><Trash2 className="h-4 w-4" /> Clear History</button>
      </Section>

      <Section icon={Languages} title="Language">
        <div className="grid gap-2 sm:grid-cols-3">
          {LANG_OPTIONS.map((o) => (
            <button key={o.id} onClick={() => { setLang(o.id); void update({ language: o.db }, "Language saved."); }}
              className={`rounded-2xl border px-4 py-3 text-left ${uiLang === o.id ? "border-primary bg-accent" : "border-border"}`}>
              <span className="block text-sm font-bold text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.sub}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Sun} title="Appearance">
        <div className="grid grid-cols-2 gap-2">
          {([["light", "Light Mode", Sun], ["dark", "Dark Mode", Moon]] as const).map(([id, label, I]) => (
            <button key={id} onClick={() => { applyTheme(id); setTheme(id); }}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold text-foreground ${theme === id ? "border-primary bg-accent" : "border-border"}`}>
              <I className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={HelpCircle} title="Help & Support">
        <LinkRow to="/help" label="Help Center" />
        <LinkRow to="/help" label="Contact Support" />
      </Section>

      <Section icon={FileText} title="Legal">
        <LinkRow to="/terms" label="Terms & Conditions" />
        <LinkRow to="/privacy" label="Privacy Policy" />
      </Section>

      <Section icon={Trash2} title="Danger Zone" danger>
        <p className="text-sm text-muted-foreground">Deleting your account permanently removes your profile, credits and history. Type <b>DELETE</b> to confirm.</p>
        <div className="flex flex-wrap gap-2">
          <input className={`${input} flex-1`} value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} placeholder="DELETE" />
          <button disabled={confirmDel !== "DELETE" || busy} className="inline-flex items-center gap-2 rounded-2xl bg-destructive px-4 py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-50"
            onClick={async () => {
              setBusy(true);
              try { await del(); await supabase.auth.signOut(); window.location.assign("/"); }
              catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete account."); setBusy(false); }
            }}>Delete Account</button>
        </div>
      </Section>

      <Section icon={LogOut} title="Logout">
        <button className={btnOutline} onClick={() => void signOut()}><LogOut className="h-4 w-4" /> Logout</button>
      </Section>
    </Page>
  );
}
