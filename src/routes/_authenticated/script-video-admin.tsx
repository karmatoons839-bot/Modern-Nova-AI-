import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { btn, btnOutline, Card, input, Page, Row } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";
import { s2vAdminDelete, s2vAdminStats } from "@/lib/s2v-admin.functions";

export const Route = createFileRoute("/_authenticated/script-video-admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Script to Video Admin — Modern Nova AI" },
      { name: "description", content: "Manage Script to Video settings, characters and jobs." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Script to Video Admin — Modern Nova AI" },
      { property: "og:description", content: "Admin area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminS2V,
});

const CATS = ["male", "female", "child", "old"] as const;

function AdminS2V() {
  const { data: profile } = useProfile();
  if (profile && !profile.is_admin) return <Page title="Script to Video Admin"><Card>Access denied.</Card></Page>;
  return (
    <Page title="Script to Video Admin" sub="Settings, characters, jobs and costs.">
      <Link to="/admin" className="text-sm font-semibold text-primary">← Admin Dashboard</Link>
      <Settings />
      <Engine />
      <Stats />
      <Characters />
    </Page>
  );
}

function Settings() {
  const q = useQuery({ queryKey: ["s2v-settings"], queryFn: async () => (await supabase.from("s2v_settings").select("*").eq("id", 1).single()).data });
  const [form, setForm] = useState<Record<string, unknown> | null>(null);
  const s = (form ?? q.data) as NonNullable<typeof q.data> | undefined;
  if (!s) return <Card>Loading…</Card>;
  const set = (k: string, v: unknown) => setForm({ ...s, [k]: v });
  async function save() {
    if (!s) return;
    const { error } = await supabase.from("s2v_settings").update({ enabled: s.enabled, price_scene_image: Number(s.price_scene_image), studio_image_price: Number(s.studio_image_price), studio_character_price: Number(s.studio_character_price), studio_voice_per_minute: Number(s.studio_voice_per_minute), price_anim_5: Number(s.price_anim_5), price_anim_10: Number(s.price_anim_10), price_render: Number(s.price_render), max_script_chars: Number(s.max_script_chars), max_scenes: Number(s.max_scenes), allow_vertical: s.allow_vertical, allow_landscape: s.allow_landscape, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) toast.error(error.message);
    else { toast.success("Saved"); setForm(null); void q.refetch(); }
  }
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">Settings</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.enabled} onChange={(e) => set("enabled", e.target.checked)} />Feature enabled</label>
        <span />
        <label className="text-sm">Studio image price (credits)<input type="number" min={0} className={input} value={s.studio_image_price} onChange={(e) => set("studio_image_price", e.target.value)} /></label>
        <label className="text-sm">Studio character reference (credits)<input type="number" min={0} className={input} value={s.studio_character_price} onChange={(e) => set("studio_character_price", e.target.value)} /></label>
        <label className="text-sm">Studio voiceover per minute (credits)<input type="number" min={0} className={input} value={s.studio_voice_per_minute} onChange={(e) => set("studio_voice_per_minute", e.target.value)} /></label>
        <label className="text-sm">Legacy scene image price (credits)<input type="number" min={0} className={input} value={s.price_scene_image} onChange={(e) => set("price_scene_image", e.target.value)} /></label>
        <label className="text-sm">5-second animation (credits)<input type="number" min={0} className={input} value={s.price_anim_5} onChange={(e) => set("price_anim_5", e.target.value)} /></label>
        <label className="text-sm">10-second animation (credits)<input type="number" min={0} className={input} value={s.price_anim_10} onChange={(e) => set("price_anim_10", e.target.value)} /></label>
        <label className="text-sm">Final rendering (credits per video)<input type="number" min={0} className={input} value={s.price_render} onChange={(e) => set("price_render", e.target.value)} /></label>
        <label className="text-sm">Max script characters<input type="number" min={100} max={200000} className={input} value={s.max_script_chars} onChange={(e) => set("max_script_chars", e.target.value)} /></label>
        <label className="text-sm">Max scenes per video (1–240)<input type="number" min={1} max={240} className={input} value={s.max_scenes} onChange={(e) => set("max_scenes", e.target.value)} /></label>
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.allow_vertical} onChange={(e) => set("allow_vertical", e.target.checked)} />Allow 9:16 vertical</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={s.allow_landscape} onChange={(e) => set("allow_landscape", e.target.checked)} />Allow 16:9 landscape</label>
        </div>
      </div>
      <button type="button" onClick={save} disabled={!form} className={`${btn} mt-4`}>Save settings</button>
    </Card>
  );
}

function Engine() {
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">AI engines</h2>
      <Row label="Script understanding" value="GPT-6 Astra (reads script + background)" />
      <Row label="Character + background frames" value="GPT Image 2.5" />
      <Row label="Scene animation" value="Gemini Omni 1.1 Flash · 720p · 3–10s" />
      <Row label="New studio final rendering" value="Not deployed — no render charges" />
      <Row label="Legacy joining" value="On the user's device" />
      <p className="mt-2 text-xs text-muted-foreground">These run through the built-in AI service — no extra API key needed. Usage is billed to your workspace AI balance.</p>
    </Card>
  );
}

function Stats() {
  const fn = useServerFn(s2vAdminStats);
  const del = useServerFn(s2vAdminDelete);
  const q = useQuery({ queryKey: ["s2v-admin-stats"], queryFn: () => fn() });
  if (!q.data) return <Card>{q.error ? "Could not load stats." : "Loading stats…"}</Card>;
  const d = q.data;
  return (
    <Card>
      <h2 className="font-display text-lg font-bold">Jobs & usage</h2>
      <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
        <Row label="Total videos" value={d.total} />
        <Row label="Completed" value={d.completed} />
        <Row label="Failed / cancelled" value={d.failed} />
        <Row label="Running" value={d.running} />
        <Row label="AI seconds generated" value={d.secondsGenerated} />
        <Row label="Credits charged" value={d.creditsCharged.toLocaleString()} />
      </div>
      <ul className="mt-4 divide-y divide-border text-xs">
        {d.recent.map((r) => (
          <li key={r.id} className="flex items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{r.title || "Untitled"} · {r.email}</p>
              <p className="text-muted-foreground">{new Date(r.created_at).toLocaleString()} · {r.status} · {r.scene_count} scenes · {r.total_seconds}s · {r.credits_charged.toLocaleString()} cr</p>
            </div>
            {r.status !== "generating" && <button type="button" className="rounded-xl border border-border px-2 py-1" onClick={async () => { if (!confirm("Delete this job's files?")) return; try { await del({ data: { id: r.id } }); void q.refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }}>Delete files</button>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

type Char = { id: string; name: string; category: string; description: string; image_path: string; enabled: boolean; sort_order: number; url?: string | null | undefined };

function Characters() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["s2v-admin-chars"],
    queryFn: async () => {
      const { data } = await supabase.from("s2v_characters").select("*").order("sort_order");
      const rows = (data ?? []) as Char[];
      const signed = rows.length ? (await supabase.storage.from("s2v-characters").createSignedUrls(rows.map((r) => r.image_path), 3600)).data ?? [] : [];
      return rows.map((r, i) => ({ ...r, url: signed[i]?.signedUrl }));
    },
  });
  const refresh = () => { void q.refetch(); void qc.invalidateQueries({ queryKey: ["s2v-characters"] }); };

  async function upload(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error("Use JPG/PNG/WEBP under 10 MB");
    const path = `custom/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const { error } = await supabase.storage.from("s2v-characters").upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return path;
  }
  async function update(id: string, patch: { name?: string; category?: string; description?: string; enabled?: boolean; image_path?: string }) {
    const { error } = await supabase.from("s2v_characters").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast.error(error.message); else refresh();
  }
  async function add(file: File) {
    try {
      const path = await upload(file);
      const { error } = await supabase.from("s2v_characters").insert({ name: "New Character", category: "male", description: "", image_path: path, sort_order: (q.data?.length ?? 0) + 1 });
      if (error) throw new Error(error.message);
      toast.success("Character added — set its name, category and description");
      refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Characters</h2>
        <label className={`${btnOutline} cursor-pointer`}>+ Add character<input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void add(f); e.target.value = ""; }} /></label>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">The description is sent to the AI with the image to keep the character identical in every scene — describe face, hair, clothes.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {q.data?.map((c) => <CharEditor key={c.id} c={c} onSave={(p) => update(c.id, p)} onReplace={async (f) => { try { await update(c.id, { image_path: await upload(f) }); } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } }} />)}
      </div>
    </Card>
  );
}

function CharEditor({ c, onSave, onReplace }: { c: Char; onSave: (p: { name?: string; category?: string; description?: string; enabled?: boolean }) => void; onReplace: (f: File) => void }) {
  const [name, setName] = useState(c.name);
  const [category, setCategory] = useState(c.category);
  const [description, setDescription] = useState(c.description);
  return (
    <div className={`flex gap-3 rounded-2xl border border-border p-2 ${c.enabled ? "" : "opacity-60"}`}>
      {c.url ? <img src={c.url} alt={c.name} loading="lazy" className="h-28 w-20 shrink-0 rounded-xl object-cover" /> : <div className="h-28 w-20 rounded-xl bg-muted" />}
      <div className="min-w-0 flex-1 space-y-1.5 text-xs">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-1" />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-input bg-background px-2 py-1">{CATS.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-2 py-1" />
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className="rounded-lg bg-primary px-2 py-1 font-semibold text-primary-foreground" onClick={() => onSave({ name, category, description })}>Save</button>
          <button type="button" className="rounded-lg border border-border px-2 py-1" onClick={() => onSave({ enabled: !c.enabled })}>{c.enabled ? "Disable" : "Enable"}</button>
          <label className="cursor-pointer rounded-lg border border-border px-2 py-1">Replace image<input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onReplace(f); e.target.value = ""; }} /></label>
        </div>
      </div>
    </div>
  );
}
