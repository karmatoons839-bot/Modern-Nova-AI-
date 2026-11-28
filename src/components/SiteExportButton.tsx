import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSiteExportUrl } from "@/lib/site-export.functions";

export function SiteExportButton() {
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try { const { url } = await getSiteExportUrl(); window.location.href = url; }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); }
    finally { setBusy(false); }
  }
  return (
    <div className="mb-4 rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 font-semibold">Complete Website Source (ZIP)</p>
      <p className="mb-3 text-sm text-muted-foreground">Poora source code, database schema, README aur .env.example — Vercel, Netlify, Node ya Cloudflare par host karne ke liye.</p>
      <Button onClick={go} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download Complete Website ZIP</Button>
    </div>
  );
}
