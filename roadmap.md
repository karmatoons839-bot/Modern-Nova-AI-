# Modern Nova AI roadmap

## Chat-only source ZIP delivery (2026-11-26)
- [x] Record Google AI Studio using the already supplied key as the chosen independent AI provider; existing integrations remain unchanged.
- [ ] Configure the owner's SMTP for independent-hosting email (blocked: server address, port, security mode, sender and credentials not yet supplied).
- [x] Remove the source ZIP button from the Admin APIs view without changing configured APIs.
- [x] Inventory existing credentials and document missing independent-hosting dependencies without exposing keys.
- [x] Package and inspect the revised source ZIP for delivery in chat; archive integrity and private-file exclusions pass, signed-in Admin APIs view has no source ZIP button, automatic build OK.
- [ ] Independent hosting integration waits for provider choices and externally provisioned credentials; no existing APIs changed.

## Workspace move reconnection (2026-11-25)
- [x] Google Search Console linked in the new workspace; `https://modernnova.in/` reads back as siteOwner and the search snapshot returns real data (homepage "Submitted and indexed", 61 clicks / 257 impressions for 2026-10-26..2026-11-22).
- [x] Telegram linked in the new workspace; `getMe` confirms @ModernNova_bot and `getWebhookInfo` shows the webhook at `https://modernnova.in/api/public/telegram/webhook` with no error and 0 pending updates.
- [x] Published so the live site carries the new Telegram key: the live webhook moved from rejecting it (401) to accepting it (auth passes, empty body rejected as "Invalid update"), matching the preview.
- [ ] Owner to send `/help` to @ModernNova_bot for a visible reply check; group promotion delivery through the new connection is not yet exercised.

## Three daily group messages (2026-11-16)
- [x] Restrict group -1004312591199 to three existing promotion slots at 09:00, 14:00 and 20:00 IST, skipping its scheduled greetings; retain other groups, consent switches and daily duplicate claims.
- [x] All 14 broadcast tests pass and automatic build OK; active scheduler and target group read back, extra greetings disabled.
- [ ] Publish the three-slot exception (blocked: publication authorization); until published the live group still follows the existing promotion slots.
- [ ] Verify delivery: current connected @ModernNova_bot getMe succeeds and target getChat succeeds, but getChatMember returns 400 PARTICIPANT_ID_INVALID; current bot membership is not verified despite the persisted member flag. Owner must add the current bot if absent.

## CloudPanel hosting connector (2026-11-16)
- [x] Owner chose CloudPanel on Hostinger KVM 1. Connector delivered in /mnt/documents/modernnova-hosting-connector (server.js, install.sh, README.md) implementing the dashboard's /v1/metrics, /v1/inventory and /v1/actions contract with bearer-token auth, HTTPS-only public hostname, one-time expiring download links and PATH-resolved tools.
- [x] Exercised against a real sqlite3 CloudPanel-shaped database with a recording clpctl stand-in: metrics, inventory, site create and delete (files backed up before delete), database create, SSL refusal when DNS does not resolve, DNS verify, file write/list/read/copy/zip/extract/delete/upload, backup plus one-time download (200 then 404), path escape 400, wrong token 401, unsupported actions 501 with the real reason. 11 hosting tests pass; automatic build OK.
- [x] Dashboard now reports the hosting service's own reason for a refused action instead of a bare status code.
- [ ] Purchase the VPS, run the installer, then paste the URL and token in Admin → Hosting → Connection and press Verify & Synchronize (blocked: the owner must buy the Hostinger VPS and pick the subdomain).

## Failed voiceover recovery (2026-11-16)
- [x] Diagnose 609 refusals on the metadata heading “नैरेटर”; stop automatic refusal retries/fallbacks and recognize repeated screenplay speaker headings without altering dialogue. Completed audio and billing preserved; 28 regression tests pass, automatic build OK.
- [x] Recover all spoken source text from 434 ordered existing clips; complete 28m05.6s MP3 saved at zero cost to owner History, generation 5e6a649d-9e50-49c5-a441-561a568a39f2. No new synthesis or partial export.
- [ ] Deliver only to verified owner DM (blocked: Telegram URL fetch rejected 400; direct multipart upload returned ambiguous gateway 502, so no automatic replay or delivery claim).
- [ ] Verify refused-draft screen end-to-end and published repair (unit tests and authenticated export readback passed; browser History remained loading in sampled capture, no publication performed).

## Ad and Telegram member rewards (2026-11-15)
- [ ] Add verified-only ad rewards, generation advertising, active-paid-plan ad exemption and Admin/Owner controls (blocked: approved publisher account, real ad units and documented web completion verification configuration).
- [x] Add support-group first-observed invitation tracking, permanent member deduplication, verified-account bulk claims, private /rewards and /claimrewards, pending genuine-member review and Admin/Owner settings. Existing members cannot be fully enumerated; no auto-grants on unseen joins.
- [x] Preserve finite website wallet, ledger and API separation; atomic reviewed claims, audit history, paginated reward list and daily/monthly actual-record statistics; revenue unavailable, both systems off.
- [x] 13 reward tests + 13 Telegram regressions pass; isolated serialized database claims grant one 1,000-credit reward across ten queued calls. Owner settings save/reload and credits panel verified desktop/mobile; balance unchanged at 499142. Admin bot membership and chat_member webhook subscription verified.
- [ ] Verify real Telegram invitation → approval → linked claim → bot confirmation on deployed code (blocked: publication and genuine new member/account-link event); real independent database concurrency not tested. Ads cannot be tested/served until approved publisher account exists.

## Website, voice and Telegram repair (2026-11-15)
- [x] Reported sidebarOpen symbol absent across src; utils.ts contains only cn; latest automatic build OK.
- [x] Stable per-profile timbre/cadence directions, distinct same-gender auto-cast without cross-gender fallback; untouched 400 profiles backed by 30 real engine timbres. Two English female free previews returned real audio on different engines; audible 400-way uniqueness cannot be promised.
- [x] Account-scoped SHA-256 export uniqueness and permanent atomic Telegram send receipts; ambiguous sends stop for review. 20 concurrent claims yield one send owner; three identical exports yield one account record. Real UI merge, MP3 playback, downloads and repeated save reuse verified; controlled test export remains unapproved and unsent, balance unchanged at 499142.
- [x] Refresh actual Telegram membership in owner UI: 10 eligible groups restored from stale can_send=false; 15 promotion slots and 5-minute schedule enabled. Toony City test promotion accepted and recorded; full future-day delivery unverified. Channel bot membership and AI billing pause still block fresh daily material.
- [x] Desktop/mobile home, hosting and complete voiceover checked without overflow; 29 Vitest + 13 Bun tests pass (plus six node:test casting cases); latest automatic build OK. Publication requested; live release independently verify after deployment.
- [ ] Connect real hosting and deploy a website through the private hosting panel (blocked until external infrastructure is supplied).

## Modern Nova Hosting (2026-11-15)
- [x] Uploaded update: last private Tools entry, ADMIN/OWNER hosting access, distinct OWNER assigned to existing account, finite website/API wallets and encrypted owner-only server configuration; domain sales absent.
- [x] Verify owner navigation/plan create-delete/readback on desktop/mobile; ordinary access denied, unsigned direct access redirects; real owner 7-credit debit/refund preserves 499142 balance, overspend denied, API finite rules tested; disconnected DNS/SSL/file/publish all reject without fake success. Automatic build OK.
- [x] Inspect reported handleClose error: named src/pages/NotFound.tsx absent; actual not-found page requires no props. Latest automatic build OK; original offending source still needed for that specific report.
- [x] Add separate owner-only hosting sections, persisted inventory/plans, protected actions and external provisioning contract; no changes to existing financial systems. Owner-only database policies read back; six hosting tests pass.
- [x] Verify real signed-in ordinary-account Access Denied on desktop/mobile, no overflow or page errors; missing infrastructure throws NOT CONNECTED, unavailable metrics stay null. Latest automatic build OK.
- [x] Verify owner-side plan CRUD and hosting navigation using requesting user's own authenticated account after requested OWNER assignment; test plans removed.
- [ ] Connect and verify real provisioning, deployment, databases, DNS, backups and metrics (blocked: no hosting infrastructure connection supplied).

## Integrations after second workspace move (2026-11-12)
- [x] Link Google Search Console and Telegram in the new workspace; Search Console lists https://modernnova.in/ as siteOwner and Telegram getMe returns @ModernNova_bot.
- [x] Identify live receiver origins: https://modernnova.in serves the current webhook route; https://modernnovaai-2.lovable.app 302s to it; https://novahosting-2.lovable.app is a different app (NOVA HOST).
- [x] Publish requested so the live server loads the newly linked Telegram credential (live POST still 401 with the new secret before publishing).
- [ ] After deployment, confirm https://modernnova.in/api/public/telegram/webhook accepts the new secret (invalid body must change 401 to 400), then re-register setWebhook to that URL with the new secret token and drop_pending_updates=false; verify with getWebhookInfo (Telegram currently points at the NOVA HOST app).

## Future complete-voiceover Telegram delivery
- [x] Exclude individual speech lines from live scheduled claims and preview direct forwarding; complete voice_full exports and controlled-account approval gates retained. Live function readback confirms voice exclusion.
- [x] Reproduce dialogue-slot bug before fix; 9 claim/delivery tests and 4 approval regressions pass after fix; automatic build OK. No paid generation or media sent.
- [ ] Verify new complete-export Telegram receipt and publish direct-forward guard (requires actual new completed export and publication approval; live scheduled exclusion already applied).

## Email updates setup (2026-11-09)
- [x] Scaffold managed email templates + send helper for notify.modernnova.in; packages, server env loading, entities alias and /lovable/ middleware bypass in place; preview route verified locally (200 with key, 401 without)
- [x] Templates: welcome, payment receipt, generation-ready, support-ticket; preference-aware helper (notify_email/notify_generation/notify_payment), idempotency keys, failure-safe logging; 8 new tests pass, typecheck + build OK, 194 total tests pass
- [x] Wire triggers: signup (ensureProfile), UPI approval, Razorpay settle, free coupon, voice-full export, S2V render finish, Telegram support ticket
- [ ] Publish after owner approval so triggers are live; emails start only after DNS verification completes (records in More → Emails, up to 72h); real send not yet tested (domain still verifying); warmup 2–4 weeks at low volume

## November 8 video and Last Wish delivery
- [x] Prepare guide video for fifteen daily eligible-group slots through November 10 00:00 IST; 37 focused tests pass, build OK, real video HTTP 206. Sent now to 11 eligible groups with accepted receipts; admin/support excluded.
- [x] Owner approved publication; requested deployment after fresh security scan (no actionable critical findings). Live home HTTP 200, newest theme cutoff not independently found in sampled scripts; next automatic video receipt not yet verified.
- [x] Owner approved only missing line regeneration: 27 credits, successful real WAV. Matched all dialogue to 556 ordered stored clips with no missing text, joined full 36m43.72s MP3 (35,260,845 bytes), saved zero-cost History export 2c08a8f9-9e18-4dbe-81e7-6dff50895119 and sent only it to configured admin group (Telegram receipt 3245, 2204s). Other controlled-account approval gates retained.
- [x] Existing three parallel line workers cannot guarantee sixty-times-real-time generation; engine and billing unchanged.

## Diwali visual extension
- [x] Keep matching festive colors/artwork until November 10 00:00 IST independently of earning/claim dates; 20 tests pass, six public pages verified at desktop/mobile widths, automatic restoration without refresh verified, build OK.
- [x] Owner approved and publication requested November 8; deployment completion/latest cutoff not independently confirmed.

## Telegram repair after workspace move (2026-11-07)
- [x] Diagnose fresh-key deployment mismatch: current app accepts new webhook credential (400 for invalid body), while published and stable-preview receivers reject it (401); fresh production update failed on sendMessage 403. Support-group bot administrator membership verified; 26 existing reply/identity/retry tests pass with Bun. No messages replayed or credits changed.
- [x] With owner publication approval, published receiver now accepts the new credential (same invalid-body check changes 401→400); registered the matching webhook successfully (Telegram 200/ok) with drop_pending_updates=false. Support permissions and 47 focused tests pass; no financial or delivery replay.
- [ ] Verify a new genuine Telegram message completes and its reply is accepted (requires user to send /help or Hello; historical failed delivery remains for review, not replay).

## Limited Diwali coupon
- [x] Restrict DIWALI999 to the ₹499 Standard plan in checkout and transactional payment writes; five isolated tests pass, signed-in Basic/Premium checks reject and existing-used-account Standard check rejects repeat redemption. Existing uses remain 2/5; no real slots or credits consumed. Build OK; latest checkout copy not published.
- [x] Configure DIWALI999 for 100% off, five unique accounts, atomic once-per-account redemption through existing payment activation; three isolated safety tests pass and signed-in checkout shows ₹0 with normal plan credits. Real slots remain 0/5 used. Publication and real redemption not performed.

## Voice access and professional Diwali presentation
- [x] Correct owner catalog access through database-verified role, shared by speech and auto-cast; ordinary/team plan limits and billing unchanged. Three access tests plus 34 existing regressions pass; real signed-in ordinary locked request returns 403, allowed free preview returns 200 WAV (201,644 bytes). Build OK.
- [x] Replace dialogue text list with concise character completion counts, real error summary, failed-parts retry and voice-review action; script/audio recovery unchanged. Signed-in mobile failure flow verified with no dialogue text or overflow.
- [x] Six customized navy/gold Diwali tool images on Home/Tools; desktop/mobile rendering and automatic color/artwork restoration at Nov 8 midnight IST without refresh verified.
- [ ] Verify owner-account full-story generation after deployment (requires owner browser session/approval; only free ordinary-account preview and access regression tests performed, no paid generation or publication).

## Daily Telegram group promotions
- [x] Prepare campaign-verified Diwali captions/posters for all fifteen existing 08:00–22:00 IST daily slots, restoring normal messages at expiry; ten broadcast tests pass and live Diwali poster returns 200 image/jpeg. Active 5-minute scheduler and fifteen slots read back; today's normal promotions have 43 accepted receipts, not Diwali-version proof.
- [ ] Publish Diwali promotion selection and verify scheduled Diwali receipt (requires publication authorization; full-day delivery and human viewing unverified).
- [x] Configure and read back 15 enabled daily group promotions at 08:00–22:00 IST hourly; attach matching existing posters, keep opt-outs/protected groups and unique daily claims. 27 related tests pass, build OK, six poster URLs return real images. Publication requested November 6.
- [ ] Verify first automatic poster-backed group delivery after latest publication (awaits next scheduled slot and deployment; complete-day delivery and human viewing not yet verified).

## Diwali Dhamaka 2026
- [x] Remove visible logo background across header/loading/maintenance; verified 8 pages share festive colors, 167 tests pass and automatic restoration without refresh. Publication requested November 6; first live check still served old logo (completion unconfirmed).
- [x] Post Diwali poster and claim dates to 9 eligible community groups: Telegram accepted messages 16631,100577,4460,4259,6700,95752,7686,10422,11120. Protected admin/support and unreachable group excluded; human readback unavailable. Captions explicitly say transparent-logo deployment verification pending.
- [x] Add temporary date-aware festive homepage/header/pricing theme with original-theme restoration.
- [x] Add owner campaign/date/rule controls and audited user-wise refund reporting; paginated reads prevent truncated long histories.
- [x] Add atomic 100% eligible website-credit claims, wallet/history visibility and duplicate/refund protections; source settlement uses profile-first locks and wallet caps are validated server-side.
- [x] Verify 166 regression tests, build OK, real owner save/reload, regular-account denial, desktop/mobile festive fixtures and original-theme restoration; test balance unchanged at 25,032. Claim/refund cases use isolated PGlite (serialized), not independent PostgreSQL sessions.
- [x] Configure 100% campaign beginning November 6 13:00 IST through November 8 00:00 IST; owner-supplied claims November 8 00:00 through November 9 00:00 IST. Owner UI saved/read back enabled configuration; no test debits or claims made.
- [ ] Confirm latest transparent-logo release live (publication requested; initial live check still served previous asset).

## Telegram readiness after workspace move (2026-11-06)
- [x] Verify new website connection, active broadcast schedule, 50+50 daily targets, channel queue receipts and requested group promotion settings; restore webhook security without dropping queued messages.
- [x] Repair failed-update acknowledgement in preview; 32 focused tests passed and build OK. Previously failed work remains recorded without replay.
- [ ] Publish recovery fix and verify incoming messages drain (requires explicit publication approval; live queue still blocked by old failed update).
- [ ] Complete owner verification and activation (requires the owner's genuine Telegram verification from the website setup page).

## Telegram channel poster + analysis speed (2026-11-06)
- [x] Owner-only Channel Poster admin tab: share channel/support/website links to all active groups (dedup per day), generate & post fresh unique AI PNG/background material with live progress, daily auto-post targets (default 50+50) via 5-minute cron queue with 402/403 pause + resume.
- [x] Faster analysis: emotion batches now run 3 in parallel (all-or-nothing kept), live per-line detail in Voice Studio progress, clearer Script-to-Video analyze text; s2v tick parallelism 12→16.
- [x] Verify live as owner 2026-11-06: Channel Poster tab live on modernnova.in; links (channel t.me/MODERNNOVA, support t.me/modernnovaai, website) sent to all 9 active groups (log receipts "sent"); 2 manual PNGs posted to channel (message_id 134/135) and the 5-minute cron itself queued today's full 50 PNG + 50 background targets and posted message_id 136 on its own. Unique combo pool: 5,400 PNG + 2,160 backgrounds. 147+6 tests pass, build OK, published and live-verified. Group-side readback not possible via bot API (send receipts only).

## Voice Studio complete update (2026-11-06)
- [x] Remove all manual emotion controls (script toggle, per-line dropdowns, casting emotion filter); emotions always AI-detected per line and passed verbatim to generation.
- [x] Automatic character voice casting: AI classifies gender/age, deterministic picker assigns plan-allowed distinct Hindi voices (voice-cast.ts + suggestCast), one Select Character Voice control per card, user override kept, 6 picker tests pass.
- [x] Voiceover page: bounded parallel generation (3 workers, one auto-retry, blocking credit/plan/maintenance errors stop batch), live percent/counts/current-dialogue progress, no per-line play/download, single ordered MP3+WAV export with duration and History save.
- [x] Verify signed-in preview end-to-end 2026-11-06: tagged Hindi script → free analysis → AI auto-cast filled → parallel generation (3 workers) → 6/6 lines → merged 23.7s voiceover, one player, real MP3 (379KB) + WAV downloads, playback advances, Saved to History. Fixed empty block-separator lines that 400'd (spokenUnits filter, lossless storyUnits kept), added 120s per-line abort timeout, and a same-charge Calm fallback when the engine renders no audio for an intense emotion (Horror line 502 → succeeded via fallback). suggestCast now surfaces provider denials (401/402/403/429/503) instead of silently falling back. Credits ledger exact: 36 done = 1,362 charged = balance delta 26,394→25,032; 3 failed fully refunded. 140 tests pass, build OK; publish requested.

## Long Script Studio stories (2026-11-06)
- [x] Replace analysis/import/emotion limits with shared 500,000-character envelope, sequential 6,000-character sections, immutable-source speaker labels, live count/progress and lossless full-track history prompt (no new debit).
- [x] Verify 10k/20k/30k/55k tagged Hindi stories and imports in regular signed-in preview; real 57,961-character/55-chapter AI analysis retains exact source; real automatic emotions and network-error retention checked; 21 tests pass, mobile has no overflow, build OK, account credits unchanged 26,394. No paid voice generation or publication performed.

## Maintenance and Meta campaign (2026-11-05)
- [x] Live Script-to-Video route exists; continuation deployment not conclusively verified. Requested publication of latest studio and maintenance release; completion requires later live check.
- [x] Enable persistent non-admin maintenance screen, server/transactional generation blocks and audited owner removal control. 24 tests pass; isolated DB verifies admin removal and ordinary denial; real admin desktop/mobile studio opens, removal cancelled; real regular preview returns 503 before generation. No paid generation performed; existing engine errors/refunds retained with server-issue UI labels.
- [x] Record Meta ads channel switch; campaign waits while website is in maintenance (account/creative setup not completed).
- [x] Script-to-Video live hosting verified 2026-11-05: published latest build to modernnova.in; signed-out visitor gets studio sign-in page, regular signed-in user sees studio home (balance 27,094 unchanged) and project step 11 with continuation feature; no page errors. Maintenance was switched OFF at 13:07 UTC by an admin (audit log), so all visitors can reach the site. Admin-account live view not re-verified (session mint needs owner approval); admin path verified pre-publish. Fresh security scan still recommended before broad sharing.
- [x] Fix selected security finding (public read rule on the maintenance-status table) 2026-11-05: direct public table access removed; on/off flag now served only by a locked-down server-side function; anon direct read returns 401, function returns flag, 5 tests pass; fix published and live home/studio pages verified normal. Finding marked fixed; no other findings touched.

## Creator campaign and logo animation (2026-11-05)
- [x] Save confirmed Google Search choice; account inspection shows no connected Google Ads account.
- [x] Save 5.056-second square logo MP4 beside original; inspect start/middle/end: subtle light sweep and full logo retained, rendered on black rather than transparent background.
- [x] Reconnect integrations after workspace move 2026-11-05: Google Ads linked and "Modern Nova AI" account (INR) re-selected with verified access (billing off); Search Console linked, modernnova.in property still verified owner, sitemap intact (0 errors); Telegram bot @ModernNova_bot linked, webhook re-registered with new secret and live endpoint verified 200/401. Campaign preparation continues on Meta channel.

## Voice-length moving-video release (2026-11-05)
- [x] Replace held-frame extension with separately confirmed, persisted real continuation clips; one atomic paid operation per confirmation, retries and ordered grouped rendering.
- [x] Verify real-account 14.6s/5s mismatch, cancelled 1500-credit quote on desktop/mobile, short-video rejection, free 14.62s moving join, 49 focused tests and 20-request duplicate queue deduplication; no paid generation or delivery.
- [x] Requested publication to https://modernnova.in after 49 tests and desktop/mobile checks; deployment completion not independently confirmed.
- [ ] Verify new AI-generated continuation quality and real Android (blocked: no additional paid-test approval or physical device).

## Controlled Script-to-Video real-world acceptance
- [x] Owner-approved regular-account scene/voice/render completed for exactly 857 (27,951→27,094); title-named MP4 downloaded in mobile-sized browser; approved only that render and sent clip then final to Telegram (376,377); other gates retained
- [x] Pre-publish verification: 92 free regression tests PASS; regular-user mobile check PASS; test balance 27,951 unchanged, 42 unapproved creations blocked; fresh backend security scan has no active critical findings; publishing explicitly requested
- [x] Gate controlled-test-account creation forwarding in live database (immediate claim trigger + scheduled claim filter); owner-only per-generation approval and preview forwarder fail-closed check; 29 tests pass, 42 existing records gated, balance unchanged, no sends/publish
- [x] Reverify free pre-test safeguards: 25 existing tests, real PostgreSQL 20-request render/reuse concurrency, mobile repeated-handler guard, existing image and unchanged 27,951 live balance; no generation/finalize/send/publish
- [x] Save supported Hindi narrator and obtain explicit paid-generation plus delivery approval for prepared test
- [x] Inspect current billing, references, browser joining, storage/download and Telegram delivery without paid generation; 16 existing tests passed; regular-account mobile home opens without page errors or overflow
- [x] Fix render-finalization replay safety and account-owned existing scene-image reuse; 25 tests pass including isolated PostgreSQL duplicate/failure tests; clean preview; no publishing or paid generation
- [x] Prepare regular-account 5-second scene with voice ON and saved scene image reused for zero credits; mobile reload passed; 27,951 balance unchanged; project Nova Safety Test 01 (voice must be chosen before paid run)
- [ ] Verify independent Telegram group receipt/human viewing of test posts 376 and 377 (blocked: group-side readback unavailable; API accepted both files)
- [ ] Verify real Android workflow (blocked: no physical Android device available in sandbox)

## Eleven-page Script-to-Video Studio (2026-11-05)
- [x] Inspect existing studio, wallet, APIs and persisted jobs: single-page upload/catalog workflow, six-scene live cap, browser-only final merge, whole-job refunds; no complete eleven-page flow
- [x] Confirm latest dedicated rates: character 300, image 500, voiceover 500/min; owner has no renderer and requests a project-owned one
- [x] Fix listed server-function serialization, unsupported Responses store field and binary-buffer type errors; automatic preview build OK and 16 pricing tests pass
- [x] Connect eleven project-scoped views, saved draft/editor actions, AI-reference generation actions, style examples, voice previews/settings, itemized estimates, backend task status and real-file clip downloads; preserve legacy project page
- [x] Add dedicated admin image/character/voice rates and build a project-owned authenticated, SQLite-persisted FFmpeg service; three local renderer tests pass including provider-audio stripping when voice is OFF and dialogue overflow rejection
- [ ] Deploy/connect renderer, measured voice billing, automatic whole-pipeline orchestration and final storage/Telegram delivery (blocked: renderer hosting destination and secure deployment configuration unavailable)
- [ ] Verify real admin generation, saves across eleven views, retries/refunds, resumes and final downloads on mobile/desktop (blocked: available requesting-user browser session is not an admin; no paid tests or permission escalation performed)
- [x] Verify signed-in non-admin denial on desktop/mobile without overflow or page errors; latest automatic build OK; all work unpublished; acceptance in S2V_STUDIO_ACCEPTANCE.md

## Telegram missing groups (2026-11-05)
- [x] Add paginated recovery from conversations, deliveries and broadcast history without the 500-row/40-group truncation; register callbacks atomically and refresh the displayed list every 15 seconds (22 tests passed; build OK)
- [x] Verify stored list: 12 groups, 11 active; Telegram confirms @UnlistedGraphics bot kicked and two other historical groups chat-not-found; webhook receives message/callback/my_chat_member updates
- [ ] Verify owner-authorized Refresh and publish changes (available browser account has no Telegram admin access; publication not requested)

## Complete Voice Studio upgrade
- [x] Inspect existing three-page workflow, voice model, history storage and unchanged credit rules
- [x] Add compact cast controls, distinct voices, independent emotions, account-scoped device draft/audio recovery, failed-line retry and ordered MP3 export
- [x] Harden actual speech failures without changing prices; verify actual Hindi generation, signed-in mobile/desktop workflow, preview, retry, MP3 playback/download and Cloud History
- [x] Report verified results and publication status in VOICE_STUDIO_ACCEPTANCE.md
- [ ] Complete audible Hindi pronunciation/emotion/character-consistency assessment (requires fluent listening review; not claimed human-level)
- [ ] Cross-device editable draft synchronization and provider-denial durable circuit breaker (not implemented; current editable draft recovery is device-scoped)
- [ ] Verify live checkout/social sign-in and publish approved Voice Studio release (requires interactive payment/OAuth acceptance and explicit publication authorization)

## Video watermark
- [x] Inspect subscription fields and Video Studio, History and Telegram export/download paths; original uploaded transparent logo saved as an asset; no accounts, balances or engines changed
- [ ] Burn uploaded transparent logo into non-premium exports with server-verified active Premium exemption (owner selected their own processing service; blocked: its HTTPS address, API documentation and secure credentials are not supplied)
- [ ] Verify real Text to Video and Image to Video exports/downloads for Free and active Premium without repeat credit deductions (blocked: production renderer configuration; 1:1 remains unsupported by existing generation model)

## Permanent Telegram memory and Boss upgrade
- [x] Persist sender/chat-isolated messages, bounded context and summaries with replay protection
- [x] Add owner-only history search, date filters, memory correction/deletion and operational errors
- [x] Run real database/AI/dashboard checks and document live configuration blockers without changing finances (54 focused tests; one separately executed live DB/AI integration test; owner browser flow passed)
- [ ] Verify real incoming Telegram name/project recall and actual restart recovery (blocked: production webhook 401 after workspace move, publication authorization, owner verification and genuine Telegram inputs)

## Website-backed Telegram knowledge and screenshots
- [x] Inspect actual tools, public/help/account pages, server rules and live Telegram configuration without financial changes
- [x] Add versioned current/archived/discontinued knowledge, safe automatic real-page release capture and owner review flags
- [x] Integrate multilingual step-by-step help and verified public screenshots into DM/group reply paths (latest code not published)
- [x] Run 46 privacy/knowledge tests, capture eight real pages and verify screenshot delivery to owner DM; document current group/configuration blockers in English acceptance report
- [ ] Complete real incoming group/DM and customer workflows (blocked: bot removed/unavailable in groups, changed admin group configuration, owner verification, publication request and human Telegram inputs)
- [ ] Continuous scheduled capture and moderation policy (blocked: browser-capable runner and explicitly defined moderation actions/permissions)

## Premium visual effects
- [x] Add light-blue hero and subtle golden sparkles, dimensional icons with microphone waves, moving blue tool outlines and sparse site-wide particles
- [x] Verify landing-to-tools-to-studio navigation, reduced motion and desktop/mobile readability at 1280px and 384px; no horizontal overflow or page errors

## Complete Telegram system request
- [x] Add AI understanding before free-text DM/group replies while preserving verified account access and confirmed administrative actions (real AI checked for ambiguous 12, Hindi missing audio and greeting; production publication and human Telegram readback still pending)
- [x] Save owner-supplied original QR for custom offers; Telegram accepted private photo delivery and configuration readback verified (2026-10-21)
- [x] Add Hello handling in DM and configured groups without weakening admin authorization; 23 focused tests passed (production deployment/live greeting still pending)
- [x] Implement signed-in account linking UI, private stored-file recovery, support routing and owner operations dashboard (preview; Telegram link consumption/file delivery still needs live commissioning)
- [ ] Commission custom offers with the original QR and verified activation (original QR saved; blocked: publication and real owner/customer payment testing)
- [x] Implement durable notifications/receipts, confirmations, bounded non-AI actions, consent-aware announcements, existing reports and activation controls (administrative processing remains disabled)
- [x] Run 34 focused tests, verify signed-in link creation, normal-user denial, owner dashboard and unsigned worker rejection; update English report
- [ ] Publish Telegram changes and commission greetings, linked file recovery, decisions, concurrent/restart behavior and quiet-period notification delivery (blocked: publication request and genuine Telegram owner/customer test inputs; create managed minute schedule only after live endpoint is reachable)

## Telegram DM and group repair
- [x] Check fresh incoming deliveries and reply errors: 8 completed, zero failed/pending; Telegram accepted DM and both-group test sends; 21 tests passed; no evidenced code failure
- [x] Restore public DM/help replies while keeping sensitive admin processing gated; 21 focused tests passed
- [x] Verify privacy mode and Help-group administrator membership; register reachable secure production webhook without dropping pending updates
- [x] Publish and check real incoming owner verification, zero pending queue and invalid-auth rejection; report every requested live test in TELEGRAM_ACCEPTANCE.md
- [ ] Verify fresh human DM/group conversations and authorized/unauthorized commands (blocked: human Telegram inputs and reply readback; sensitive admin processing stays disabled)

## Telegram super admin bot
- [x] Inspect existing architecture, actual data sources and configured service dependencies
- [x] Build owner-only secure configuration and honest health dashboard; saved supplied IDs, verified API/groups and desktop/mobile, 10 authorization tests passed; normal user denied
- [ ] Complete webhook action/retry acceptance (production webhook registered and owner verified; real update completed; financial/concurrent/restart flows not yet tested)
- [x] Connect operational notification enqueueing and durable delivery tracking; scheduled worker prepared but not active before publication
- [x] Add confirmed, audited and idempotent credit/status/payment/plan operations using existing financial rules (live decisions unverified)
- [x] Add private account linking, support tickets and ownership-checked stored-file recovery (live Telegram acceptance pending)
- [x] Add bounded non-AI commands, consent-aware announcements and real-record reports
- [ ] Verify Telegram integration, authorization, every implemented action and restart/retry behavior (requires Telegram connection, owner ID, both group IDs and deployed endpoint)
- [x] Deliver staged English acceptance, configuration, cost and rollback report in TELEGRAM_ACCEPTANCE.md (not full acceptance)

## Current request
- [x] Redesign login, signup and forgot-password presentation without changing account behavior
- [x] Replace Story Generator interface with Script Studio, real description/language inputs and output actions
- [x] Rename user-facing Voice Over tool to Voice Studio without engine changes
- [x] Verify desktop/mobile views, real Hindi generation, edit, copy, file save, Voice Studio handoff and history readback
- [ ] Verify successful password login, email confirmation/recovery and Google authorization (blocked: account password, mailbox and interactive Google consent unavailable)
- [ ] Validate linguistic quality across other listed languages and experimental dialects (blocked: fluent review for each language)

## Step 1 (now)
- [x] Enable Cloud; Google + email login, sign up, forgot/reset password, logout
- [x] Profiles, plans, credits ledger (server-side), protected generation with cost deduction (voice 100/min, image 50, thumbnail 75)
- [x] Language choice (English, English+Hindi, Hindi) asked after first login; changeable in Settings
- [x] 3-dot account menu (12 items) + pages; Login button when signed out
- [x] Settings must not show API/engine details
- [ ] Verify fresh email signup confirmation, password login, refresh persistence, and wrong-password rejection
- [ ] Verify locked per-line emotion audibly affects real generated speech
- [ ] Verify admin can securely play/download stored voice, image, and thumbnail generations

## Step 2 (payment code built; blocked on Razorpay keys)
- [x] Checkout, verification, webhook, idempotent activation, expiry, history, admin Payments tab
- [ ] Live test with RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET (blocked: user keys)
- [ ] Connect an eligible Indian payment gateway when a supported secure integration is available; require server verification before activating plans or credits
- [ ] Both Pro and Premium subscriptions must support checkout and verified activation
- [ ] Promo-code field at checkout; percent discount grants the same percent bonus credits
- [ ] Admin promo management: create, list active/inactive, choose discount percent, deactivate
- [ ] Admin integration status may show whether required keys are configured, but never reveal secret key values
- [ ] Admin-managed website additions need a defined safe content scope before implementation

## Step 3
- [ ] Voice-over polish (plan-based voice counts, MP3 download), thumbnail text/element editing + regenerate

- [x] Owner natural-language admin implemented in private group/DM (custom plan by email, screenshot forwarding, customer plan requests → admin group). Current configuration readback: processing disabled and owner unverified; publication and live Telegram readback pending.

## Workspace move: re-link integrations (2026-11-04)
- [x] Link Google Search Console in the new workspace; verified property https://modernnova.in/ with siteOwner permission and sitemap 0 errors / 0 warnings (14 submitted, last downloaded 2026-11-02)
- [x] Link Telegram in the new workspace; bot @ModernNova_bot confirmed reachable
- [x] Publish so the live site picks up the new Telegram connection key, then re-register the production webhook with the matching security token; previous 401 error cleared, zero pending updates
- [x] Confirm a real human message in DM gets a reply ("Hy" at 11:49 IST on 7 Nov answered and delivered)
- [ ] Confirm a real human message in a group gets a reply (needs a message in a group)

## Telegram groups + creation forwarding (2026-11-05)
- [x] Public groups: reply to greetings/tool questions with fixed replies promoting only modernnova.in
- [x] Forward every completed creation (backlog + new) to MODERN NOVA AI ADMIN group via 5-minute schedule, no emails; test message delivered
- [ ] Publish so live bot uses new replies/forwarding (needs publish approval)
- [ ] Host renderer (blocked: no external hosting for FFmpeg; hosted runtime cannot run it)
- [ ] Groups beyond the 12 recorded (blocked: Telegram offers no list of bot's groups; a message in each group registers it)

## Script to Video visibility + admin-only maintenance switch (2026-11-05)
- [x] Script to Video card on Tools page + account-menu link; checked signed-out, regular and admin on desktop/phone; live on modernnova.in
- [x] Maintenance switch moved into Admin Dashboard only (no site-wide banner)

- [x] Music generation via Google AI Studio key
- [x] Website source ZIP export + README/.env.example

## Website cleanup (2026-11-27)
- [x] Remove Image, Thumbnail, Video Studio, Hosting, Diwali from site + admin
- [x] Permanently delete removed tools' data (user chose delete)
- [x] Bot: stop promotions/image posts; keep only member-add DM + Claim Reward
- [ ] Deliver new source ZIP in chat
