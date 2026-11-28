import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-only: short-lived signed link to the private website source ZIP. */
export const getSiteExportUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isOwner, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    if (error || !isOwner) throw new Error("Forbidden: owner only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error: e2 } = await supabaseAdmin.storage.from("site-exports").createSignedUrl("modernnova-website.zip", 120, { download: "modernnova-website.zip" });
    if (e2 || !data) throw new Error("Export ZIP not found");
    return { url: data.signedUrl };
  });
