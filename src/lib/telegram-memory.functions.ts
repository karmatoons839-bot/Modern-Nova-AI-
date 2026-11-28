import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const filters = z.object({ search: z.string().max(200).default(""), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).default(""), conversation: z.string().uuid().optional() });

export const getTelegramMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => filters.parse(v)).handler(async ({ context, data }) => {
  const { data: owner, error: denied } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (denied || !owner) throw new Error("Owner access required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let list = supabaseAdmin.from("telegram_conversations").select("*").order("updated_at", { ascending: false }).limit(50);
  if (/^-?\d+$/.test(data.search)) list = list.or(`telegram_user_id.eq.${data.search},chat_id.eq.${data.search}`);
  else if (data.search) {
    const { data: hits, error } = await supabaseAdmin.from("telegram_messages").select("conversation_id").ilike("content", `%${data.search.replace(/[%_]/g, "")}%`).limit(100);
    if (error) throw new Error("Memory search unavailable.");
    list = list.in("id", hits?.length ? [...new Set(hits.map(h => h.conversation_id))] : ["00000000-0000-0000-0000-000000000000"]);
  }
  const { data: conversations, error: listError } = await list;
  if (listError) throw new Error("Memory database unavailable.");
  const selected = data.conversation;
  let history = supabaseAdmin.from("telegram_messages").select("id,role,content,created_at,update_id").eq("conversation_id", selected ?? "00000000-0000-0000-0000-000000000000").order("id", { ascending: false }).limit(100);
  if (data.from) history = history.gte("created_at", `${data.from}T00:00:00Z`);
  if (data.to) history = history.lte("created_at", `${data.to}T23:59:59.999Z`);
  if (data.search && !/^-?\d+$/.test(data.search)) history = history.ilike("content", `%${data.search.replace(/[%_]/g, "")}%`);
  const [messages, summaries, memory, errors, updates] = await Promise.all([
    history,
    supabaseAdmin.from("telegram_memory_summaries").select("id,content,created_at").eq("conversation_id", selected ?? "00000000-0000-0000-0000-000000000000").order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("telegram_user_memories").select("content,updated_at").eq("conversation_id", selected ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
    supabaseAdmin.from("telegram_conversations").select("id,last_error_code,last_error_at").not("last_error_code", "is", null).order("last_error_at", { ascending: false }).limit(20),
    supabaseAdmin.from("telegram_updates").select("update_id,status,error_code,received_at").or("status.in.(failed,processing),error_code.not.is.null").order("received_at", { ascending: false }).limit(20),
  ]);
  if ([messages, summaries, memory, errors, updates].some(r => r.error)) throw new Error("Memory details unavailable.");
  return { conversations: conversations ?? [], messages: (messages.data ?? []).reverse(), summaries: summaries.data ?? [], memory: memory.data, errors: errors.data ?? [], updates: updates.data ?? [] };
});

export const manageTelegramMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ conversation: z.string().uuid(), action: z.enum(["correct", "delete"]), content: z.string().max(6000), reason: z.string().trim().min(5).max(300), confirmed: z.literal(true) }).parse(v)).handler(async ({ context, data }) => {
  const { data: owner, error: denied } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (denied || !owner) throw new Error("Owner access required.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("telegram_manage_memory", { _owner: context.userId, _conversation: data.conversation, _action: data.action, _content: data.content, _reason: data.reason });
  if (error) throw new Error("Memory change refused. No change is confirmed.");
  return { saved: true };
});