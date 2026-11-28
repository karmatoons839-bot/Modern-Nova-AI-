import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { API_SERVICES, DEFAULT_RATE_LIMIT, FREE_API_CREDITS } from "./devapi-config";

const available = API_SERVICES.filter((s) => s.available).map((s) => s.id) as [string, ...string[]];

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const getDevDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase;
    const uid = context.userId;
    const [apis, wallet, reqs, tx, orders, pkgs] = await Promise.all([
      db.from("api_projects").select("id, name, brand, website_url, description, services, key_prefix, status, rate_limit_per_min, created_at").eq("user_id", uid).order("created_at"),
      db.from("api_wallets").select("balance, free_granted").eq("user_id", uid).maybeSingle(),
      db.from("api_requests").select("service, status_code, credits_used, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(500),
      db.from("api_credit_transactions").select("kind, credits").eq("user_id", uid),
      db.from("api_credit_orders").select("id, credits, amount_inr, status, created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
      db.from("api_credit_packages").select("id, name, credits, price_inr, description, is_custom").eq("active", true).order("sort"),
    ]);
    const t = tx.data ?? [];
    const added = t.filter((x) => x.kind === "grant" || x.kind === "purchase").reduce((a, x) => a + Number(x.credits), 0);
    return {
      apis: apis.data ?? [],
      balance: Number(wallet.data?.balance ?? 0),
      freeGranted: Boolean(wallet.data?.free_granted),
      unlimited: false,
      totalAdded: added,
      requests: reqs.data ?? [],
      orders: orders.data ?? [],
      packages: pkgs.data ?? [],
    };
  });

export const createApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().trim().min(2).max(60),
      brand: z.string().trim().min(2).max(60),
      website_url: z.string().trim().url().max(200).refine((u) => u.startsWith("https://") || u.startsWith("http://")).or(z.literal("")),
      description: z.string().trim().max(300),
      services: z.array(z.enum(available)).min(1).max(8),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { count } = await db.from("api_projects").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if ((count ?? 0) >= 5) throw new Error("You can have up to 5 APIs.");
    const { newApiKey } = await import("./devapi.server");
    const k = newApiKey();
    const { data: row, error } = await db.from("api_projects").insert({
      user_id: context.userId, name: data.name, brand: data.brand, website_url: data.website_url || null,
      description: data.description || null, services: [...new Set(data.services)], key_hash: k.hash, key_prefix: k.prefix,
      rate_limit_per_min: DEFAULT_RATE_LIMIT,
    }).select("id").single();
    if (error) throw new Error("Could not create the API. Please try again.");
    const { data: bal } = await db.rpc("api_grant_free", { _user: context.userId, _amount: FREE_API_CREDITS });
    return { id: row.id, api_key: k.key, balance: Number(bal ?? 0) };
  });

const Id = z.object({ id: z.string().uuid() });

async function ownApi(uid: string, id: string) {
  const db = await admin();
  const { data } = await db.from("api_projects").select("id").eq("id", id).eq("user_id", uid).maybeSingle();
  if (!data) throw new Error("API not found.");
  return db;
}

export const setApiStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.extend({ status: z.enum(["active", "disabled"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await ownApi(context.userId, data.id);
    await db.from("api_projects").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const regenerateApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const db = await ownApi(context.userId, data.id);
    const { newApiKey } = await import("./devapi.server");
    const k = newApiKey();
    await db.from("api_projects").update({ key_hash: k.hash, key_prefix: k.prefix }).eq("id", data.id);
    return { api_key: k.key };
  });

export const deleteApi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const db = await ownApi(context.userId, data.id);
    await db.from("api_projects").delete().eq("id", data.id);
    return { ok: true };
  });

export const createApiCreditOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ package_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: p } = await db.from("api_credit_packages").select("*").eq("id", data.package_id).eq("active", true).maybeSingle();
    if (!p || p.is_custom || !p.price_inr) throw new Error("This package can't be bought online. Contact MODERNNOVAAI@gmail.com.");
    const vpa = process.env["UPI_PAYEE_VPA"];
    const name = process.env["UPI_PAYEE_NAME"] ?? "Modern Nova AI";
    if (!vpa) throw new Error("Online payment is not configured yet. No money was taken.");
    const { data: o, error } = await db.from("api_credit_orders").insert({ user_id: context.userId, package_id: p.id, credits: p.credits, amount_inr: p.price_inr }).select("id").single();
    if (error) throw new Error("Could not create the order.");
    const ref = `API-${o.id.slice(0, 8).toUpperCase()}`;
    const q = new URLSearchParams({ pa: vpa, pn: name, am: p.price_inr.toFixed(2), cu: "INR", tn: `Modern Nova API credits ${ref}`, tr: ref });
    return { order_id: o.id, ref, credits: Number(p.credits), amount: p.price_inr, upi_link: `upi://pay?${q.toString().replace(/\+/g, "%20")}` };
  });

export const submitApiOrderUtr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ order_id: z.string().uuid(), utr: z.string().regex(/^\d{12}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { data: o } = await db.from("api_credit_orders").select("id, status").eq("id", data.order_id).eq("user_id", context.userId).maybeSingle();
    if (!o || o.status !== "pending") throw new Error("Order not found or already submitted.");
    const { error } = await db.from("api_credit_orders").update({ utr: data.utr, status: "submitted" }).eq("id", o.id);
    if (error) throw new Error(error.message.includes("duplicate") ? "This UTR was already used." : "Could not save the UTR.");
    try {
      await db.rpc("admin_notify", { _type: "payment", _title: "[Modern Nova AI] API credit payment submitted", _message: `UTR ${data.utr} for API credits order ${o.id}`, _priority: "high", _user: context.userId, _txn: o.id, _meta: {} });
    } catch { /* notification must not block */ }
    return { ok: true };
  });

// ----- Admin -----
async function requireAdmin(ctx: { supabase: any; userId: string }, edit = false) {
  const { data } = await ctx.supabase.rpc("admin_can", { _user: ctx.userId, _section: "devapi", _edit: edit });
  if (!data) throw new Error("Forbidden: admin only");
}

export const adminApiOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const db = await admin();
    const [orders, apis, pkgs] = await Promise.all([
      db.from("api_credit_orders").select("id, user_id, credits, amount_inr, utr, status, created_at").order("created_at", { ascending: false }).limit(100),
      db.from("api_projects").select("id, user_id, name, brand, services, status, created_at").order("created_at", { ascending: false }).limit(200),
      db.from("api_credit_packages").select("*").order("sort"),
    ]);
    const ids = [...new Set([...(orders.data ?? []), ...(apis.data ?? [])].map((r) => r.user_id))];
    const { data: profs } = ids.length ? await db.from("profiles").select("id, email").in("id", ids) : { data: [] };
    const email = Object.fromEntries((profs ?? []).map((p) => [p.id, p.email]));
    return {
      orders: (orders.data ?? []).map((o) => ({ ...o, email: email[o.user_id] ?? null })),
      apis: (apis.data ?? []).map((a) => ({ ...a, email: email[a.user_id] ?? null })),
      packages: pkgs.data ?? [],
    };
  });

export const adminDecideApiOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context, true);
    if (data.approve) {
      const { error } = await context.supabase.rpc("api_approve_order", { _order: data.id });
      if (error) throw new Error(error.message);
    } else {
      const db = await admin();
      await db.from("api_credit_orders").update({ status: "rejected", decided_at: new Date().toISOString() }).eq("id", data.id).eq("status", "submitted");
    }
    return { ok: true };
  });

export const adminUpdateApiPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), price_inr: z.number().int().min(1).max(1000000), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context, true);
    const { data: isOwner } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "owner" });
    if (!isOwner) throw new Error("Only the owner can change API package prices");
    const db = await admin();
    await db.from("api_credit_packages").update({ price_inr: data.price_inr, active: data.active }).eq("id", data.id).eq("is_custom", false);
    return { ok: true };
  });
