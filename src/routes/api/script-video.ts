import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CreditError, creditErrorResponse, requireUser } from "@/lib/credits.server";
import { getSettings, planScript, S2V_BUCKET_OUT } from "@/lib/s2v.server";
import { pricesFromSettings, s2vBreakdown } from "@/lib/s2v-pricing";
import { videoConfigured } from "@/lib/video-engine.server";

const schema = z
  .object({
    requestKey: z.string().uuid(),
    title: z.string().trim().max(200).default(""),
    script: z.string().trim().min(20, "Please paste a longer script."),
    aspectRatio: z.enum(["16:9", "9:16"]),
    characterId: z.string().uuid(),
    bgData: z.string().min(100).max(14_000_000),
    bgMime: z.enum(["image/png", "image/jpeg", "image/webp"]),
  })
  .strict();

const err = (status: number, error: string, message: string) => Response.json({ error, message, detail: message }, { status });

// Creates a Script-to-Video project: understands the script (with the background
// image), charges once for the planned seconds, then queues every scene. Work is
// advanced by GET /api/script-video/$id and the scheduled tick.
export const Route = createFileRoute("/api/script-video")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!videoConfigured()) return err(503, "NOT_CONFIGURED", "Video generation is not configured on the server yet.");
          const user = await requireUser(request);
          const settings = await getSettings();
          if (!settings.enabled) return err(403, "DISABLED", "Script to Video is turned off right now.");
          const req = schema.parse(await request.json());
          if (req.script.length > settings.max_script_chars) return err(400, "SCRIPT_TOO_LONG", `Script is longer than ${settings.max_script_chars.toLocaleString()} characters.`);
          if ((req.aspectRatio === "9:16" && !settings.allow_vertical) || (req.aspectRatio === "16:9" && !settings.allow_landscape))
            return err(400, "FORMAT_DISABLED", "This video format is not available.");

          // Repeated clicks with the same key return the same project (no double charge).
          const { data: existing } = await supabaseAdmin.from("s2v_projects").select("id, credits_charged").eq("user_id", user.id).eq("request_key", req.requestKey).maybeSingle();
          if (existing) return Response.json({ id: existing.id, cost: existing.credits_charged });

          const { data: ch } = await supabaseAdmin.from("s2v_characters").select("*").eq("id", req.characterId).eq("enabled", true).maybeSingle();
          if (!ch) return err(400, "CHARACTER_UNAVAILABLE", "Please choose another character.");

          const ext = req.bgMime.split("/")[1];
          const bgPath = `${user.id}/s2v/bg-${req.requestKey}.${ext}`;
          const bgBytes = Uint8Array.from(atob(req.bgData), (c) => c.charCodeAt(0));
          if (bgBytes.byteLength > 10 * 1024 * 1024) return err(400, "IMAGE_TOO_LARGE", "Background image must be under 10 MB.");
          const up = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).upload(bgPath, bgBytes, { contentType: req.bgMime, upsert: true });
          if (up.error) return err(500, "UPLOAD_FAILED", "Could not save the background image.");

          const plan = await planScript({
            title: req.title,
            script: req.script,
            characterName: ch.name,
            characterDescription: ch.description,
            bgBase64: req.bgData,
            bgMime: req.bgMime,
            maxScenes: settings.max_scenes,
          });
          // Free analysis: save as a draft. Nothing is charged until the user confirms.
          const prices = pricesFromSettings(settings);
          const { data: project, error } = await supabaseAdmin
            .from("s2v_projects")
            .insert({
              user_id: user.id,
              request_key: req.requestKey,
              title: req.title,
              script: req.script,
              aspect_ratio: req.aspectRatio,
              character_id: ch.id,
              character_name: ch.name,
              character_image_path: ch.image_path,
              background_path: bgPath,
              background_summary: plan.backgroundSummary,
              plan,
              status: "draft",
              stage: "estimate",
              scene_count: plan.scenes.length,
              total_seconds: plan.scenes.length * 5,
              credits_charged: 0,
            })
            .select("id")
            .single();
          if (error || !project) throw new Error("Could not save the analysis.");
          return Response.json({ id: project.id, scenes: plan.scenes.length, estimate5: s2vBreakdown(plan.scenes.length, 5, prices), estimate10: s2vBreakdown(plan.scenes.length, 10, prices) });
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          if (e instanceof z.ZodError) return err(400, "INVALID_REQUEST", e.issues[0]?.message ?? "Invalid request");
          console.error("s2v create", e);
          return err(502, "ENGINE_ERROR", e instanceof Error ? e.message : "Could not analyse the script. No credits were charged.");
        }
      },
    },
  },
});
