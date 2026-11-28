import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { btn, btnOutline, Card, input, Page } from "@/components/Page";
import { useProfile } from "@/lib/auth";
import { CONTENT_FIELDS, SITE_CONTENT_QK, useSiteContentMap } from "@/lib/site-content";
import { publishSiteContent } from "@/lib/site-content.functions";

export const Route = createFileRoute("/_authenticated/site-editor")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Website Editor — Modern Nova AI" },
      { name: "description", content: "Admin website text and image editor." },
      { name: "robots", content: "noindex" },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Website Editor — Modern Nova AI" },
      { property: "og:description", content: "Admin area." },
    ],
  }),
  component: SiteEditor,
});

async function toDataUrl(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", 0.85);
}

function SiteEditor() {
  const { data: p, isLoading } = useProfile();
  const { data: saved = {}, isLoading: loadingContent } = useSiteContentMap();
  const publish = useServerFn(publishSiteContent);
  const qc = useQueryClient();
  const nav = useNavigate();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const g = new Map<string, typeof CONTENT_FIELDS>();
    for (const f of CONTENT_FIELDS) g.set(f.group, [...(g.get(f.group) ?? []), f]);
    return [...g.entries()];
  }, []);

  const current = (k: string, def: string) => (k in draft ? draft[k] : saved[k] ?? def);
  const set = (k: string, def: string, v: string) =>
    setDraft((d) => {
      const n = { ...d };
      if (v === (saved[k] ?? def)) delete n[k];
      else n[k] = v;
      return n;
    });
  const changed = Object.keys(draft).length;

  if (isLoading || loadingContent) return <Page title="Website Editor"><Card>Loading…</Card></Page>;
  if (!p?.is_admin)
    return <Page title="Access denied"><Card className="text-sm text-muted-foreground">Only the main admin can edit the website. <Link to="/" className="font-bold text-primary">Go home</Link></Card></Page>;

  const doPublish = async () => {
    setBusy(true);
    try {
      await publish({ data: { changes: draft } });
      await qc.invalidateQueries({ queryKey: SITE_CONTENT_QK });
      setDraft({});
      toast.success("Published — everyone now sees the changes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Website Editor" sub="Change text and images. Nothing goes live until you press Publish.">
      <div className="sticky top-16 z-30 -mx-1 flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/95 p-3 backdrop-blur">
        <span className="text-sm text-muted-foreground">{changed ? `${changed} change${changed > 1 ? "s" : ""} not published` : "No changes yet"}</span>
        <div className="flex gap-2">
          <button className={`${btnOutline} inline-flex items-center gap-1`} onClick={() => void nav({ to: "/admin" })}>
            <X className="h-4 w-4" /> Close
          </button>
          <button className={btn} disabled={!changed || busy} onClick={() => void doPublish()}>
            {busy ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {groups.map(([name, fields]) => (
        <Card key={name} className="space-y-4">
          <h2 className="font-display text-lg font-bold text-foreground">{name}</h2>
          {fields.map((f) => {
            const v = current(f.key, f.def);
            const dirty = f.key in draft;
            return (
              <div key={f.key}>
                <label className="mb-1 block text-sm font-semibold text-foreground">
                  {f.label} {dirty && <span className="text-xs font-normal text-primary">· changed</span>}
                </label>
                {f.kind === "text" && <input className={input} value={v} placeholder={f.def || "Default"} onChange={(e) => set(f.key, f.def, e.target.value)} />}
                {f.kind === "long" && <textarea className={`${input} min-h-24`} value={v} onChange={(e) => set(f.key, f.def, e.target.value)} />}
                {f.kind === "image" && (
                  <div className="flex flex-wrap items-center gap-3">
                    {v ? <img src={v} alt={f.label} className="h-20 w-20 rounded-xl border border-border object-contain" /> : <span className="text-xs text-muted-foreground">Using default</span>}
                    <label className={`${btnOutline} inline-flex cursor-pointer items-center gap-1`}>
                      <Upload className="h-4 w-4" /> Choose image
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try { set(f.key, f.def, await toDataUrl(file)); } catch { toast.error("Could not read that image"); }
                      }} />
                    </label>
                    {v && <button className="text-sm text-destructive" onClick={() => set(f.key, f.def, "")}>Use default</button>}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}
    </Page>
  );
}
