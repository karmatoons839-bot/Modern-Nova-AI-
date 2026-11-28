/** Sends a finished Script-to-Video to the owner's admin Telegram group: every clip in order, then the full video (media only). */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const S2V_NOTIFY_CHAT_ID = "-1004423710774";

export async function notifyS2vVideo(projectId: string) {
  const { data: p } = await supabaseAdmin.from("s2v_projects").select("generation_id").eq("id", projectId).maybeSingle();
  if (!p?.generation_id) return;
  const { data: claimed } = await supabaseAdmin.from("generations").update({ telegram_claimed_at: new Date().toISOString() }).eq("id", p.generation_id).is("telegram_sent_at", null).select("id");
  if (!claimed?.length) return;
  const { forwardOne } = await import("./generation-forward.server");
  await forwardOne(p.generation_id);
}
