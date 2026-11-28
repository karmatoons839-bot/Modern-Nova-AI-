# src/lib rules

- Full-discount website coupons use service-only `redeem_free_promo`, locking coupon then account before existing payment activation; enforce finite redemption caps and once-per-account success, granting normal selected-plan credits without bonus. Persist plan restrictions on coupons and check both server checkout and payment-write triggers so direct or stale requests cannot bypass eligibility.

- Website speech and automatic casting share server-verified `userVoicePlan`: owner admins get full voice access independently of stored plan, while ordinary/team users retain plan restrictions; billing stays unchanged.

- Maintenance uses one persisted flag, audited owner-role-only changes, and pre-generation checks plus transactional debit guards; all callers preserve actual engine errors and refund semantics.

- Telegram configuration is owner-role-only; shared validation lives in `telegram-config.ts`, authenticated wrappers in `telegram.functions.ts` and provider calls in `telegram.server.ts`, keeping credentials and privileged access off the browser.
- Telegram IDs are persisted as validated decimal strings and configuration saves atomically audit and disable processing, so changing identity or groups never silently retains an active bot.
- Telegram webhook processing stays in `telegram-bot.server.ts`; one-time hashed website links prove identity, and confirmed financial mutations run atomically with audit and replay protection in the database to prevent partial or duplicate grants.
- Telegram retries acknowledge persisted failed updates without replay, retaining owner-review records so ambiguous work cannot block later incoming messages.
- Telegram recovery and outbound sends use separate server-only modules with linked-user/path revalidation and durable receipts; ambiguous sends require review rather than automatic replay to prevent private-data leakage and duplicate delivery.
- Script to Video lives in `s2v.server.ts` (plan with script+background → per-scene keyframe from character+background references → image-to-video), with state in `s2v_projects`/`s2v_scenes` advanced by status polls and the `/api/public/s2v-tick` schedule; analysis is a free draft, then one confirmed charge via `s2vBreakdown` (admin-set itemized prices, this tool only) with per-scene Voice Studio voiceover via `generateSpeech`, refunds on cancel/exhausted retries, and scene clips are joined in the browser (`s2v-merge.ts`) because the hosting runtime has no video compositor.
- App emails: see `src/lib/email-templates/AGENTS.md`.
- Voice Studio translates analyzed lines (free `translateLines`) into the chosen voiceover language and passes `language` to `/api/speech`, so audio never mixes languages.
- Owner-managed tool API overrides live in `api_providers` (AES-GCM keys, owner-only server fns); `resolveProvider` picks tool API → All-in-One → built-in gateway, so the browser never sees keys.
- SFX Maker: ElevenLabs only in `sfx-engine.server.ts` via `/api/sfx` (spend/finish refund); edits, timeline and MP3/WAV export run on real PCM in-browser (`sfx.ts`), never stock audio.
- Music Studio library/uploads are browser IndexedDB; `/api/music` refuses before charging when no provider is configured.
