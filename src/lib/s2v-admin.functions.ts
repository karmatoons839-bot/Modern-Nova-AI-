import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const { data } = (await (ctx.supabase.rpc as unknown as (n: string, a: object) => Promise<{ data: boolean }>)("has_role", { _user_id: ctx.userId, _role: "admin" }));
  if (!data) throw new Error("Forbidden");
}

/** Admin stats over all Script-to-Video jobs. */
export const s2vAdminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("s2v_projects").select("id, user_id, title, status, total_seconds, credits_charged, scene_count, created_at, final_video_path").order("created_at", { ascending: false }).limit(500);
    const rows = data ?? [];
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const { data: profiles } = ids.length ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const email = new Map((profiles ?? []).map((p) => [p.id, p.email]));
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    const charged = rows.filter((r) => r.status === "completed" || r.status === "clips_ready" || r.status === "generating");
    return {
      total: rows.length,
      completed: by("completed"),
      failed: by("failed") + by("cancelled"),
      running: by("generating") + by("clips_ready"),
      secondsGenerated: charged.reduce((a, r) => a + r.total_seconds, 0),
      creditsCharged: charged.reduce((a, r) => a + r.credits_charged, 0),
      recent: rows.slice(0, 50).map((r) => ({ ...r, email: email.get(r.user_id) ?? "" })),
    };
  });

/** Admin storage cleanup: removes a finished/failed job's files and row. */
export const s2vAdminDelete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin.from("s2v_projects").select("id, user_id, status, background_path").eq("id", data.id).single();
    if (!p) throw new Error("Not found");
    if (p.status === "generating") throw new Error("Job is still running");
    const dir = `${p.user_id}/s2v/${p.id}`;
    const { data: files } = await supabaseAdmin.storage.from("generations").list(dir);
    await supabaseAdmin.storage.from("generations").remove([...(files ?? []).map((f) => `${dir}/${f.name}`), p.background_path]);
    await supabaseAdmin.from("s2v_projects").delete().eq("id", p.id);
    return { ok: true };
  });
