import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { maintenanceBlocks, MAINTENANCE_MESSAGE } from "./maintenance-policy";

export async function requireGenerationAvailable(userId: string) {
  const { data: admin, error: roleError } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (roleError) throw Object.assign(new Error("Server issue. Please try again later."), { status: 503, code: "SERVER_ISSUE" });
  if (admin) return;
  const { data, error } = await supabaseAdmin.from("site_maintenance").select("enabled").eq("id", true).maybeSingle();
  if (error || maintenanceBlocks(data?.enabled ?? true, false)) {
    throw Object.assign(new Error(MAINTENANCE_MESSAGE), { status: 503, code: "SITE_MAINTENANCE" });
  }
}