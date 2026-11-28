# src/lib/email-templates rules

- App emails use Lovable managed sending: React Email templates in `email-templates/` (registry + `send-email` helper) behind the failure-safe, idempotency-keyed `email-notify.server.ts`; sends honor the profile `notify_email`/`notify_generation`/`notify_payment` preferences and must stay fire-and-forget so provider errors or an unverified domain never break payments, generation, or Telegram flows. No email queues, tables, cron, or unsubscribe UI — Lovable hosts delivery, suppression, and unsubscribe.
