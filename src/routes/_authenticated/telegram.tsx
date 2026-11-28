import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bot, CheckCircle2, Clock3, ExternalLink, RefreshCw, Save, Send, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Page, input } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/lib/auth";
import { createTelegramOwnerVerification, getTelegramConfiguration, saveTelegramConfiguration, testTelegramConfiguration, validateTelegramConfiguration } from "@/lib/telegram.functions";
import { telegramConfigurationSchema, type TelegramConfiguration, type TelegramHealth } from "@/lib/telegram-config";
import { TelegramOperations } from "@/components/TelegramOperations";

export const Route = createFileRoute("/_authenticated/telegram")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Telegram Admin Setup — Modern Nova AI" },
    { name: "description", content: "Owner-only Telegram configuration and verified connection health for Modern Nova AI." },
    { name: "robots", content: "noindex" },
    { property: "og:title", content: "Telegram Admin Setup — Modern Nova AI" },
    { property: "og:description", content: "Secure owner configuration and Telegram connection health." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: TelegramSetup,
});

const EMPTY: TelegramConfiguration = { owner_telegram_id: "", admin_chat_id: "", support_chat_id: "" };

function TelegramSetup() {
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const load = useServerFn(getTelegramConfiguration);
  const save = useServerFn(saveTelegramConfiguration);
  const validate = useServerFn(validateTelegramConfiguration);
  const test = useServerFn(testTelegramConfiguration);
  const verifyOwner = useServerFn(createTelegramOwnerVerification);
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["telegram-configuration"], queryFn: () => load(), enabled: Boolean(profile?.is_admin) });
  const [draft, setDraft] = useState<TelegramConfiguration | null>(null);
  const [health, setHealth] = useState<TelegramHealth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{ group: string; sent: boolean; message: string }[]>([]);
  const [confirmedTest, setConfirmedTest] = useState(false);
  if (loadingProfile) return <Page title="Telegram Admin Setup"><p className="text-muted-foreground">Checking access…</p></Page>;
  if (!profile?.is_admin) return <Page title="Access denied"><p>Only the website owner can configure the Telegram bot.</p><Button asChild variant="outline"><Link to="/tools">Back to tools</Link></Button></Page>;
  const values = draft ?? data?.config ?? EMPTY;
  const currentHealth = health ?? (data?.health?.checks ? data.health : null);
  const valid = telegramConfigurationSchema.safeParse(values);
  const changed = JSON.stringify(values) !== JSON.stringify(data?.config ?? EMPTY);
  const action = async (name: string, work: () => Promise<void>) => {
    setBusy(name);
    try { await work(); } catch (e) { toast.error(e instanceof Error ? e.message : "The action failed. Try again."); } finally { setBusy(null); }
  };
  return <Page title="Telegram Admin Setup">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
      <div className="flex items-center gap-3"><span className="rounded-lg bg-accent p-3 text-primary"><Bot className="size-6" /></span><div><p className="font-display font-semibold">Modern Nova AI · Telegram</p><p className="text-sm text-muted-foreground">Public replies configured · admin {data?.enabled ? "enabled" : "disabled"}</p></div></div>
      <Button asChild variant="outline"><Link to="/admin">Back to Admin</Link></Button>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
    {isLoading ? <p className="text-muted-foreground">Loading configuration…</p> : <>
      <section className="space-y-4 py-2">
        <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" /><h2 className="font-display text-lg font-bold">1. Secure bot connection</h2></div>
        <div className="flex flex-wrap justify-between gap-3"><p className="text-sm">Bot credential: <strong>{data?.token_configured ? "Configured" : "Not configured"}</strong></p><span className="text-sm text-muted-foreground">Token never displayed</span></div>
        <p className="text-sm text-muted-foreground">Create or update the Telegram connection in Lovable → Connectors using the token from BotFather. Never paste it into chat, this page, or a Telegram group.</p>
        <Button asChild variant="outline"><a href="https://t.me/BotFather" target="_blank" rel="noreferrer"><ExternalLink /> Open BotFather</a></Button>
      </section>
      <section className="space-y-4 border-t border-border py-6">
        <h2 className="font-display text-lg font-bold">2. Owner and private groups</h2>
        <p className="text-sm text-muted-foreground">Add @ModernNova_bot to two separate groups. Allow it to send messages; keep the administrative group private.</p>
        {([
          ["owner_telegram_id", "Owner Telegram User ID", "Positive numeric user ID"],
          ["admin_chat_id", "Private Admin Group Chat ID", "Negative numeric group ID"],
          ["support_chat_id", "Support Group Chat ID", "Negative numeric group ID"],
        ] as const).map(([key, label, placeholder]) => <div key={key}><label htmlFor={key} className="mb-2 block text-sm font-semibold">{label}</label><input id={key} inputMode={key === "owner_telegram_id" ? "numeric" : "text"} autoComplete="off" maxLength={17} className={`${input} rounded-lg`} value={values[key]} placeholder={placeholder} onChange={(e) => { setDraft({ ...values, [key]: e.target.value }); setConfirmedTest(false); }} /></div>)}
        {!valid.success && Object.values(values).some(Boolean) && <p role="alert" className="text-sm text-destructive">{valid.error.issues[0]?.message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={Boolean(busy) || !valid.success || !changed} onClick={() => void action("save", async () => { await save({ data: values }); setHealth(null); setTestResults([]); setDraft(null); await refetch(); toast.success("Configuration saved. The bot remains disabled."); })}><Save />{busy === "save" ? "Saving…" : "Save"}</Button>
          <Button variant="outline" disabled={Boolean(busy) || changed} onClick={() => void action("validate", async () => { setHealth(await validate()); await refetch(); })}><RefreshCw />{busy === "validate" ? "Checking…" : "Validate Connection"}</Button>
        </div>
        {changed && <p className="text-xs text-muted-foreground">Save changes before validating or testing.</p>}
        <div className="space-y-2 pt-2"><p className="text-sm">Owner identity: <strong>{data?.owner_verified ? "Verified" : "Not verified"}</strong></p>
          <Button variant="outline" disabled={Boolean(busy) || changed || !data?.config} onClick={() => void action("verify", async () => { setVerificationUrl((await verifyOwner()).url); })}><ShieldCheck /> Create private verification link</Button>
          {verificationUrl && <p><a className="text-sm font-semibold text-primary underline" href={verificationUrl} target="_blank" rel="noreferrer">Open Telegram and press Start to verify your owner identity</a></p>}
          <p className="text-xs text-muted-foreground">The link expires in ten minutes. Verification can complete only after the secure webhook is deployed and registered.</p>
        </div>
      </section>
      <section className="space-y-4 border-t border-border py-6">
        <h2 className="font-display text-lg font-bold">3. Test delivery</h2>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmedTest} onChange={(e) => setConfirmedTest(e.target.checked)} /><span>Send one clearly labeled test message to each configured group. No private account information will be included.</span></label>
        <Button variant="outline" disabled={Boolean(busy) || changed || !data?.config || !confirmedTest} onClick={() => void action("test", async () => { setTestResults(await test()); setConfirmedTest(false); await refetch(); })}><Send />{busy === "test" ? "Testing…" : "Test Configuration"}</Button>
        {testResults.map((r) => <p key={r.group} className="text-sm"><strong>{r.group}: {r.sent ? "Accepted by Telegram" : "Failed"}</strong><span className="block text-muted-foreground">{r.message}</span></p>)}
      </section>
      <section className="border-t border-border py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-lg font-bold">Connection health</h2><span className="text-xs text-muted-foreground">{currentHealth ? `Last check: ${new Date(currentHealth.checked_at).toLocaleString()}` : "Not checked"}</span></div>
        {currentHealth ? <div className="divide-y divide-border">{currentHealth.checks.map((check) => <div key={check.name} className="flex items-start gap-3 py-3">
          {check.status === "passed" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" /> : check.status === "failed" ? <XCircle className="mt-0.5 size-5 shrink-0 text-destructive" /> : <Clock3 className="mt-0.5 size-5 shrink-0 text-muted-foreground" />}
          <div className="min-w-0"><p className="text-sm font-semibold">{check.name} <span className="font-normal text-muted-foreground">· {check.status === "pending" ? "Needs attention" : check.status}</span></p><p className="mt-1 text-sm text-muted-foreground">{check.message}</p></div>
        </div>)}</div> : <p className="text-sm text-muted-foreground">Select Validate Connection to run real checks. No checks have been marked successful yet.</p>}
      </section>
      <TelegramOperations />
    </>}
  </Page>;
}