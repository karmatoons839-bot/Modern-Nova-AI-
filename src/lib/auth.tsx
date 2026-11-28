import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "./account.functions";
import { recordLogin } from "./admin.functions";
import type { PlanId } from "./plans";

export type Profile = {
  id: string;
  display_name: string | null;
  email: string | null;
  language: "en" | "hinglish" | "hi" | null;
  plan: PlanId;
  credits: number;
  plan_renews_at: string | null;
  created_at: string;
  avatar_url?: string | null;
  notify_email?: boolean;
  notify_generation?: boolean;
  notify_payment?: boolean;
  is_admin?: boolean;
  is_owner?: boolean;
  team?: { sections: string[]; can_edit: boolean } | null;
};

const Ctx = createContext<{ session: Session | null; ready: boolean }>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") qc.clear();
      else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void qc.invalidateQueries({ queryKey: ["profile"] });
        // Once per browser session, so token refreshes/tab reloads don't spam.
        if (event === "SIGNED_IN" && s && sessionStorage.getItem("mn-login") !== s.user.id) {
          sessionStorage.setItem("mn-login", s.user.id);
          void recordLogin().catch(() => {});
        }
      }
    });
    void supabase.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);

  return <Ctx.Provider value={{ session, ready }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}

/** The signed-in user's profile, always read from the backend. */
export function useProfile() {
  const { session } = useAuth();
  const ensure = useServerFn(ensureProfile);
  return useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      if (!session) return null;
      let { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (!data) {
        await ensure();
        ({ data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle());
      }
      if (!data) return null;
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
      const { data: team } = await supabase.from("admin_members").select("sections, can_edit").eq("user_id", session.user.id).maybeSingle();
      return { ...(data as Profile), is_owner: Boolean(roles?.some(r => r.role === 'owner')), is_admin: Boolean(roles?.some((r) => r.role === "admin" || r.role === 'owner')), team: team ?? null };
    },
  });
}

export function useRefreshProfile() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["profile"] });
}

export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.assign("/");
}
