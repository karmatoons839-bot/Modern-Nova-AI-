# Diwali Dhamaka 2026

## Festive website
- Give the existing homepage, header, pricing cards and offer sections a premium dark navy, gold and warm Diwali treatment, with generated diya artwork, festive lighting and subtle reduced-motion-friendly fireworks.
- Keep the current logo, typography, navigation and every existing tool intact. Preserve mobile readability and speed.
- Apply the festive theme only while the owner-enabled campaign is within its configured dates. Automatically return to the original theme at expiry, without overwriting users’ saved theme preferences.

## Diwali Credit Back
- Return **100% of eligible successfully used website credits**, across **all users and all website tools**.
- Count actual debited credits for generations started within the campaign window and successfully settled by the eligibility cutoff. Exclude failed, already-refunded, zero-cost and Developer API generations; never count the same source debit twice.
- Add an account credit-return view showing eligible usage, pending/available/returned status, claim dates and a claim action. Returned credits appear in the existing wallet and credit transaction history.
- Credit returns are additive grants, not cash refunds or edits to purchased credits. Existing prices, subscriptions, payments and generation charges remain unchanged.
- Calculate the award on the server in one database transaction. Bind each source generation to one return, lock wallet/account records, and return the existing receipt on repeated or concurrent claims.
- Verify how existing generation refunds settle before implementing. Prevent returns and existing failure refunds from awarding the same source charge twice, without introducing negative balances or changing failure-refund promises.

## Owner dashboard
- Add campaign enable/disable, start/end dates, refund opening date and claim deadline, with India-time inputs and clear validation.
- Add eligible-tool rules, refund percentage (default 100%) and an optional per-user maximum (uncapped by default).
- Show user-wise eligible/returned totals, claim receipts and refund history. Audit owner configuration changes; ordinary users can only see their own records.
- **No dates were supplied:** ship the campaign disabled and require valid dates before activation. Show no live offer or claim promise until it is configured.
- Freeze financial rules after eligible usage begins; disablement pauses new eligibility without silently invalidating existing earned claims. Keep theme expiry separate from the later claim window.

## Technical approach
- Use additive campaign, claim and source-allocation records with explicit grants and row-level permissions; no edits to existing payment or API-wallet structures.
- Use authenticated server functions for account claims and owner controls, with server-verified identity/roles and transactional database award calculation.
- Use a shared campaign state and scoped semantic CSS tokens, rather than replacing the normal theme or hardcoding campaign colors in individual tools.

## Verification and release
- Add concrete tests for 100% returns, all website tools/users, campaign/claim boundaries, exclusions, owner permissions, repeat/concurrent claims, failure-refund races, caps and additive wallet arithmetic.
- Exercise owner configuration and a regular user’s eligibility → claim → wallet/history readback; use isolated financial fixtures, not fabricated live account credits or paid generation.
- Check homepage, pricing, account and admin on desktop/mobile, campaign expiry and unchanged tool/login navigation; run existing relevant regressions and inspect current errors.
- Deploy only after these checks pass; report anything requiring real payment, paid generation or external human verification separately.