import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { CreditError, creditErrorResponse, requireUser } from "@/lib/credits.server";
import { scriptLanguage } from "@/lib/script-config";

const Horror = z.object({
  story_type: z.literal("horror"),
  topic: z.string().trim().min(2).max(2000),
  description: z.string().trim().max(20000).optional(),
  language: z.string().trim().min(2).max(40).default("Hindi"),
  minutes: z.number().int().min(1).max(30).default(5),
});
const Moral = z.object({
  story_type: z.literal("moral"),
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(20000).optional(),
  language: z.string().trim().min(2).max(40).default("Hindi"),
  minutes: z.number().int().min(1).max(30).default(5),
});
const Body = z.discriminatedUnion("story_type", [Horror, Moral]);

function err(status: number, error: string, message: string) {
  return Response.json({ success: false, error, message }, { status });
}

export const Route = createFileRoute("/api/story")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        let user;
        try {
          user = await requireUser(request);
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          throw e;
        }
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return err(400, "INVALID_INPUT", "Please fill every required field for the selected story type.");
        }
        if (!scriptLanguage(body.language)) return err(400, "UNSUPPORTED_LANGUAGE", "This language is not available. Please choose a language from the list.");
        const eng = await import("@/lib/story-engine.server");
        const { spend, finish, scriptStudioCost } = await import("@/lib/credits.server");
        const style = `${body.story_type === "horror" ? "Horror" : "Moral"} · ${body.minutes} min`;
        const titleIn = body.story_type === "horror" ? body.topic : body.title;
        let gid: string;
        try {
          gid = await spend(user.id, "story", scriptStudioCost(body.minutes), titleIn, style);
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          throw e;
        }
        try {
          // Server decides the engine from the validated story_type only.
          const raw = body.story_type === "horror" ? await eng.runHorrorEngine(body) : await eng.runMoralEngine(body);
          const story = eng.cleanStory(raw);
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin.from("generations").update({ prompt: story.slice(0, 20000) }).eq("id", gid);
          } catch { /* history save must not block the story */ }
          await finish(gid, true);
          return Response.json({ success: true, story_type: body.story_type, story, generation_id: gid });
        } catch (e) {
          await finish(gid, false, e instanceof Error ? e.message : "failed");
          const status = (e as { status?: number }).status ?? 502;
          return err(status, "ENGINE_FAILED", e instanceof Error ? e.message : "Story generation failed.");
        }
      },
    },
  },
});
