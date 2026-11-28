import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "./auth";

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  user_id: string | null;
  transaction_id: string | null;
  metadata: Record<string, unknown>;
  occurrences: number;
  is_read: boolean;
  email_sent: boolean;
  email_error: string | null;
  created_at: string;
  updated_at: string;
};

export const ist = (d: string) =>
  new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";

/** Unread count + latest items; RLS returns rows only for admins. */
export function useAdminBell() {
  const { data: p } = useProfile();
  return useQuery({
    queryKey: ["admin-bell"],
    enabled: Boolean(p?.is_admin || p?.team?.sections.includes("notifications")),
    refetchInterval: 30_000,
    queryFn: async () => {
      const [{ count }, { data }] = await Promise.all([
        supabase.from("admin_notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
        supabase.from("admin_notifications").select("*").order("updated_at", { ascending: false }).limit(6),
      ]);
      return { unread: count ?? 0, latest: (data ?? []) as AdminNotification[] };
    },
  });
}

export function useInvalidateAdmin() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["admin-bell"] });
    void qc.invalidateQueries({ queryKey: ["admin-notifications"] });
  };
}
