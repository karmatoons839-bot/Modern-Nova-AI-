// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { loadEnv } from "vite";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Server routes read non-VITE secrets (LOVABLE_API_KEY, SUPABASE_SERVICE_ROLE_KEY)
// from process.env; load the full .env set for server-side code only. Never feed
// these into the client envDefine block — that would leak secrets into the bundle.
const serverEnv = loadEnv(process.env["NODE_ENV"] === "production" ? "production" : "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Self-hosting: set NITRO_PRESET (e.g. node-server, vercel, netlify) to build for that host; default is Cloudflare.
const nitroPreset = process.env["NITRO_PRESET"];

export default defineConfig({
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      // Pin only legacy v4 subpaths + bare "entities" (exact match) to the hoisted v4.5.0;
      // htmlparser2's v7 subpaths like "entities/decode" must resolve to its nested copy.
      alias: [
        { find: /^entities\/lib\/decode\.js$/, replacement: path.resolve(import.meta.dirname, "node_modules/entities/lib/decode.js") },
        { find: /^entities\/lib\/encode\.js$/, replacement: path.resolve(import.meta.dirname, "node_modules/entities/lib/encode.js") },
        // The server bundler resolves these from the root, so point them at htmlparser2's v7 copy.
        { find: /^entities\/(decode|escape)$/, replacement: path.resolve(import.meta.dirname, "node_modules/htmlparser2/node_modules/entities/dist/esm/$1.js") },
        { find: /^entities$/, replacement: path.resolve(import.meta.dirname, "node_modules/entities") },
      ],
    },
  },
});
