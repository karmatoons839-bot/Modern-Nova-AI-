import { createFileRoute } from "@tanstack/react-router";
import { CreditError, creditErrorResponse, finish, requireUser, saveBinaryOutput, spend } from "@/lib/credits.server";
import { MUSIC_CREDIT_COSTS } from "@/lib/music";
import { MusicEngineError, generateMusic, musicProviderConfigured, musicRequestSchema } from "@/lib/music-engine.server";

export const Route = createFileRoute("/api/music")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async () => Response.json({ generationAvailable: musicProviderConfigured() }),
      POST: async ({ request }) => {
        let gid: string | null = null;
        try {
          const user = await requireUser(request);
          const parsed = musicRequestSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return Response.json({ error: "INVALID_INPUT", message: "Describe the music (3+ chars) and pick a valid mood, type and duration." }, { status: 400 });
          // Check before charging so an unconnected provider never debits credits.
          if (!musicProviderConfigured()) return Response.json({ error: "MUSIC_NOT_CONNECTED", message: "Music generation service is not connected yet. Your credits were not charged." }, { status: 503 });
          gid = await spend(user.id, "music", MUSIC_CREDIT_COSTS[parsed.data.duration], parsed.data.prompt, `${parsed.data.mood} · ${parsed.data.musicType} · ${parsed.data.duration}s`);
          const { bytes, contentType } = await generateMusic(parsed.data, gid);
          await finish(gid, true);
          await saveBinaryOutput(user.id, gid, bytes, contentType);
          return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": contentType, "X-Generation-Id": gid, "Cache-Control": "no-store" } });
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          const msg = e instanceof Error ? e.message : "failed";
          if (gid) await finish(gid, false, msg);
          return Response.json({ error: "ENGINE_ERROR", message: msg }, { status: e instanceof MusicEngineError ? e.status : 500 });
        }
      },
    },
  },
});
