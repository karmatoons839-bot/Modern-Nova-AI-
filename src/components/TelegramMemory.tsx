import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { input } from "./Page";
import { getTelegramMemory, manageTelegramMemory } from "@/lib/telegram-memory.functions";

export function TelegramMemory() {
  const load = useServerFn(getTelegramMemory), manage = useServerFn(manageTelegramMemory);
  const [search, setSearch] = useState(""), [from, setFrom] = useState(""), [to, setTo] = useState(""), [conversation, setConversation] = useState<string>();
  const [filters, setFilters] = useState({ search: "", from: "", to: "" });
  const [notes, setNotes] = useState(""), [reason, setReason] = useState(""), [confirmed, setConfirmed] = useState(false), [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ["telegram-memory", filters, conversation], queryFn: () => load({ data: { ...filters, conversation } }) });
  async function change(action: "correct" | "delete") {
    if (!conversation || !confirmed) return;
    setBusy(true);
    try { await manage({ data: { conversation, action, content: notes, reason, confirmed: true } }); await q.refetch(); setConfirmed(false); setReason(""); toast.success(action === "delete" ? "Conversation memory deleted." : "Memory correction saved."); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Memory change failed."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-border py-6">
    <div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">Memory management</h2><Button variant="outline" size="icon" aria-label="Refresh memory" onClick={() => void q.refetch()}><RefreshCw /></Button></div>
    <form className="grid gap-3 sm:grid-cols-4" onSubmit={e => { e.preventDefault(); setFilters({ search, from, to }); }}>
      <label className="text-sm">User / chat ID or message<input className={input} value={search} maxLength={200} onChange={e => setSearch(e.target.value)} /></label>
      <label className="text-sm">From (UTC)<input className={input} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-sm">To (UTC)<input className={input} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <Button type="submit" className="self-end"><Search />Search</Button>
    </form>
    {q.error && <p role="alert" className="text-destructive">{q.error.message}</p>}
    {q.isPending && <p className="text-muted-foreground">Loading memory…</p>}
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div className="space-y-2">{q.data?.conversations.map(c => <Button key={c.id} variant={conversation === c.id ? "default" : "outline"} className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => { setConversation(c.id); setNotes(""); setConfirmed(false); }}><span className="break-all">User {c.telegram_user_id}<br />Chat {c.chat_id}<br /><span className="text-xs">{new Date(c.updated_at).toLocaleString()}</span></span></Button>)}{q.data && !q.data.conversations.length && <p className="text-sm text-muted-foreground">No saved conversations</p>}</div>
      <div className="min-w-0 space-y-4">{conversation && <>
        <h3 className="font-display font-semibold">Conversation history</h3>
        <div className="max-h-96 divide-y divide-border overflow-y-auto">{q.data?.messages.map(m => <div key={m.id} className="py-3"><p className="text-xs text-muted-foreground">{m.role} · {new Date(m.created_at).toLocaleString()}</p><p className="whitespace-pre-wrap break-words text-sm">{m.content}</p></div>)}{q.data && !q.data.messages.length && <p className="text-sm text-muted-foreground">No messages match these dates or search</p>}</div>
        <h3 className="font-display font-semibold">Saved summaries</h3>
        {q.data?.summaries.map(s => <p key={s.id} className="whitespace-pre-wrap break-words text-sm">{s.content}</p>)}
        <h3 className="font-display font-semibold">Reviewed memory</h3><p className="whitespace-pre-wrap break-words text-sm">{q.data?.memory?.content || "No correction saved"}</p>
        <label className="block text-sm">Correction<textarea className={`${input} min-h-24`} value={notes} maxLength={6000} onChange={e => setNotes(e.target.value)} /></label>
        <label className="block text-sm">Reason<input className={input} value={reason} maxLength={300} onChange={e => setReason(e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm this change for the selected user and chat. Deletion removes all stored messages, summaries and notes.</label>
        <div className="flex flex-wrap gap-3"><Button disabled={busy || !confirmed || reason.trim().length < 5 || !notes.trim()} onClick={() => void change("correct")}><Save />Save correction</Button><Button variant="destructive" disabled={busy || !confirmed || reason.trim().length < 5} onClick={() => void change("delete")}><Trash2 />Delete memory</Button></div>
      </>}</div>
    </div>
    <h3 className="font-display font-semibold">Recent memory / AI errors</h3>
    {q.data?.errors.map(e => <p key={e.id} className="break-all text-sm text-destructive">{e.id} · {e.last_error_code} · {e.last_error_at}</p>)}
    <h3 className="font-display font-semibold">Webhook updates requiring review</h3>
    {q.data?.updates.map(u => <p key={u.update_id} className="text-sm">{u.update_id} · {u.status} · {u.error_code ?? "Processing"} · {u.received_at}</p>)}
  </section>;
}