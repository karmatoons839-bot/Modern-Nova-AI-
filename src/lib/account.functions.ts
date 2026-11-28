import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Creates the signed-in user's profile once (Free plan, 5,000 credits). */
export const ensureProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = context.claims as { email?: string; user_metadata?: { full_name?: string; name?: string } };
    const name = claims.user_metadata?.full_name || claims.user_metadata?.name || claims.email?.split("@")[0] || "Creator";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("ensure_profile", {
      _user: context.userId,
      _name: name,
      _email: claims.email ?? "",
    });
    if (error) throw new Error("Could not set up your account.");
    // Welcome email only for a freshly created profile; the idempotency key
    // also dedupes repeat calls, and failures never block account setup.
    try {
      const { data: profile } = await supabaseAdmin.from("profiles").select("created_at").eq("id", context.userId).maybeSingle();
      if (profile?.created_at && Date.now() - new Date(profile.created_at).getTime() < 10 * 60 * 1000) {
        const { notifyUserById } = await import("./email-notify.server");
        await notifyUserById(context.userId, "welcome", { name }, `welcome-${context.userId}`, "account");
      }
    } catch (e) {
      console.error("Welcome email failed", e);
    }
    return { ok: true };
  });

/** Deletes the signed-in user's own generation history (and stored files). */
export const clearHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("generations").select("output_path").eq("user_id", context.userId);
    const paths = (rows ?? []).map((r) => r.output_path).filter(Boolean) as string[];
    if (paths.length) await supabaseAdmin.storage.from("generations").remove(paths);
    await supabaseAdmin.from("credit_ledger").update({ generation_id: null }).eq("user_id", context.userId);
    const { error } = await supabaseAdmin.from("generations").delete().eq("user_id", context.userId).neq("status", "pending");
    if (error) throw new Error("Could not clear history.");
    return { ok: true };
  });

/** Permanently deletes the signed-in user's account. Admin accounts can't self-delete. */
export const deleteAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (isAdmin) throw new Error("The admin account cannot be deleted here.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const email = (context.claims as { email?: string }).email ?? "";
    const { data: files } = await supabaseAdmin.storage.from("generations").list(uid);
    if (files?.length) await supabaseAdmin.storage.from("generations").remove(files.map((f) => `${uid}/${f.name}`));
    const { data: av } = await supabaseAdmin.storage.from("avatars").list(uid);
    if (av?.length) await supabaseAdmin.storage.from("avatars").remove(av.map((f) => `${uid}/${f.name}`));
    for (const t of ["credit_ledger", "generations", "payments"] as const) await supabaseAdmin.from(t).delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").delete().eq("id", uid);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error("Could not delete account. Please contact support.");
    await supabaseAdmin.rpc("admin_notify", { _type: "user", _title: "[Modern Nova AI] Account Deleted", _message: `User ${email} deleted their account.`, _priority: "medium", _user: null as unknown as string, _txn: null as unknown as string, _meta: { email }, _group: null as unknown as string });
    return { ok: true };
  });
