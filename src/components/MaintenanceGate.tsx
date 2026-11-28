import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Wrench } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { setMaintenance } from "@/lib/maintenance.functions";
import { Button } from "@/components/ui/button";
import logo from "@/assets/modern-nova-logo-clear.png";

function useMaintenanceState() {
  const qc = useQueryClient();
  const state = useQuery({ queryKey: ["maintenance"], refetchInterval: 5000, staleTime: 0, queryFn: async () => {
    const { data, error } = await supabase.rpc("get_site_maintenance");
    if (error) throw error;
    return data ?? true;
  }});
  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["maintenance"] }); };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [qc]);
  return state;
}

/** Owner-only switch, rendered inside the Admin Dashboard (not site-wide). */
export function MaintenanceControl() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const update = useServerFn(setMaintenance);
  const state = useMaintenanceState();
  if (state.isPending) return null;
  const enabled = state.data ?? true;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted px-4 py-3 text-sm text-foreground">
      <span className="flex items-center gap-2"><Wrench className="h-4 w-4 text-primary" />{enabled ? t("maintenanceAdminOn") : t("maintenanceAdminOff")}</span>
      <Button size="sm" variant="outline" onClick={async () => {
        if (!window.confirm(enabled ? t("maintenanceConfirmOff") : t("maintenanceConfirmOn"))) return;
        try { await update({ data: { enabled: !enabled } }); await qc.invalidateQueries({ queryKey: ["maintenance"] }); }
        catch { toast.error(t("serverIssue")); }
      }}>{enabled ? t("maintenanceRemove") : t("maintenanceEnable")}</Button>
    </div>
  );
}

export function MaintenanceGate({ children }: { children: ReactNode }) {
  const { ready, session } = useAuth();
  const profile = useProfile();
  const { t } = useI18n();
  const path = useLocation({ select: l => l.pathname });
  const state = useMaintenanceState();
  if (!ready || state.isPending || (session && profile.isPending)) return <div className="min-h-screen bg-background" />;
  const enabled = state.data ?? true;
  if (profile.data?.is_admin) return <>{children}</>;
  if (!enabled || path === "/auth" || path === "/reset-password" || path === "/privacy" || path === "/terms") return <>{children}</>;
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
    <img src={logo} alt="Modern Nova AI" className="h-24 w-24 object-contain" />
    <h1 className="font-display text-3xl font-bold">Modern Nova AI</h1>
    <Wrench className="h-8 w-8 text-primary" />
    <h2 className="text-xl font-semibold">{t("maintenanceTitle")}</h2>
    <p className="max-w-md text-muted-foreground">{t("maintenanceBody")}</p>
    <Button variant="outline" asChild><Link to="/auth">{t("maintenanceLogin")}</Link></Button>
  </main>;
}
