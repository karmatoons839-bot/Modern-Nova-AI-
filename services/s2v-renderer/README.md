# Project-owned video renderer

This service runs outside the website hosting runtime. It is **not deployed** by adding these files. No external vendor receives project media until an operator deploys and configures this service.

## Run

Build the Docker image, mount a persistent volume at `/data`, and supply:
- `RENDERER_TOKEN`: a strong secret from the deployment platform's secret manager.
- `RENDERER_MEDIA_HOSTS`: comma-separated exact HTTPS storage hosts permitted for source media. No wildcards.
- `RENDERER_MAX_SECONDS`: maximum final duration, default 1200.

Use a private service network or HTTPS ingress. Do not publish its token in the app/browser. The website integration and measured audio-credit settlement still need to be connected before final rendering is enabled.

## Contract

Authenticated `POST /jobs` accepts `{id, aspect, voice_on, clips:[{video_url, seconds, audio_urls:[]}]}`. IDs are UUIDs. Duplicate IDs with an identical payload return the existing job; changed payloads are rejected. `GET /jobs/<id>` returns persisted actual status, error and measured audio/video durations. `GET /jobs/<id>/file` serves completed MP4 only. All endpoints require `Authorization: Bearer <token>`.

One worker processes SQLite-backed jobs sequentially. Interrupted rendering resumes from the original saved job on restart; no AI calls occur here. Downloads are bounded, host-allowlisted, HTTPS-only, with redirects disabled. Final outputs strip provider audio; voice OFF adds no generated speech. Voice ON joins supplied dialogue files in order and rejects overflow rather than dropping words. Duration measurements come from ffprobe, not the submitted estimate.

The service does not change wallet credits; the app must authorize every render and reconcile measured voice duration through its existing ledger. The app must copy successful output into its private storage, validate it, settle rendering once, and send the verified final-video Telegram notification. Those integration steps are pending deployment.

## Verification

`python3 -m unittest discover -s services/s2v-renderer -p '*_test.py'` runs URL/identity tests and an actual FFmpeg silent composition test using generated diagnostic test clips (not shown as user videos). The test fixtures are temporary and do not consume AI credits.