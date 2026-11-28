# Script-to-Video real-world test preflight — 2026-11-05

## Owner-approved real paid test and delivery — 2026-11-05

Owner explicitly approved paid generation and Telegram delivery. Used only regular account karmatoons839@gmail.com and prepared project Nova Safety Test 01. Saved supported Hindi narrator zvx-voice-0076 without generating another image. Queued one animation and one voice through actual mobile-sized UI confirmations; processed existing task driver, no generation retries.

- Balance: 27,951 → 27,201 after animation (750) → 27,169 after voice (32) → 27,094 after final render (75). Total exactly **857**, original reused image 0. All three persisted tasks completed.
- Actual clip: 5.034667s, 3,914,193 bytes. Voice WAV: 14.6s. Browser join produced saved 1280×720 H.264/AAC MP4: 14.621333s, 5,559,178 bytes. Animation frame difference 0.5s→4s confirms motion; final-video held frame difference 6s→13s is only 0.409 average RGB units. Full voice matches output after 21.333ms AAC delay, waveform correlation 0.9997066, so complete speech preserved technically; no fluent human listening verdict claimed.
- Mobile-sized browser actually downloaded **Nova Safety Test 01.mp4** and played metadata successfully. First automation wait used button rather than link and timed out after successful rendering; database confirmed completed and exact charge, then read-only download succeeded without re-rendering.
- Only completed render generation 86dc72e4-facf-4093-b52b-39b0765cb4e1 was explicitly approved/reserved for send. Sent clip then full MP4, no captions/text. Telegram returned configured chat -1004423710774, message IDs **376** (clip) and **377** (full). Recorded sent marker for that generation to prevent scheduler replay. No other generation was approved; automatic test-account gates remain enabled.
- Telegram API message objects establish accepted uploads and ordered message IDs, **not independent group-side receipt/human viewing**. Please verify those two posts in the group. Each file is below the current 49MiB forwarding cutoff; large files remain blocked rather than replaced by text links.
- Actual Android device unavailable. Real failure/refund intentionally not induced during the 857-budget success test; prior local SQL failure rollback checks remain separate evidence. No unrelated feature/pricing change or additional publication performed.

| Acceptance | Result |
|---|---|
| Scene generation / voice generation / account storage / final join / MP4 mobile-sized download / exact 857 deduction | PASS — actual regular-user flow |
| Long voice synchronization | PASS — measured real outputs; no human speech-quality review |
| Failed generation/refund | NOT RE-RUN live; isolated rollback tests previously PASS |
| Telegram clip + final delivery | API ACCEPTED in order (376,377); independent group readback pending |
| Physical Android compatibility | NOT VERIFIED — no device |

## Approved release request — 2026-11-05 06:28 UTC

The owner explicitly requested publication after verification. Re-ran 92 free S2V/Telegram tests across 12 files: all passed. Regular-account mobile-sized Chromium recheck passed (stored image, single renderStart for two handler calls, missing-clip protection, no overflow/page errors). Live test-account balance 27,951, all 42 records unapproved/gated, no new test-account sent markers since the gate request. Fresh backend security scan completed without active critical findings; deeper scan was not rerun. No paid generation or Telegram sending performed. Publishing is requested separately; this report does not prove deployment completion.

Release limitations remain explicit: test voice not selected, paid provider/refund/download/Telegram readback acceptance not performed, physical Android unavailable, gate covers test-account automatic creation forwarding rather than global Telegram sends or bot recovery. No production-ready claim.

## Telegram approval gate — subsequent owner request

- Automatic creation forwarding is blocked for the controlled regular test account, not for unrelated users, bot replies or scheduled group greetings/promotions.
- Migration 0029 is live: new test-account creations are flagged automatically; 42 existing account generations are flagged; scheduled claims exclude unapproved records and a before-update guard prevents the old deployed immediate-finalization claim from returning a row. Existing sends already in flight cannot be recalled.
- Explicit per-generation approval is required separately from paid generation consent. The owner-only approval RPC/function records approver and approval time. No records have been approved by this task and no approval function or Telegram send was executed.
- Preview forwardOne also fails closed if its approval check fails or the generation is unapproved. That code remains unpublished; the live database guard protects the currently deployed claim paths without publication.
- Four new isolated SQL tests PASS: automatic cron blocked, deployed-style immediate claim blocked, regular-user approval refused/owner approval unlocks only one generation, unrelated account unchanged. Combined safety/rates suite: 29 PASS, 0 FAIL; preview build OK. Live balance remains 27,951.
- Narrator voice selection and explicit paid-generation approval remain outstanding. Before any Telegram delivery, obtain a separate owner approval naming the specific completed test generation.

## Final free re-verification — 2026-11-05

No application code, pricing, live credit balances, Telegram configuration or deployment was changed in this verification. Only this report and the roadmap were updated. No paid generation, successful render finalization, Telegram sends or publishing were invoked.

| Requested check | Result | Executed evidence / limits |
|---|---|---|
| Repeated clicks and simultaneous finalizations | PASS — isolated concurrency + real preview handler | On the actual mobile-sized preview, two synchronous invocations of the existing React Render handler issued exactly one renderStart request; missing clip blocked it before any upload/debit/send. In a separate real local PostgreSQL database, 20 overlapping calls to the actual migration's finalize function yielded one original result and 19 reused results, one simulated 75 debit, one generation. No live paid finalization performed. Simultaneous renderStart calls from different tabs may still perform duplicate local work; final charges are protected. |
| Image reuse deduplication | PASS | 20 overlapping actual SQL reuse calls in the isolated database returned one task ID and one zero-cost frame; no additional simulated debit. Live prepared project still has only its original completed zero-cost frame; the real stored JPEG exists (315,547 bytes) and visibly loads. Explicit Regenerate image remains a distinct paid action, not reuse. |
| Clip/voice links | PARTIAL | Render code collects each scene's current-revision completed animation and voice in order, requires voice when ON plus nonempty dialogue, and includes ordered media paths in the fingerprint. The prepared project has no generated clip or voice; no real clip/voice link verification claimed. Reused frame task/key/path remains unchanged. |
| Regular-user balance | PASS | Live balance before and after: 27,951 → 27,951; zero owner/admin roles and zero team memberships. All charging tests used temporary local fixture balances, never a real wallet. |
| Single-scene readiness | NOT READY | Nova Safety Test 01 has one analyzed five-second scene, voice ON, real reused image, enabled Generate clip 750 control, voice 32 control and final price 75. Narrator voice is still blank; choose/save a supported voice before approval. Confirmed live prices total 857; expected end balance 27,094 absent concurrent spending. |
| No automatic Telegram messages | PARTIAL / NOT GLOBALLY GUARANTEED | No send was invoked by these checks. Load/reuse and blocked renderStart contain no forwarding call. Successful non-reused renderFinish automatically notifies Telegram, and the existing broadcast worker independently forwards completed backlog. Nothing was disabled or reconfigured. A global no-send guarantee would require separate explicit scope to gate those paths; no claim that existing scheduled activity was halted. |
| Saved vs published | PASS | Current files and added SQL functions are saved; live database definitions were inspected. The published S2vStudio-BUXLlRYX.js bundle returns 200 but lacks reuseFrame, Reuse image and Saved final video reused safeguards present in preview. These frontend/server code changes remain unpublished; additive database functions are already live. No publication requested or performed. |

Existing safety/pricing tests re-run: **25 PASS, 0 FAIL**. Mobile-sized Chromium: 384×696, real regular-account session, stored image visible, render blocked while missing a clip, no horizontal overflow and no page errors. Not an actual Android phone test.

Isolated test artifacts: `/tmp/s2v-concurrency/check-concurrency.ts` and fixtures; temporary local PostgreSQL shut down after tests. Browser evidence: `/tmp/browser/s2v-final-free/saved-scene.png`, `voice-readiness.png`, `double-click-blocked.png`. Temporary artifacts are not durable deployment evidence.

No paid test approval is requested yet: narrator selection, automatic completion delivery consent and later actual receipt verification remain explicit readiness boundaries. Real paid generation/refund/provider quality and Android acceptance remain unverified.

## Execution boundary

No paid images, animation, speech, render tasks or Telegram messages were generated. After inspection the owner selected **Fix first; no spending**. Only Script-to-Video replay safeguards, zero-cost account-owned image reuse and supporting tests were changed; prices and existing balances were preserved. The authenticated browser saved a one-scene draft and reused an actual previously generated account-owned scene image.

## Verified preparation

- Account: karmatoons839@gmail.com; active Free, no owner/admin roles or team unlimited-credit privileges.
- Starting balance: **27,951 credits**. Re-read immediately before any approved paid test.
- Live configured rates: 5s animation 750, voice 375/min, final render 75; cap 40 scenes.
- Five-second voice task quote: ceil(5 × 375 / 60) = **32**.
- Requested test budget: **857**; expected ending balance **27,094** if no concurrent spending and all three operations succeed.
- **25 tests passed**, including the actual new SQL functions executed in isolated in-memory PostgreSQL: duplicate render charges once (75), absent upload charges zero, settlement failure rolls back, wrong price is refused, image reuse is free/deduplicated and foreign-account paths are refused. These are local SQL tests, not live-wallet/provider acceptance.
- Chromium 384×696 touch/mobile-size view: authenticated Studio home and saved scene opened without horizontal overflow. Image reuse succeeded and reloaded with the real stored image; Generate clip (750) became enabled. No paid generation controls were invoked.
- Prepared project: `21fe91cd-54a7-4bdf-9630-190e56271d0e`, **Nova Safety Test 01**, one 5-second scene, voice ON, real saved Ramu aur Bargad scene-0 image reused for **0 credits**. Voice selection must still be saved before paid speech. Balance re-read after preparation: **27,951**, unchanged.
- Preview build is clean. Code changes have **not been published**; the additive database functions are already applied.

## Blocking findings before paid approval

1. **Render replay weakness fixed in preview.** Reproduced the timestamp-key issue before editing. `renderFinish` now uses a stable fingerprint of the exact ordered media and a project-locking atomic transaction covering debit, settlement and final storage references. Repeated finalization returns the original result without another charge. The same source check passes after editing; real live debit is still not tested.
2. **857-compatible scene prepared without extra generation.** Added a zero-cost reuse path limited to the caller's stored images; ownership and existence are checked server-side. The prepared scene uses the regular account's real previously generated scene-0 image. No references or composition images were generated.
3. **Telegram evidence is incomplete.** The configured group and forwarding constant currently both equal `-1004423710774`. Forwarding awaits each clip then the final MP4 with no caption. However missing/oversized sends return false and `forwardOne` still marks the generation sent; message IDs are not persisted. A sent marker is not an actual receipt check. API response success alone will not count as delivery PASS.
4. **Telegram file limits.** Current code skips files at or above 49 MiB (51,380,224 bytes), below the Bot API's usual approximately 50 MB upload ceiling. It sends no text links for skipped media. The controlled test must remain below this threshold and verify both files appear in the group.
5. **No physical Android device is available.** Chromium mobile emulation does not establish Android memory, stability or downloads.

## Current acceptance report

FAIL below means the real-world acceptance gate has **not yet passed**, not proof that generation itself is broken.

| Item | Status | Evidence / remaining check |
|---|---|---|
| Scene generation | FAIL — not run | Compatible frame prepared; explicit paid approval absent |
| Voiceover generation | FAIL — not run | Live quote is 32; actual speech generation not run |
| Long voice synchronization | FAIL — real generated media not run | Frame-hold code exists; prior sample results are not repeated or reclassified as this paid test |
| Final video joining | FAIL — not run | No new generated clip/voice to merge |
| Account storage | FAIL — not run | Signed upload + object verification inspected, not executed for this test |
| MP4 download | FAIL — not run | Signed download filename is derived from title; no new file downloaded |
| Credit deduction and refunds | FAIL — real-wallet acceptance not run | Local duplicate, failure rollback and exact-price SQL tests PASS; no real debit/refund performed |
| Telegram clip delivery | FAIL — not run | No sends; group-side readback needed |
| Telegram final video delivery | FAIL — not run | No sends; group-side readback needed |
| Real Android compatibility | FAIL — unavailable | No physical device access; mobile-sized Chromium home only |

## Controlled paid checklist after blockers are resolved and explicit approval

1. Use the regular account above, new title `Nova Safety Test 01`, exactly one five-second scene and voice ON; reuse compatible existing image/reference assets at zero additional generation cost. Supply a short Hindi line likely longer than five seconds; measure actual output rather than assume its duration.
2. Record fresh starting balance and quote; generate only one animation. Verify success/storage and a separate 750-credit ledger debit. Stop on failure and verify refund before continuing.
3. Generate only one voice. Verify stored playable audio and a separate 32-credit debit; failure must restore the reservation.
4. Inspect animation and complete speech. If voice exceeds five seconds, measure final scene length and confirm original animation followed by final-frame hold, without cutting speech.
5. Interrupt local joining/upload before finalize as a separate controlled check; verify no 75-credit debit. Resume using successful assets, not generation replay.
6. Join/upload/finalize once; verify MP4 object, one 75-credit render charge, and safe duplicate-finalize behavior using the new server protection.
7. Download on the mobile-sized browser; inspect actual download filename and MP4 content. Test title `Nova Safety Test 01.mp4`.
8. Verify scene clip then full video in the actual admin group, media only. Save Telegram message IDs if supported and obtain group-side readback; do not treat an HTTP response or sent flag as receipt.
9. Re-read balance and ledger: final balance must be starting minus 857. Report each failure and any unrecovered reservation; never re-run ambiguous paid operations automatically.
10. Report real Android separately as unverified unless a physical phone is actually used. No production-ready declaration until remaining gates pass.

Paid approval is still absent. No test will run automatically from this report.