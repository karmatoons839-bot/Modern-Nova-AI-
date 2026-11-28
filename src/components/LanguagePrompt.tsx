import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useRefreshProfile } from "@/lib/auth";
import { LANG_OPTIONS, langFromDb, useI18n, type UiLang } from "@/lib/i18n";

/** Asked once, right after the first login. Changeable later in Settings. */
export function LanguagePrompt() {
  const { data: profile } = useProfile();
  const { setLang } = useI18n();
  const refresh = useRefreshProfile();
  const [saving, setSaving] = useState(false);

  // Apply the saved preference on every login.
  useEffect(() => {
    const l = langFromDb(profile?.language);
    if (l) setLang(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  if (!profile || profile.language) return null;

  const choose = async (id: UiLang) => {
    setSaving(true);
    const db = LANG_OPTIONS.find((o) => o.id === id)!.db;
    await supabase.from("profiles").update({ language: db }).eq("id", profile.id);
    setLang(id);
    await refresh();
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-xl">
        <h2 className="font-display text-xl font-bold text-foreground">Choose your language</h2>
        <p className="mt-1 text-sm text-muted-foreground">आप वेबसाइट किस भाषा में देखना चाहते हैं? You can change this later in Settings.</p>
        <div className="mt-5 space-y-2">
          {LANG_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={saving}
              onClick={() => void choose(o.id)}
              className="w-full rounded-2xl border border-border px-4 py-3 text-left transition hover:border-primary hover:bg-accent disabled:opacity-60"
            >
              <span className="block text-sm font-bold text-foreground">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
