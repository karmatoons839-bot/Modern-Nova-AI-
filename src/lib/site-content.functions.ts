import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CONTENT_FIELDS } from "./site-content";

/** Publish edited site text/images. Only the main admin (DB admin role) can publish. */
export const publishSiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ changes: z.record(z.string(), z.string().max(1_500_000)) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as { supabase: any; userId: string; claims: { email?: string } };
    const { data: isAdmin } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden: admin only");
    const fields = new Map(CONTENT_FIELDS.map((f) => [f.key, f]));
    const entries = Object.entries(data.changes);
    if (entries.length === 0) throw new Error("Nothing changed");
    for (const [k, v] of entries) {
      const f = fields.get(k);
      if (!f) throw new Error(`Unknown field: ${k}`);
      if (f.kind === "image" && v && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(v)) throw new Error(`${f.label}: invalid image`);
      if (f.kind !== "image" && v.length > 5000) throw new Error(`${f.label}: text too long`);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("site_content")
      .upsert(entries.map(([key, value]) => ({ key, value, updated_by: ctx.userId, updated_at: now })));
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_audit_log").insert({
      admin_id: ctx.userId,
      admin_email: ctx.claims.email ?? null,
      action: "site_content_published",
      details: { keys: entries.map(([k]) => k) },
    });
    return { ok: true, count: entries.length };
  });
