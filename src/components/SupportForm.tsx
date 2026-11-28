import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { submitSupport } from "@/lib/admin.functions";
import { useAuth, useProfile } from "@/lib/auth";
import { btn, Card, input } from "./Page";

export function SupportForm() {
  const send = useServerFn(submitSupport);
  const { session } = useAuth();
  const { data: p } = useProfile();
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (p) setF((x) => ({ ...x, name: x.name || p.display_name || "", email: x.email || p.email || "" }));
  }, [p]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const token = session ? (await supabase.auth.getSession()).data.session?.access_token : undefined;
      await send({ data: { ...f, token } });
      toast.success("Message sent. We'll get back to you soon.");
      setF((x) => ({ ...x, subject: "", message: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="font-bold text-foreground">Contact support</p>
      <form onSubmit={submit} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Name" required maxLength={80} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input className={input} type="email" placeholder="Email" required maxLength={200} value={f.email} readOnly={!!p?.email} onChange={(e) => { if (!p?.email) setF({ ...f, email: e.target.value }); }} />
        </div>
        <input className={input} placeholder="Subject" required minLength={2} maxLength={150} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <textarea className={`${input} min-h-28`} placeholder="Your message" required minLength={5} maxLength={3000} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
        <button className={btn} disabled={busy}>{busy ? "Sending…" : "Send message"}</button>
      </form>
    </Card>
  );
}
