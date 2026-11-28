# Complete Modern Nova AI Telegram system

## What the bot will do

- Answer Hello in DMs, the configured Help group and the private Admin group. Answer website questions conversationally in Hindi, Hinglish and English, without inventing account or payment facts.
- Help users link their signed-in website account to Telegram, check their own account, balances, plans, payments and generation history privately, create support/recovery tickets, and retrieve existing saved audio/images/thumbnails privately.
- Let the verified owner inspect users, generations, tickets, payments and reports; prepare credit adjustments, account changes, plan changes and payment decisions with exact targets and explicit confirmation.
- Let the owner create a custom offer specifying customer, name, amount, credits, duration and existing voice-access tier. Send its details and the owner's original QR privately. No balance or plan changes occur until verified payment approval.
- Deliver durable operational notifications and consent-based announcements, with delivery status, reviewable failures and an audit trail.
- Offer a complete owner dashboard for configuration, activation, notifications, offers, tickets, queued actions and health—not just the two example flows.

## Account privacy and real file recovery

- An email supplied in Telegram is a lookup hint, never proof of ownership. Users must open a one-time link from their signed-in website account.
- Group account/file questions receive a private-chat handoff, never account details or generated files.
- The linked user can select their stored generation by date/tool/ID. Before delivering, recheck the current link, generation owner, completed status and storage path.
- Deliver only files actually present in storage. Missing/deleted output creates a recovery ticket; do not fabricate files, regenerate silently, or charge for retrieving existing output.
- Keep delivery receipts separate from incoming completion records so ignored messages cannot be mistaken for successful replies.

## Custom offers and payments

- Reuse the existing payments and credit ledger. Persist immutable offer details tied to one account and order.
- Keep existing standard plans/prices unchanged. A custom offer's access tier is explicit rather than an invented new voice entitlement.
- QR/UTR submission is not proof of payment. Manual UPI requires owner confirmation of actual bank receipt, and approval runs atomically with audit and duplicate-grant prevention.
- Show pending, paid, expired, cancelled and rejected states accurately. Never imply automatic renewal or provider refunds when unavailable.
- **Dependency:** the original supplied QR was not found in the current assets/uploads. Obtain that same QR again before enabling QR sending; never substitute a fabricated QR or payment destination.

## Commands, natural language and safeguards

- Map conversational requests only to an explicit supported action list. For ambiguous targets, amounts, durations or reasons, ask for missing details instead of guessing.
- All financial/account-changing operations require owner-ID authorization, allowlisted context, a current website admin role and an expiring confirmation showing the exact effects.
- Public support stays available regardless of administrative activation. Ordinary greetings never grant admin access.
- Add clear capability responses for unavailable external operations, especially automated bank verification, provider refunds, missing storage and live traffic data.
- Account notifications require user preferences; broadcasts require recipient consent, preview and confirmation.
- Preserve request limits, replay protection, revocation and durable state across restarts. Ambiguous sends/actions require reconciliation, not blind retries.

## Delivery and acceptance

1. Finish and test greetings, signed-in linking, private lookup and real-file retrieval.
2. Add custom offers, original QR delivery and verified activation against existing payment rules.
3. Finish owner workflows, bounded conversational routing, notifications, announcements and delivery processing.
4. Verify authorization, cross-account/group privacy, duplicate/concurrent decisions, refunds on existing generation failures, revocation, failed delivery and restart recovery.
5. Test the website dashboard as owner and normal user; record actual Telegram incoming messages and outgoing receipts. Real human conversation/readback and actual bank/provider evidence remain distinct checks.
6. Update the English acceptance report with implemented/unimplemented features, executed tests, dependencies, deployment status, costs and rollback. Keep sensitive processing disabled until commissioning passes and the owner explicitly activates it.
7. Publish only when explicitly requested; preview changes alone do not repair the production Telegram endpoint.

## Technical approach

- Reuse the existing TanStack webhook, server functions, owner verification, account-link RPCs, confirmation transactions, payments, storage, credit ledger and Telegram connector.
- Extend application tables through additive migrations with explicit grants/RLS. No parallel financial wallet, unrestricted SQL execution, credentials in the browser, or new polling host.
- Put recovery, offer handling and durable delivery in focused server-only modules; use authenticated wrappers for website controls and narrow validated public handlers for Telegram/scheduled delivery.
- Cover each permission/payment/identity rule with focused tests and exercise real existing flows before claiming acceptance.