import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed-in users get short-lived links only for enabled library characters; storage reads stay admin-only. */
export const listS2vCharacters = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async () => {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data, error } = await db.from("s2v_characters").select("id, name, category, description, image_path, enabled").eq("enabled", true).order("sort_order");
  if (error) throw new Error("Characters unavailable");
  const rows = data ?? [];
  const signed = rows.length ? (await db.storage.from("s2v-characters").createSignedUrls(rows.map((r) => r.image_path), 3600)).data ?? [] : [];
  return rows.map((r, i) => ({ ...r, url: signed[i]?.signedUrl ?? "" }));
});
