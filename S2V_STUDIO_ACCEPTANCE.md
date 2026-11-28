# Script-to-Video continuation — 2026-11-05

## Fixed first
- `s2v-studio.functions.ts`: removed untyped provider task input from client DTOs so server-function returns are serializable.
- `s2v-studio.server.ts`: removed the unsupported `store` field from the selected Responses SDK contract; split video download Blob and ArrayBuffer consumption into explicitly narrowed steps.
- Automatic preview build reported **build OK** before studio continuation, and after the new views/admin controls.

## Implemented in this continuation
- `/script-video` opens the new project list; `/script-video-studio/$id/$step` provides eleven numbered, separately addressable project views with per-view metadata.
- Existing single-page video projects remain at `/script-video-legacy`; their APIs, media and prices are unchanged.
- Added project creation/list/read/save actions, optimistic save conflict detection, story editing and automatic save, free analysis action, generated reference actions, six local style illustrations, saved voice assignments and actual speech preview integration.
- Reference/scene-image/clip actions quote the server rate and require confirmation. Views display actual task state and download only signed stored files; ZIP export contains actual completed clips.
- Admin controls expose new studio image/character/voice rates independently of legacy pricing.
- Added `services/s2v-renderer`: Docker deployment files, authenticated HTTP jobs, SQLite queue/restart recovery, HTTPS source allowlist, bounded downloads, FFmpeg joining, voice OFF audio removal, exact duration measurements and rejection of dialogue overflow. It is a project-owned processing service, not a new website.

## Executed checks
- **16 pricing/state tests passed** across `s2v-studio.test.ts` and unchanged legacy `s2v-pricing.test.ts`.
- **3 actual renderer tests passed**: exact HTTPS host restrictions; joining diagnostic clips into a real MP4 with no audio when OFF; rejection of dialogue longer than its scene.
- Playwright at 1280×1800 and 384×696, using the requesting user's real session: Script-to-Video correctly displayed **admins only**; no page errors or horizontal overflow.
- Latest automatic preview build: **build OK**.
- No paid AI generation was run, no wallet balance was changed, no admin role was assigned and nothing was published.

## Not complete / blockers
- The browser account available for testing is not an admin. Therefore the actual administrator's story creation, saved readback, generated references, voice previews, paid clip generation and eleven-page project navigation were **not verified end-to-end**.
- Renderer source is implemented and tested locally, but no hosting destination or secure deployment configuration is available. The website does **not** submit final render jobs to a deployed renderer.
- Complete measured-duration voiceover billing, final renderer settlement/storage, automatic whole-pipeline chaining and final Telegram delivery remain to be connected and tested after deployment. The new workflow refuses voice/render paid tasks rather than charging for an unavailable capability.
- Scene and character visual identity, accurate voice synchronization, 20-minute jobs, actual task refunds/restart recovery and successful whole-video downloads remain unverified. Current database settings still cap analysis at six scenes; the app must not promise long video generation under that cap.
- Full-video actions explicitly report unavailable final rendering instead of displaying a fake completion/player.

## Deployment status
All app-source changes are **unpublished**. Successful compilation is not full feature acceptance. Do not publish as a complete Script-to-Video system until the missing renderer and administrator end-to-end checks are resolved.