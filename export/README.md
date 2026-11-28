# Modern Nova AI — Source Export

Full source of modernnova.in: TanStack Start (React 19, Vite 7, Tailwind v4) frontend + server routes, Supabase (Postgres/Auth/Storage) backend.

## Contents
- `src/` app pages (`src/routes`), components, server logic (`*.server.ts`, `*.functions.ts`), API routes (`src/routes/api`)
- `public/` images, logo, fonts/assets
- `supabase/migrations/` complete database schema, RLS policies and functions — apply to your own Supabase project
- `services/` optional renderer service, `.env.example` all configuration keys

## Install & run
```sh
npm install        # or: bun install   (Node 20+)
cp .env.example .env   # fill values
npm run dev        # http://localhost:8080
npm run build      # production build -> .output/
```

## Database
1. Create a Supabase project. 2. `npx supabase link --project-ref <ref>` then `npx supabase db push` (runs `supabase/migrations`). 3. Create storage buckets `generations`, `avatars`, `s2v-characters` if not created by migrations. 4. Enable Email + Google auth in Supabase Auth.
Note: user accounts/credits live in the current database; export data separately (pg_dump) if you migrate.

## Deploy
Build target is chosen with `NITRO_PRESET` (default: Cloudflare Workers).
- **Node / VPS**: `NITRO_PRESET=node-server npm run build` then `PORT=3000 node .output/server/index.mjs` (verified).
- **Vercel**: `NITRO_PRESET=vercel npm run build` (or set it as a Vercel env var; Vercel auto-detects `.vercel/output`).
- **Netlify**: `NITRO_PRESET=netlify npm run build`.
- **Cloudflare**: `npm run build` then `npx wrangler deploy` (config in `dist/server/wrangler.json`).
- **Firebase**: Hosting is static only — run the server on Cloud Run with `node-server` preset.
Add all `.env` values in the host's environment settings. Point Telegram webhook and Razorpay webhook to your new domain.

## Lovable-specific services to replace when leaving Lovable
| Service | Used for | Replace with |
|---|---|---|
| `LOVABLE_API_KEY` AI Gateway (`ai.gateway.lovable.dev`) | Story, voice TTS, image, thumbnail, video, S2V, Telegram AI | Your OpenAI / Google AI Studio / ElevenLabs keys — edit `src/lib/ai.server.ts`, `voice-engine.server.ts`, `image-engine.server.ts`, `video-engine.server.ts` |
| Connector gateway (`connector-gateway.lovable.dev`) | Telegram bot calls | Direct `https://api.telegram.org/bot<TOKEN>/` in `src/lib/telegram*.server.ts` |
| `@lovable.dev/cloud-auth-js` | "Sign in with Google" shortcut | Supabase `signInWithOAuth({provider:"google"})` |
| Lovable Cloud database | All data | Your own Supabase project |
| Lovable email | Notifications | Resend/SMTP in `src/lib/email-templates/send-email.ts` |

Existing API configuration was NOT changed in this export. See `API_LIST.md`.
