# Modern Nova Telegram Super Admin Bot

## Inspection results
- The existing site uses TanStack Start, Lovable Cloud authentication/database/private storage, and server-side AI generation. The project repository is available locally; a separate GitHub repository was not established.
- Live records: **50 accounts, 14 payments, 1,418 generations, 3 support messages and 1,478 admin notifications**.
- Payments currently use **manual UPI**. UPI configuration is present; Razorpay keys are absent. Four payment records have successful status. Manual UPI still requires the owner to verify receipt of funds; the bot cannot independently verify a bank transfer without a payment-provider integration.
- Existing database procedures enforce spending, failed-generation refunds, payment activation and plan expiry. Reuse these rules; keep website credits and developer API credits separate.
- Existing admin actions cover account lookup, credits, plans, suspension, payment review, audit and generation inspection. Extract shared server-only operations rather than invoke website server-function RPCs from Telegram.
- Output references exist for most image/audio records, but **42 completed image/voice records lack references**. Storage references are not proof that files still exist. Twelve generation records are pending. These need inspection, not automatic refund or regeneration. Story records have no file references.
- No Telegram connection is available. There is no persistent bot workflow, account-linking or recovery-ticket system yet. Razorpay refunds and video jobs are not currently available.

## Stage 1 — Configuration and health
- Add an owner-only Telegram settings page linked from the existing admin page, matching its white theme.
- Configure the bot credential through Lovable's secure Telegram connection card, not an ordinary website token input. Show **Configured / Not configured**, never token fragments. Provide a secure connection-update path.
- Collect the owner numeric Telegram ID and separate private admin/support group IDs. Save server-validated configuration with an audit entry; saving does not enable the bot.
- Validate Telegram identity, both groups, bot permissions, database access and configured payment mode. Verify the owner ID through an owner-authorized private bot interaction rather than claiming an arbitrary numeric ID has been validated.
- Show actual webhook registration, last checks/errors, delivery queue and required setup. A webhook has no continuously running process; show deployment and recent successful processing rather than invented uptime.

## Stage 2 — Secure Telegram processing and notifications
- Use a published HTTPS webhook in the existing app, verified with a server-side secret and exact sender/chat authorization.
- Add additive migrations for configuration, received updates, confirmations, delivery outbox, support/recovery tickets and verified account links. Explicit grants and restrictive access policies apply to every table.
- Persist update IDs, processing state, retries and callback confirmation state across restarts. Financial changes and their idempotency records must commit atomically; claiming an update alone is insufficient protection.
- Add the custom database-backed request limits you approved. Bound input size, expiry, attempts and outbound retries; handle Telegram retry delays safely.
- Forward relevant existing operational events with minimal personal data. Use event-driven delivery, with pending-only retry scheduling rather than continuous preview polling.
- Do not enable processing until configuration checks succeed. Verify the deployed endpoint before registering the webhook. Production activation is a separate verified step.

## Stage 3 — Administrative actions
- Implement user/payment/generation/ticket lookup, actual reports and error inspection first.
- Add credit adjustments, suspension changes and payment reviews using shared authoritative operations. Every sensitive action previews target, amount, reason and reference; confirmation is single-use and audited.
- Re-read trusted payment records. Manual UPI approval explicitly requires owner confirmation that funds arrived; never accept a screenshot as proof. Paid plan activation continues through the existing idempotent payment procedure.
- Add refund review tickets; provider refund execution remains unavailable unless a supported provider is connected and tested.
- Per-user tool restrictions require a small server-enforced extension across applicable website and developer API paths; document their scope explicitly.
- Display only buttons whose corresponding backend actions are implemented and tested.

## Stage 4 — Support and recovery
- Group commands, mentions and replies answer verified FAQs in English/Hindi/Hinglish; unrelated messages are ignored. Other languages are offered only with a reliable configured translator.
- Create persistent tickets without asking users to post email, payment details or generated content publicly. Move account-specific investigation into private chat.
- Link Telegram identity to a signed-in website account using an expiring, single-use confirmation. Numeric Telegram identity alone does not establish website account ownership.
- Inspect generation ownership, status, error, ledger and actual private-storage existence. Deliver recoverable files only to the verified user privately, record Telegram delivery acknowledgement and keep refunds separate.
- Clearly report missing output or unavailable logs. Telegram API acceptance confirms delivery to Telegram, not that the user read the file.

## Stage 5 — Assistant, announcements and reports
- Use the existing server-side Lovable AI service for bounded intent interpretation. Validate the output against a fixed action allowlist; all sensitive actions still require confirmation. Offer clearly labeled commands/FAQs when AI is unavailable.
- Preview announcements and require confirmation. Send only to approved groups or opted-in users who initiated contact, respecting applicable preferences.
- Build daily/weekly/monthly reports from actual payment, ledger, generation and ticket records. Label missing traffic or revenue data rather than infer it.

## Verification and protection
- No destructive migration or balance reset. Establish the available backup/restore capability before any destructive work; do not claim a backup exists without checking it.
- Add focused tests for exact-ID authorization, chat allowlists, replay/expiry, limits, ownership, idempotent credit changes and verified payment activation. Run integration tests only where credentials and explicit test targets permit.
- Test every implemented button, private/public separation, outbox recovery and deployed webhook. Do not make real financial or bulk announcement test changes without an approved target.
- Deliver an English report covering working/pending features, executed tests, actual architecture, secure setup, group permissions/privacy mode, webhook registration, hosting/AI costs and rollback.

## Owner input required when integration begins
- Connect the Telegram bot using its BotFather token in the secure connection card.
- Supply the numeric owner Telegram user ID and both group chat IDs through the owner-only setup page.
- Add the bot to both groups, initiate a private conversation and grant only the permissions required by the selected behavior.
- Production webhook activation requires a published reachable endpoint. This work does not promise ranking, revenue, provider refunds or uninterrupted operation without verification.

## Technical boundaries
- Shared operations live in server-only helpers; website wrappers retain existing authentication. Bot authorization maps to a persisted, website-owner-verified identity, never an arbitrary account supplied by the webhook.
- External Telegram calls use the linked connection's verified gateway mode and server credentials. Never include bot tokens in URLs, logs or browser state.
- Runtime is the existing stateless hosted app, with durable state in Lovable Cloud. No local bot daemon or long polling dependent on the preview.
- Rollback disables webhook/dispatch and removes navigation first; additive bot tables remain for audit retention. Existing financial records and authentication are not rolled back or deleted.