import { createFileRoute } from "@tanstack/react-router";
import { CreditError, creditErrorResponse, finish, requireUser, saveBinaryOutput, spend } from "@/lib/credits.server";
import { sfxCost, sfxRequestSchema } from "@/lib/sfx";
import { SfxEngineError, generateSfx } from "@/lib/sfx-engine.server";

export const Route = createFileRoute("/api/sfx")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        let gid: string | null = null;
        try {
          const user = await requireUser(request);
          const parsed = sfxRequestSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return Response.json({ error: "INVALID_INPUT", message: "Describe the sound (3–450 chars) and pick 0.5–22 seconds." }, { status: 400 });
          gid = await spend(user.id, "sfx", sfxCost(parsed.data.duration), parsed.data.prompt, `${parsed.data.duration}s`);
          const bytes = await generateSfx(parsed.data);
          await finish(gid, true);
          await saveBinaryOutput(user.id, gid, bytes, "audio/mpeg");
          return new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "X-Generation-Id": gid, "Cache-Control": "no-store" } });
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          const msg = e instanceof Error ? e.message : "failed";
          if (gid) await finish(gid, false, msg);
          return Response.json({ error: "ENGINE_ERROR", message: msg }, { status: e instanceof SfxEngineError ? e.status : 500 });
        }
      },
    },
  },
});
