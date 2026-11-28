import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims: { email?: string } };

/** Server-side admin check: role row in the database, never the browser. */
async function requireAdmin(ctx: Ctx, section: string | null = null, edit = false) {
  const { data, error } = section
    ? await ctx.supabase.rpc("admin_can", { _user: ctx.userId, _section: section, _edit: edit })
    : await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error(edit ? "Forbidden: you don't have edit access here" : "Forbidden: no access to this section");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function requireTeam(ctx: Ctx) {
  const { data: owner } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!owner) {
    const { data: m } = await ctx.supabase.from("admin_members").select("user_id").eq("user_id", ctx.userId).maybeSingle();
    if (!m) throw new Error("Forbidden: admin only");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(db: any, ctx: Ctx, action: string, target: string | null, reason: string | null, relatedId: string | null, details: object = {}) {
  await db.from("admin_audit_log").insert({
    admin_id: ctx.userId,
    admin_email: ctx.claims.email ?? null,
    action,
    target_user: target,
    reason,
    related_id: relatedId,
    details,
  });
}

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { q?: string }) => z.object({ q: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as Ctx, "users");
    let q = db.from("profiles").select("id, display_name, email, plan, credits, status, created_at").order("created_at", { ascending: false }).limit(1000);
    if (data.q) q = q.ilike("email", `%${data.q.replace(/[%_]/g, "")}%`);
    const { data: rows } = await q;
    return rows ?? [];
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), amount: z.number().int().min(-1_000_000).max(1_000_000).refine((n) => n !== 0), reason: z.string().trim().min(2).max(300) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "users", true);
    if (data.userId === ctx.userId) throw new Error("You can't change your own credits. Ask another admin.");
    const { data: p } = await db.from("profiles").select("credits, email").eq("id", data.userId).single();
    if (!p) throw new Error("User not found");
    const next = Math.max(0, p.credits + data.amount);
    await db.from("profiles").update({ credits: next, updated_at: new Date().toISOString() }).eq("id", data.userId);
    const { data: led } = await db.from("credit_ledger").insert({ user_id: data.userId, amount: next - p.credits, reason: `Admin: ${data.reason}` }).select("id").single();
    const added = data.amount > 0;
    await audit(db, ctx, added ? "credits_added" : "credits_removed", data.userId, data.reason, led?.id ?? null, { amount: data.amount });
    await db.rpc("admin_notify", {
      _type: "credits",
      _title: `[Modern Nova AI] Credits Manually ${added ? "Added" : "Removed"}`,
      _message: `${ctx.claims.email} ${added ? "added" : "removed"} ${Math.abs(data.amount)} credits ${added ? "to" : "from"} ${p.email}. Reason: ${data.reason}`,
      _priority: "low",
      _user: data.userId,
      ...(led?.id ? { _txn: led.id } : {}),
      _meta: { amount: data.amount, admin: ctx.claims.email },
    });
    return { credits: next };
  });

/** Give or remove a plan. Giving PRO/PREMIUM also adds that plan's monthly credits once and sets 30-day renewal. */
export const adminSetPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), plan: z.enum(["free", "creator", "pro", "premium"]), addCredits: z.boolean().default(true) }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "users", true);
    if (data.userId === ctx.userId) throw new Error("You can't change your own plan. Ask another admin.");
    const { PLANS } = await import("./plans");
    const { data: p } = await db.from("profiles").select("credits, email, plan").eq("id", data.userId).single();
    if (!p) throw new Error("User not found");
    const paid = data.plan !== "free";
    const bonus = paid && data.addCredits ? (PLANS.find((x) => x.id === data.plan)?.credits ?? 0) : 0;
    const now = new Date();
    await db.from("profiles").update({
      plan: data.plan,
      subscription_status: paid ? "active" : "none",
      plan_renews_at: paid ? new Date(now.getTime() + 30 * 86400_000).toISOString() : null,
      credits: p.credits + bonus,
      updated_at: now.toISOString(),
    }).eq("id", data.userId);
    let ledId: string | null = null;
    if (bonus) {
      const { data: led } = await db.from("credit_ledger").insert({ user_id: data.userId, amount: bonus, reason: `Admin: ${data.plan.toUpperCase()} plan given` }).select("id").single();
      ledId = led?.id ?? null;
    }
    await audit(db, ctx, paid ? "plan_given" : "plan_removed", data.userId, `${p.plan} → ${data.plan}`, ledId, { plan: data.plan, credits_added: bonus });
    await db.rpc("admin_notify", {
      _type: "subscription",
      _title: `[Modern Nova AI] Plan ${paid ? "Given" : "Removed"} by Admin`,
      _message: `${ctx.claims.email} changed ${p.email} from ${p.plan.toUpperCase()} to ${data.plan.toUpperCase()}${bonus ? ` (+${bonus} credits)` : ""}.`,
      _priority: "low",
      _user: data.userId,
    });
    return { plan: data.plan, credits: p.credits + bonus };
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]), reason: z.string().trim().max(300).default("") }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "users", true);
    if (data.userId === ctx.userId) throw new Error("You can't suspend your own admin account.");
    const { data: p } = await db.from("profiles").update({ status: data.status }).eq("id", data.userId).select("email, display_name").single();
    if (!p) throw new Error("User not found");
    const s = data.status === "suspended";
    await audit(db, ctx, s ? "user_suspended" : "user_activated", data.userId, data.reason || null, null);
    await db.rpc("admin_notify", {
      _type: "user",
      _title: `[Modern Nova AI] User ${s ? "Suspended" : "Activated"}`,
      _message: `${p.display_name ?? ""} (${p.email}) was ${s ? "suspended" : "activated"} by ${ctx.claims.email}.${data.reason ? " Reason: " + data.reason : ""}`,
      _priority: "low",
      _user: data.userId,
    });
    return { ok: true };
  });

const SettingsSchema = z.object({
  email_enabled: z.boolean(),
  security_alerts: z.boolean(),
  user_notifications: z.boolean(),
  payment_notifications: z.boolean(),
  subscription_notifications: z.boolean(),
  api_notifications: z.boolean(),
  support_notifications: z.boolean(),
  system_notifications: z.boolean(),
});

/** The recipient email is not editable here on purpose — changing it needs a verified backend change. */
export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "settings", true);
    await db.from("admin_settings").update({ ...data, updated_at: new Date().toISOString() }).eq("id", true);
    await audit(db, ctx, "notification_settings_changed", null, null, null, data);
    return { ok: true };
  });

/** Called once after a successful sign-in. */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ua = (getRequestHeader("user-agent") ?? "").slice(0, 300);
    const email = ctx.claims.email ?? "";
    const { data: prev } = await supabaseAdmin.from("login_events").select("user_agent").eq("user_id", ctx.userId).eq("success", true).order("created_at", { ascending: false }).limit(20);
    await supabaseAdmin.from("login_events").insert({ email, user_id: ctx.userId, success: true, user_agent: ua });
    // Only notable logins notify: first login or a device/browser not seen before.
    if (!prev?.some((p) => p.user_agent === ua)) {
      await supabaseAdmin.rpc("admin_notify", {
        _type: "security",
        _title: "[Modern Nova AI] New Device Login",
        _message: `${email} signed in from a new device/browser: ${ua || "unknown"}`,
        _priority: prev && prev.length > 0 ? "medium" : "low",
        _user: ctx.userId,
        _meta: { user_agent: ua },
      });
    }
    return { ok: true };
  });

/** Public: records a failed sign-in. 5+ failures within 15 minutes → one grouped security alert. */
export const recordFailedLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    // Only count attempts that genuinely fail, checked here on the server.
    const { createClient } = await import("@supabase/supabase-js");
    const probe = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: ok } = await probe.auth.signInWithPassword({ email: data.email, password: data.password });
    if (ok.session) { await probe.auth.signOut().catch(() => {}); return { ok: true }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Only real accounts are tracked, so made-up emails cannot create alerts.
    const { data: account } = await supabaseAdmin.from("profiles").select("id").eq("email", data.email).maybeSingle();
    if (!account) return { ok: true };
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin.from("login_events").select("id", { count: "exact", head: true }).eq("email", data.email).eq("success", false).gte("created_at", since);
    if ((count ?? 0) >= 50) return { ok: true }; // stop storing spam
    const ua = (getRequestHeader("user-agent") ?? "").slice(0, 300);
    await supabaseAdmin.from("login_events").insert({ email: data.email, user_id: account.id, success: false, user_agent: ua });
    const n = (count ?? 0) + 1;
    if (n >= 5) {
      await supabaseAdmin.rpc("admin_notify", {
        _type: "security",
        _title: "[Modern Nova AI] Security Alert — Multiple Failed Login Attempts",
        _message: `${n} failed login attempts for ${data.email} in the last 15 minutes. Latest browser: ${ua || "unknown"}`,
        _priority: "medium",
        _user: account.id,
        _meta: { email: data.email, attempts: n },
        _group: `failed-login-${data.email}`,
      });
    }
    return { ok: true };
  });

export const submitSupport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(1).max(80),
      email: z.string().trim().email().max(200),
      subject: z.string().trim().min(2).max(150),
      message: z.string().trim().min(5).max(3000),
      token: z.string().max(4000).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let userId: string | null = null;
    if (data.token) {
      const { data: u } = await supabaseAdmin.auth.getUser(data.token);
      userId = u.user?.id ?? null;
    }
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    // Signed-in users are limited by their own account, so strangers using their email cannot block them.
    const limitQ = supabaseAdmin.from("support_messages").select("id", { count: "exact", head: true }).gte("created_at", since);
    const { count } = await (userId ? limitQ.eq("user_id", userId) : limitQ.eq("email", data.email).is("user_id", null));
    if ((count ?? 0) >= 5) throw new Error("Too many messages. Please try again later.");
    const { data: row } = await supabaseAdmin.from("support_messages").insert({ user_id: userId, name: data.name, email: data.email, subject: data.subject, message: data.message }).select("id").single();
    await supabaseAdmin.rpc("admin_notify", {
      _type: "support",
      _title: `[Modern Nova AI] Support: ${data.subject}`,
      _message: `${data.name} (${data.email}): ${data.message}`,
      _priority: "medium",
      ...(userId ? { _user: userId } : {}),
      ...(row?.id ? { _txn: row.id } : {}),
      _meta: { name: data.name, email: data.email, subject: data.subject },
    });
    return { ok: true };
  });

export const adminListGenerations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tool?: string; q?: string }) => z.object({ tool: z.string().max(20).optional(), q: z.string().max(100).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as Ctx, "generations");
    let q = db.from("generations").select("id, user_id, tool, prompt, style, status, cost, error, output_path, created_at").order("created_at", { ascending: false }).limit(1000);
    if (data.tool && data.tool !== "all") q = q.eq("tool", data.tool);
    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
    const paths = (rows ?? []).map((r: any) => r.output_path).filter(Boolean) as string[];
    const { data: signed } = paths.length ? await db.storage.from("generations").createSignedUrls(paths, 300) : { data: [] };
    const urls = new Map((signed ?? []).map((item: any) => [item.path, item.signedUrl]));
    let out = (rows ?? []).map((r: any) => ({ ...r, email: (map.get(r.user_id) as string) ?? "?", output_url: r.output_path ? (urls.get(r.output_path) as string | undefined) ?? null : null }));
    if (data.q) out = out.filter((r: any) => r.email.toLowerCase().includes(data.q!.toLowerCase()));
    return out as { id: string; user_id: string; tool: string; prompt: string | null; style: string | null; status: string; cost: number; error: string | null; output_path: string | null; output_url: string | null; created_at: string; email: string }[];
  });

export const adminStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireTeam(context as Ctx);
    const c = async (t: string, f?: (q: any) => any) => {
      let q = (db as any).from(t).select("id", { count: "exact", head: true });
      if (f) q = f(q);
      return (await q).count ?? 0;
    };
    return {
      users: await c("profiles"),
      generations: await c("generations"),
      failed: await c("generations", (q) => q.eq("status", "failed")),
      payments: await c("payments", (q) => q.eq("status", "success")),
    };
  });

const promoCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, "Code: 3–30 letters, numbers, - or _");

export const adminListPromos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context as Ctx, "promos");
    const { data, error } = await db.from("promo_codes").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as { id: string; code: string; percent: number; active: boolean; max_uses: number | null; uses: number; expires_at: string | null; created_at: string }[];
  });

export const adminCreatePromo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string; percent: number; max_uses?: number | null; expires_at?: string | null }) =>
    z.object({ code: promoCode, percent: z.number().int().min(1).max(90), max_uses: z.number().int().positive().nullable().optional(), expires_at: z.string().datetime().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "promos", true);
    const { data: row, error } = await db.from("promo_codes").insert({ code: data.code, percent: data.percent, max_uses: data.max_uses ?? null, expires_at: data.expires_at ?? null, created_by: ctx.userId }).select("id").single();
    if (error) throw new Error(error.code === "23505" ? "This promo code already exists" : error.message);
    await audit(db, ctx, "promo_create", null, null, row.id, { code: data.code, percent: data.percent });
    return { ok: true };
  });

export const adminSetPromoActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; active: boolean }) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "promos", true);
    const { error } = await db.from("promo_codes").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(db, ctx, data.active ? "promo_activate" : "promo_deactivate", null, null, data.id);
    return { ok: true };
  });

export const adminListPayments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string }) => z.object({ status: z.string().max(20).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await requireAdmin(context as Ctx, "payments");
    await db.rpc("expire_subscriptions", {});
    let q = db.from("payments").select("order_id, user_id, plan, amount_paise, status, provider_payment_id, payment_method, credits, promo_code, created_at, verified_at, subscription_end").order("created_at", { ascending: false }).limit(1000);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows } = await q;
    const ids = [...new Set((rows ?? []).map((r: any) => r.user_id))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
    return (rows ?? []).map((r: any) => ({ ...r, email: (map.get(r.user_id) as string) ?? "?" })) as { order_id: string; plan: string; amount_paise: number; status: string; provider_payment_id: string | null; payment_method: string | null; credits: number; promo_code: string | null; created_at: string; verified_at: string | null; subscription_end: string | null; email: string }[];
  });

/** Admin confirms a direct-UPI payment after seeing it in the bank/UPI app; activation stays idempotent in activate_payment. */
export const adminReviewUpiPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { order_id: string; approve: boolean; reason?: string }) =>
    z.object({ order_id: z.string().max(60), approve: z.boolean(), reason: z.string().max(300).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx, "payments", true);
    const { data: p } = await db.from("payments").select("*").eq("order_id", data.order_id).maybeSingle();
    if (!p || p.status !== "pending" || p.payment_method !== "upi_manual") throw new Error("Only pending UPI orders can be reviewed");
    if (data.approve) {
      if (p.user_id === ctx.userId) throw new Error("You can't approve your own payment. Ask another admin.");
      if (!p.provider_payment_id) throw new Error("The user has not submitted a UTR yet");
      const { error } = await db.rpc("activate_payment", { _order: p.order_id, _txn: p.provider_payment_id, _method: "upi", _amount_paise: p.amount_paise });
      if (error) throw new Error(error.message);
      try {
        const { notifyUserById } = await import("./email-notify.server");
        const { PLANS } = await import("./plans");
        await notifyUserById(p.user_id, "payment-receipt", { planName: PLANS.find((x) => x.id === p.plan)?.name ?? p.plan, credits: p.credits, amountInr: p.amount_paise / 100, orderId: p.order_id, method: "UPI" }, `payment-receipt-${p.order_id}`, "payment");
      } catch (e) { console.error("Payment receipt email failed", e); }
    } else {
      await db.rpc("close_payment", { _order: p.order_id, _status: "failed", _reason: data.reason || "Payment not received" });
    }
    await audit(db, ctx, data.approve ? "upi_payment_approve" : "upi_payment_reject", p.user_id, data.reason ?? null, p.order_id, { amount_paise: p.amount_paise, plan: p.plan, utr: p.provider_payment_id });
    return { ok: true };
  });

export const adminMusicReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context as Ctx, "generations");
    const { data: rows } = await db.from("music_transactions").select("id, user_id, duration, credit_cost, status, generation_id, created_at").order("created_at", { ascending: false }).limit(1000);
    const list = (rows ?? []) as { id: string; user_id: string; duration: number; credit_cost: number; status: string; generation_id: string; created_at: string }[];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p.email as string]));
    return {
      total: list.length,
      consumed: list.filter((r) => r.status === "completed").reduce((s, r) => s + r.credit_cost, 0),
      failed: list.filter((r) => r.status === "refunded").length,
      refunded: list.filter((r) => r.status === "refunded").reduce((s, r) => s + r.credit_cost, 0),
      rows: list.map((r) => ({ ...r, email: map.get(r.user_id) ?? "?" })),
    };
  });

export const ADMIN_SECTIONS = ["users", "payments", "generations", "devapi", "promos", "notifications", "audit", "settings", "telegram"] as const;

/** Owner-only: list the admin team. */
export const adminListTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireAdmin(context as Ctx);
    const { data } = await db.from("admin_members").select("*").order("created_at", { ascending: false });
    return data ?? [];
  });

/** Owner-only: add or update a team admin by email. */
export const adminSaveTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      sections: z.array(z.enum(ADMIN_SECTIONS)).max(ADMIN_SECTIONS.length),
      can_edit: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx);
    const { data: p } = await db.from("profiles").select("id, email").ilike("email", data.email).maybeSingle();
    if (!p) throw new Error("No account found with this email. Ask them to sign up first.");
    if (p.id === ctx.userId) throw new Error("You are already the main admin.");
    const { error } = await db.from("admin_members").upsert({
      user_id: p.id, email: p.email, sections: data.sections, can_edit: data.can_edit,
      unlimited_credits: false, added_by: ctx.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit(db, ctx, "team_admin_saved", p.id, null, null, data);
    return { ok: true };
  });

export const adminRemoveTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const db = await requireAdmin(ctx);
    await db.from("admin_members").delete().eq("user_id", data.userId);
    await audit(db, ctx, "team_admin_removed", data.userId, null, null);
    return { ok: true };
  });
