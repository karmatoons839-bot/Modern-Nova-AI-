import { sendTemplateEmail } from "./email-templates/send-email";
import { emailPreferenceAllows, type EmailCategory } from "./email-preferences";
import { SUPPORT_EMAIL } from "./help-faq";

/**
 * Server-only notification sends. Every helper is failure-safe: it logs and
 * returns instead of throwing, so email problems (domain still verifying,
 * rate limits, provider errors) never break payments, generation, or the
 * Telegram bot. Duplicates are prevented by the caller's idempotency key.
 */
export async function notifyUserById(
  userId: string,
  template: "welcome" | "payment-receipt" | "generation-ready",
  templateData: Record<string, unknown>,
  idempotencyKey: string,
  category: EmailCategory,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("email, display_name, notify_email, notify_generation, notify_payment")
      .eq("id", userId)
      .maybeSingle();
    if (!p?.email || !emailPreferenceAllows(p, category)) return;
    await sendTemplateEmail(template, p.email, {
      templateData: { name: p.display_name ?? undefined, ...templateData },
      idempotencyKey,
    });
  } catch (e) {
    console.error(`[email] ${template} for user failed`, e);
  }
}

/** Operational notice to the support inbox when the Telegram bot files a ticket. */
export async function notifySupportTicket(
  data: { ticketId: string; kind: string; linked: boolean; description: string },
  idempotencyKey: string,
): Promise<void> {
  try {
    await sendTemplateEmail("support-ticket", SUPPORT_EMAIL, {
      templateData: { ...data, description: data.description.slice(0, 1000) },
      idempotencyKey,
    });
  } catch (e) {
    console.error(`[email] support-ticket ${data.ticketId} failed`, e);
  }
}
