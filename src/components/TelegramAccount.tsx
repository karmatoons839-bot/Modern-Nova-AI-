import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { createTelegramAccountLink } from "@/lib/telegram.functions";
import { getTelegramLink, setTelegramPreferences, unlinkTelegram } from "@/lib/telegram-account.functions";

export function TelegramAccount() {
  const load = useServerFn(getTelegramLink), create = useServerFn(createTelegramAccountLink), prefs = useServerFn(setTelegramPreferences), unlink = useServerFn(unlinkTelegram);
  const q = useQuery({ queryKey: ["my-telegram-link"], queryFn: () => load() });
  const [url, setUrl] = useState<string | null>(null), [busy, setBusy] = useState(false);
  async function run(work: () => Promise<unknown>) { setBusy(true); try { await work(); await q.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Telegram action failed."); } finally { setBusy(false); } }
  return <section className="space-y-3 border-t border-border py-5"><h2 className="font-display text-lg font-bold">Telegram</h2>
    {q.error && <p role="alert" className="text-destructive">Could not load Telegram connection.</p>}
    <p className="text-sm text-muted-foreground">{q.data ? "Account linked" : "Account not linked"}</p>
    {q.data ? <>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={busy} checked={q.data.notify_account} onChange={(e) => void run(() => prefs({ data: { notify_account: e.target.checked, notify_announcements: q.data?.notify_announcements ?? false } }))} />Account, generation and payment notifications</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={busy} checked={q.data.notify_announcements} onChange={(e) => void run(() => prefs({ data: { notify_account: q.data?.notify_account ?? false, notify_announcements: e.target.checked } }))} />Announcements</label>
      <Button variant="outline" disabled={busy} onClick={() => { if (confirm("Unlink this Telegram account?")) void run(() => unlink()); }}>Unlink Telegram</Button>
    </> : <Button disabled={busy} onClick={() => void run(async () => setUrl((await create()).url))}>Link account</Button>}
    {url && !q.data && <Button asChild variant="outline"><a href={url} target="_blank" rel="noreferrer">Open Telegram</a></Button>}
    <Button variant="ghost" disabled={busy} onClick={() => void q.refetch()}>Refresh status</Button>
  </section>;
}