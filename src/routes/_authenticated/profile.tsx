import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { btn, Card, input, Page, Row } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Profile — Modern Nova AI" }, { name: "description", content: "Your Modern Nova AI profile." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Profile — Modern Nova AI" }, { property: "og:description", content: "Your profile." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: p } = useProfile();
  const refresh = useRefreshProfile();
  const [name, setName] = useState("");
  useEffect(() => {
    setName(p?.display_name ?? "");
  }, [p?.display_name]);
  if (!p) return <Page title="Profile"><Card>Loading…</Card></Page>;
  const save = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 60) }).eq("id", p.id);
    if (error) {
      toast.error("Could not save.");
      return;
    }
    toast.success("Profile saved.");
    void refresh();
  };
  return (
    <Page title="Profile">
      <Card>
        <Row label="Email" value={p.email} />
        <Row label="Current plan" value={p.plan.toUpperCase()} />
        <Row label="Remaining credits" value={p.credits.toLocaleString()} />
      </Card>
      <Card className="space-y-3">
        <label className="text-sm font-bold text-foreground">Display name</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} />
        <button className={btn} onClick={() => void save()} disabled={!name.trim()}>Save</button>
      </Card>
    </Page>
  );
}
