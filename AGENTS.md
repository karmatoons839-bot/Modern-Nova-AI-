<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules — Modern Nova AI

- Group slot allowances reuse daily claims to prevent duplicate scheduled sends.

- Voice catalog lives at `src/data/voices.json` (the uploaded Zorvexa 400 records, untouched); the ZIP's original API script is kept for reference in `src/data/zorvexa-original/`. Never re-create a project-root `api/` folder — it shadows the `/api/*` TanStack server routes.
- `GET /api/voice-library` must keep the ZIP's query contract and response/error shapes (`VOICE_NOT_FOUND`, `AGE_MUST_BE_BETWEEN_6_AND_80`, pagination fields). Extra filters may only be additive, so existing callers keep working.
- voiceId → real engine voice mapping lives only in `src/lib/voice-engine.server.ts`; keeping it server-side stops the browser from choosing or faking engine voices.
- All audio comes from `POST /api/speech` hitting the Lovable AI Gateway TTS model with the profile's age/gender/style/tone plus the line's locked emotion. Never add sample, cached or synthesized-placeholder audio: failures must surface the engine's real status and message.
- Story analysis (`analyzeStory`) and emotion tagging (`addEmotions`) are server functions in `src/lib/story.functions.ts`; one emotion per line, chosen from `EMOTIONS`, is passed verbatim into generation so a line cannot blend emotions. When the engine renders no audio for an intense emotion on one specific line, `/api/speech` retries that line once with neutral `Calm` delivery under the same single charge; if that also fails it surfaces the real engine error and refunds.
- Long-story limits/partitioning live in `story-processing.ts`; `story-workflow.ts` requests sequential bounded server sections with real completion progress. AI labels immutable source units rather than rewriting dialogue, and complete results commit only after success, preventing missing text and partial-story navigation without new website debits.
- UI theme lives in later `:root` tokens; `--font-display` Space Grotesk and DM Sans body; use semantic tokens only, and keep the EN/Hinglish strings in `src/lib/i18n.tsx`.
- `/` is a tool-free landing page with one EXPLORE TOOL button → `/tools` → `/story`, `/studio`, `/script-video`, `/sfx`, `/music`; tools only behind that button.
- `/story` hosts Script Studio without a duplicate route; `/api/story` preserves legacy fields and adds a description and shared language allowlist from `script-config.ts`, routing validated types to independent uploaded-spec engines so existing callers and credits remain compatible.
- Credits are enforced only in `src/lib/credits.server.ts` (verify bearer → `spend_credits` → engine → `finish_generation` refund); the browser never changes balance, so it can't be faked.
- Plan prices/credits live only in `src/lib/plans.ts` and tool rates in `COSTS`/`videoCost`; payments copy plan credits server-side, so UI and charges cannot drift. Voice previews (`preview:true`, ≤200 chars) skip billing.
- Plan tiers/voice access live in `src/lib/plans.ts` (`voiceAllowed`), checked server-side in `/api/speech`.
- Payments: Razorpay if keys set, else direct UPI (server-built upi:// link + UTR, admin approves); plan/credits change only in DB `activate_payment` (idempotent), so nothing client-side can fake success.
- Developer API: `/developer` page + public `POST /api/public/v1/$service/generate` (Bearer `mnva_live_` key, SHA-256 hash stored only) in `src/lib/devapi.server.ts`; API credits live in a separate `api_wallets` table changed only by `api_spend`/`api_finish`/`api_grant_free`/`api_approve_order`, so website credits and API credits never mix.
- Team admins live in `admin_members` (sections, can_edit), checked server-side via DB `admin_can()`; deprecated unlimited flags are forced false and all website/API debit paths use finite wallets, preventing role-based billing bypass.
- Editable site text/images live in `site_content` (public read); only the DB admin role publishes via `publishSiteContent`, and fields are whitelisted in `src/lib/site-content.ts` so nothing outside the registry can be written.
- Telegram bot rules live in `src/lib/AGENTS.md`; subdirectories have their own `AGENTS.md` to read before changing files there.
- Telegram group discovery recovers paginated persisted IDs and registers observed memberships atomically; Telegram provides no full bot-membership enumeration API, so unseen groups require a genuine bot-visible update.
- Shared CSS particles ignore clicks and honor reduced motion, keeping decoration lightweight.
- Telegram conversation persistence is scoped by sender plus chat, with delivered-message receipts, bounded retrieval and extractive summary cursors; owner memory corrections/deletions reuse the existing admin audit log so memory never authorizes financial actions.
- Voice Studio uses three separate routes sharing tab state and account-scoped IndexedDB draft/real-audio recovery; completed MP3/WAV exports reuse the authenticated zero-cost `/api/voice-full` history/storage path. Generate only pending or explicitly retried failed lines, never completed lines, and export only a complete ordered story; audio still goes only through `/api/speech`.
- Voice Studio emotions are AI-detected only (no manual emotion UI anywhere); `suggestCast` in `story.functions.ts` lets AI classify character gender/age while `voice-cast.ts` deterministically assigns plan-allowed Hindi voices with distinct engine voices, and the voiceover page generates lines with bounded parallel workers (one auto-retry, blocking credit/plan/maintenance errors stop the batch) before merging one ordered MP3+WAV.
- New Script-to-Video projects use three screens (`/script-video` paste+free analyze, `/script-video-studio/$id/2` settings+quote, `/$id/3` live progress; old step numbers redirect to 3) over the unchanged per-task `studioAction` billing, with a browser driver that queues ready tasks in parallel after one upfront confirmation (`planVideo` in `s2v-timing.ts`); legacy projects remain at `/script-video-legacy`, so evolving the studio never overwrites old media or changes other tool rates.
- Studio task RPCs atomically bind operation keys to the existing wallet; completed assets are reused and unknown provider outcomes require review rather than automatic generation replay, preventing duplicate charges and inference.
- Studio final videos are joined in the browser (`s2v-merge.ts`) and uploaded to a server-signed path; `renderFinish` verifies the stored file before charging render and forwarding to Telegram, so failed joins never cost credits. `services/s2v-renderer` stays an optional, undeployed alternative.
- Studio finalization uses a deterministic ordered-media fingerprint and atomic `s2v_finalize_render` transaction; existing account-owned scene images use zero-cost `s2v_reuse_frame`, preventing replay charges and cross-account reference reuse.

- Studio voice overflow uses independently billed deterministic continuation animation slots tied to current clip/voice IDs; the browser measures coverage and refuses held-frame exports, while finalization fingerprints ordered clip groups to preserve replay safety.
- The maintenance on/off switch renders only inside the owner's Admin Dashboard (`MaintenanceControl`), not as a site-wide banner, so admins browse the site exactly as users see it.
- Referral credits come only from the `payments` success trigger, so browsers can't grant them.

- Retired features (Image/Thumbnail/Video Studio, Hosting, Diwali, bot promotions/posters/AI chat) were removed 2026-11-27; their tables are emptied and marked DEPRECATED, kept only until the live app stops reading them, then droppable.
- The Telegram bot (`telegram-bot.server.ts`) only links website accounts, DMs inviters on genuine member adds, and claims approved rewards via the Claim Reward button; the broadcast cron is a no-op.
