# Complete Script-to-Video Studio

## Scope and protections
Extend the existing Modern Nova AI app into eleven linked pages sharing one saved project ID. Keep the existing admin-only Script-to-Video restriction and Telegram final-video destination. Do not change other tools, subscription plans, existing balances, payments or Voice Studio prices. Preserve old projects and downloads.

## What inspection found
- The current studio is one page, using an uploaded background and a fixed character catalog; neither meets the new AI-generated reference requirements.
- Real image, video and speech integrations exist, with saved projects/scenes and private media storage.
- The live settings currently allow only six scenes. Final video joining runs on the user's device and stops when the page closes.
- Credits are currently reserved for the entire project, with whole-project refunds rather than failed-task refunds. Durable submission, pause and recovery need strengthening.
- There is no configured server renderer. The app's hosted runtime cannot run native FFmpeg. A complete unattended final render therefore requires a separately hosted, project-owned rendering worker—not another user-facing website.

## Eleven connected pages
1. **Story Creation:** title, description, supported language, genre, requested duration, character preferences and instructions; real generation using the existing story integration. Preserve its existing billing rules, displayed before any charge.
2. **Story Preview:** saved title, preview, language, genre and estimated duration; read, edit and regenerate actions.
3. **Full Story Editor:** editable story/title/dialogues, add scene/dialogue, automatic draft saving and explicit Save; invalidate outdated analysis after edits rather than silently generating from old text.
4. **Animation Style:** six illustrated choices—2D, 3D, realistic, cartoon, anime and cinematic. Apply the selected style to all reference and scene prompts. Illustrations are style examples, not generated project assets.
5. **AI Backgrounds:** free location analysis followed by explicitly confirmed paid image generation; individual previews, regeneration and saved recurring-location references. No upload requirement.
6. **AI Characters:** free character extraction followed by explicitly confirmed reference generation; full-body references and individual regeneration. No fixed catalog requirement. Reuse references consistently; do not promise perfectly identical AI output or exact lip sync.
7. **Voiceover:** ON/OFF, narrator and per-character voices from the existing catalog, supported language, one allowed emotion per spoken line, real free samples within existing preview limits, saved assignments. OFF makes no speech calls and adds no generated voice track.
8. **Settings & Credits:** 5/10-second clips, portrait/landscape, actual backgrounds/characters/scenes, estimated duration, wallet balance and itemized estimate. Clearly separate already-paid reusable assets from new work. Require confirmation before every paid generation or regeneration.
9. **Processing:** persisted clip and task counts/statuses, completed-task-derived progress, current work and errors; no invented ETA. Restore actual status after leaving or returning.
10. **Final Video:** real saved full-video player/download, duration/format, scene editing and link to clips; mark completed only after the final file is saved and validated.
11. **All Clips:** individual stored previews/downloads, editing and confirmed regeneration, downloadable archive of real clips and return to final video.

## Latest dedicated pricing
The prices supplied in your clarification supersede the earlier image example:
- Script/character analysis and scene breakdown: **FREE**.
- Background/scene image: **500 credits per newly generated image**.
- Character reference: **300 credits each**.
- Animation: **1,000 per 5-second clip**, **2,000 per 10-second clip**.
- Voiceover ON: **500 per minute**; calculate from generated audio duration, rounding the credit amount upward and never exceeding the confirmed quote without new approval. OFF: **0**.
- Completed final rendering: **100 credits**.

Count every image operation explicitly. If a scene needs a separate composition image in addition to its background reference, include it in the quote; no hidden asset costs. For five backgrounds and five 5-second clips, the subtotal is **7,600 credits**, before characters, voiceover or any separately required scene images. Existing successful assets are not charged again unless regeneration is confirmed.

## Reliable processing and credit safety
- Reuse the existing wallet and transaction history; add task-level charge/refund references and unique operation keys, not a second wallet.
- Atomically confirm/claim work and record billing; completed tasks survive retries. Refund failed tasks exactly once and settle rendering only after actual output succeeds.
- Persist backgrounds, characters, scene mappings, voice assignments, audio, clips and final output with owner/admin access policies.
- Process bounded batches using database leases, provider job IDs and pause guards. Unknown provider outcomes require reconciliation, not blind resubmission. Provider denials stop the queue.
- Build a project-owned FFmpeg rendering worker with authenticated job requests, ordered composition, voice duration checks, private storage, output validation and an asynchronous result contract. Do not trim away story dialogue silently.
- Deploy and connect that worker only when a suitable hosting destination is available. Until then, show rendering as unavailable—not successful—and do not charge final-render credits. Local renderer tests do not establish production availability.
- Verify the existing scheduler and its deployed endpoint before claiming work continues while the website is closed.

## Admin controls
Extend the existing Script-to-Video admin page with the dedicated rates, limits, reference management, generation/task states, errors, spending/refunds and renderer health. Retain server-side administrator authorization and keep credentials secret; show only configuration status.

## Technical approach
Keep TanStack routes and the current design system. Add small shared studio navigation/editor/media components, project-scoped routes, authenticated server operations and additive database changes. Preserve old project records and legacy endpoints; new projects use the expanded workflow. Isolate the project-owned renderer from the hosted app runtime. Record structural rules in AGENTS.md.

## Verification and acceptance
Run pricing, authorization, duplicate confirmation, voice-OFF, reuse, task refund and recovery tests. Exercise a short real Hindi project through all eleven pages, including paid assets/audio/video, stored readback and actual downloads; report the test cost. Check mobile and desktop, then test other languages/styles and long jobs separately. Do not claim 20-minute output, exact character identity, exact lip sync or unattended rendering until verified. Do not publish unrelated pending changes without authorization.

**Current external blocker:** no hosting destination for the project-owned FFmpeg worker. Its implementation can be built and tested, but a fully working production final-render flow cannot be promised until it is deployed and connected.