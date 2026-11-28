import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { btnOutline, Card, Page } from "@/components/Page";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/history")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Generation History — Modern Nova AI" }, { name: "description", content: "Your past voice, image and thumbnail generations." }, { property: "og:title", content: "Generation History — Modern Nova AI" }, { property: "og:description", content: "Past generations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: HistoryPage,
});

const TOOLS = ["all", "voice", "story", "image", "thumbnail", "video", "music"] as const;

function HistoryPage() {
  const { session } = useAuth();
  const [tool, setTool] = useState<(typeof TOOLS)[number]>("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["history", session?.user.id, tool],
    queryFn: async () => {
      let q = supabase.from("generations").select("*").order("created_at", { ascending: false }).limit(60);
      q = tool === "all" ? q.neq("tool", "voice") : q.eq("tool", tool === "voice" ? "voice_full" : tool);
      const rows = (await q).data ?? [];
      const paths = rows.map((r) => r.output_path).filter(Boolean) as string[];
      const urls = paths.length
        ? ((await supabase.storage.from("generations").createSignedUrls(paths, 3600)).data ?? [])
        : [];
      return rows.map((r) => ({ ...r, url: urls.find((u) => u.path === r.output_path)?.signedUrl ?? null }));
    },
  });

  return (
    <Page title="Generation History">
      <div className="flex flex-wrap gap-2">
        {TOOLS.map((t) => (
          <button key={t} onClick={() => setTool(t)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold capitalize ${tool === t ? "bg-primary text-primary-foreground" : "border border-border text-foreground"}`}>
            {t === "story" ? "script" : t}
          </button>
        ))}
      </div>
      {isLoading && <Card>Loading…</Card>}
      {!isLoading && data.length === 0 && <Card className="text-sm text-muted-foreground">No generations yet.</Card>}
      {data.map((g) => (
        <Card key={g.id} className="flex gap-4">
          {g.url && g.tool !== "voice_full" && g.tool !== "music" && g.tool !== "video" && <img src={g.url} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />}
          {g.url && g.tool === "video" && <video src={g.url} controls playsInline preload="metadata" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase text-primary">{g.tool === "voice_full" ? "Voice Studio" : g.tool === "story" ? "Script Studio" : g.tool}{g.style ? ` · ${g.style}` : ""}{g.cost ? ` · ${g.cost} credits` : ""}</p>
            {g.tool === "story" ? (
              <details className="mt-0.5 text-sm text-foreground">
                <summary className="cursor-pointer font-semibold">{(g.prompt ?? "").split("\n")[0]}</summary>
                <p className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-2xl bg-accent p-3">{g.prompt}</p>
                <button className="mt-2 text-xs font-bold text-primary" onClick={() => navigator.clipboard.writeText(g.prompt ?? "")}>Copy script</button>
              </details>
            ) : (
              <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{g.prompt}</p>
            )}
            {g.url && (g.tool === "voice_full" || g.tool === "music") && <audio controls preload="metadata" src={g.url} className="mt-2 w-full" />}
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(g.created_at).toLocaleString()} ·{" "}
              <span className={g.status === "failed" ? "text-destructive" : ""}>{g.status === "failed" ? "Failed (refunded)" : g.status}</span>
            </p>
            {g.url && (
              <div className="mt-2 flex gap-2">
                <a href={g.url} target="_blank" rel="noreferrer" className={btnOutline}>Open</a>
                <a href={g.url} download={`${g.tool}-${g.id}.${g.tool === "voice_full" || g.tool === "music" || g.tool === "video" ? (g.output_path?.split(".").pop() ?? "mp3") : "png"}`} className={btnOutline}>Download</a>
              </div>
            )}
          </div>
        </Card>
      ))}
    </Page>
  );
}
