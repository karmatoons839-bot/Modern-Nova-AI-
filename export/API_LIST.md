# Configured APIs & services (unchanged)

## Credential presence checked on 2026-11-26
This inventory checks configured secret names and linked services, not successful live generation. No API or credential was changed. Private values are never included in this source archive.

Already configured; do not request these again: Google AI Studio (`GOOGLE_AI_STUDIO_API_KEY`, `GOOGLE_API_KEY`), ElevenLabs, Telegram, Google Search Console, image/thumbnail API keys, UPI payee details, and the hosting configuration encryption key. The Lovable AI key and managed cron credential are also present, but are platform credentials rather than portable provider credentials.

### Still required or to decide for independent hosting
- AI text, speech, image and video replacement: the owner selected existing Google AI Studio on 2026-11-26. Reuse the supplied `GOOGLE_AI_STUDIO_API_KEY`; do not request another key. The current implementations still use Lovable AI: provider selection is not a completed migration. Direct Google adapters, compatible voice/model mappings and account access/quota checks are required before switching; preserve existing integrations until those paths are verified.
- Independent database/auth/storage: provision an external backend and configure its server and publishable credentials; the existing Lovable Cloud service-role key is not available to export. Accounts, balances and stored media require a separate controlled migration.
- Google sign-in: configure OAuth for the new host. Search Console credentials are not Google login credentials.
- Telegram: the existing linked credential is a connector-gateway key, not a portable bot token. For independent hosting supply the original bot token securely from BotFather; do not expose it in source.
- Email: the owner selected their own SMTP on 2026-11-26. SMTP credentials are not currently configured. Obtain the real server hostname, port, TLS/STARTTLS mode, login username, password and verified sender address securely; independent-host email transport and a real delivery test remain required. Do not replace the existing email service until verified.
- Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` are absent. These are optional while retaining the existing direct UPI flow.
- Customer hosting: a real VPS/provisioning URL and server token are required; no placeholder connection is supplied.
- Rewarded ads: approved publisher/ad-unit details and verified completion support are still required, not fake ads.

Existing Google/ElevenLabs credentials should be entered in the new host's secret settings by their owner; they are intentionally not bundled. The archive does not automatically replace APIs or make Lovable-only services independent.

| Feature | Endpoint / service | Key needed |
|---|---|---|
| Script Studio, Voice analysis, Telegram AI | Lovable AI Gateway | LOVABLE_API_KEY |
| Voice Studio TTS (`/api/speech`) | Lovable AI Gateway TTS | LOVABLE_API_KEY |
| Image / Thumbnail (`/api/image`, `/api/thumbnail`) | Lovable AI Gateway (or `*_API_BASE_URL` self-hosted ZIP server) | LOVABLE_API_KEY |
| Video / Script-to-Video | Lovable AI Gateway video | LOVABLE_API_KEY |
| SFX Maker (`/api/sfx`) | ElevenLabs sound generation | ELEVENLABS_API_KEY |
| Music Studio generation (`/api/music`) | Google AI Studio Lyria RealTime (your key) | GOOGLE_AI_STUDIO_API_KEY (or MUSIC_PROVIDER_URL) |
| Payments | Razorpay / direct UPI | RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, UPI_PAYEE_VPA, UPI_PAYEE_NAME |
| Telegram bot | Telegram Bot API | TELEGRAM_API_KEY |
| Developer API (`/api/public/v1/*`) | Own keys (`mnva_live_`) | stored hashed in DB |
| Hosting panel | Your CloudPanel VPS connector | saved encrypted in Admin |
| Auth / DB / storage | Supabase | SUPABASE_URL, keys |
| Admin custom providers | Admin → APIs tab (encrypted in DB) | optional |
