export type EmailCategory = "account" | "generation" | "payment";

export interface EmailPreferences {
  notify_email?: boolean | null;
  notify_generation?: boolean | null;
  notify_payment?: boolean | null;
}

/**
 * User email preferences stored on profiles. Everything defaults ON (the
 * Settings toggles display `?? true`); only an explicit false blocks a
 * category. The master `notify_email` switch blocks every app email.
 */
export function emailPreferenceAllows(prefs: EmailPreferences, category: EmailCategory): boolean {
  if (prefs.notify_email === false) return false;
  if (category === "generation" && prefs.notify_generation === false) return false;
  if (category === "payment" && prefs.notify_payment === false) return false;
  return true;
}
