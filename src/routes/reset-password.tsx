import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { btn, Card, input, Page } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Set a new password — Modern Nova AI" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Choose a new password for your Modern Nova AI account." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Set a new password — Modern Nova AI" },
      { property: "og:description", content: "Choose a new password for your account." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated.");
    void navigate({ to: "/tools" });
  };

  return (
    <Page title="Set a new password" sub="Open this page from the link in your reset email.">
      <Card>
        <form onSubmit={save} className="space-y-3">
          <input className={input} type="password" minLength={6} required placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button className={btn} disabled={busy}>{busy ? "Saving…" : "Update password"}</button>
        </form>
      </Card>
    </Page>
  );
}
