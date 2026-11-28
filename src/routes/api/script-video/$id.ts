import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CreditError, creditErrorResponse, finish, requireUser, spend } from "@/lib/credits.server";
import { advanceProject, getSettings, retryFailedScenes, S2V_BUCKET_OUT, type StoryPlan } from "@/lib/s2v.server";
import { notifyS2vVideo } from "@/lib/s2v-notify.server";
import { pricesFromSettings, s2vBreakdown } from "@/lib/s2v-pricing";

const err = (status: number, error: string, message: string) => Response.json({ error, message, detail: message }, { status });

async function owned(request: Request, id: string) {
  const user = await requireUser(request);
  const { data } = await supabaseAdmin.from("s2v_projects").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  return data;
}

async function view(projectId: string) {
  const { data: p } = await supabaseAdmin.from("s2v_projects").select("*").eq("id", projectId).single();
  const { data: scenes } = await supabaseAdmin.from("s2v_scenes").select("idx, title, description, duration_seconds, status, attempts, error_message, video_path, keyframe_path, audio_path").eq("project_id", projectId).order("idx");
  const sign = async (path: string | null) => (path ? (await supabaseAdmin.storage.from(S2V_BUCKET_OUT).createSignedUrl(path, 3600)).data?.signedUrl ?? null : null);
  return {
    id: p!.id,
    title: p!.title,
    status: p!.status,
    stage: p!.stage,
    aspectRatio: p!.aspect_ratio,
    characterName: p!.character_name,
    sceneCount: p!.scene_count,
    totalSeconds: p!.total_seconds,
    cost: p!.credits_charged,
    error: p!.error_message,
    createdAt: p!.created_at,
    finalUrl: await sign(p!.final_video_path),
    clipSeconds: p!.clip_seconds,
    draft: p!.status === "draft"
      ? await (async () => {
          const prices = pricesFromSettings(await getSettings());
          const plan = p!.plan as StoryPlan;
          return {
            characters: plan.characters,
            language: plan.language,
            scenes: plan.scenes.map((s) => ({ title: s.title, description: s.description, dialogue: s.dialogue })),
            estimate5: s2vBreakdown(plan.scenes.length, 5, prices),
            estimate10: s2vBreakdown(plan.scenes.length, 10, prices),
          };
        })()
      : null,
    scenes: await Promise.all(
      (scenes ?? []).map(async (s) => ({
        idx: s.idx,
        title: s.title,
        description: s.description,
        duration: s.duration_seconds,
        status: s.status,
        attempts: s.attempts,
        error: s.error_message,
        clipUrl: await sign(s.video_path),
        audioUrl: await sign(s.audio_path),
        frameUrl: await sign(s.keyframe_path),
      })),
    ),
  };
}

export const Route = createFileRoute("/api/script-video/$id")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const p = await owned(request, params.id);
          if (!p) return err(404, "NOT_FOUND", "Project not found.");
          if (p.status === "generating") await advanceProject(p.id);
          return Response.json(await view(p.id));
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          console.error("s2v get", e);
          return err(502, "ENGINE_ERROR", "Could not check progress. Please try again.");
        }
      },
      POST: async ({ request, params }) => {
        try {
          const p = await owned(request, params.id);
          if (!p) return err(404, "NOT_FOUND", "Project not found.");
          const body = (await request.json().catch(() => ({}))) as { action?: string; clipSeconds?: number };
          const now = new Date().toISOString();
          if (body.action === "confirm") {
            if (p.status !== "draft") return Response.json(await view(p.id)); // already confirmed: never charge twice
            const clip = body.clipSeconds === 10 ? 10 : 5;
            const plan = p.plan as StoryPlan;
            const cost = s2vBreakdown(plan.scenes.length, clip, pricesFromSettings(await getSettings())).total;
            const gid = await spend(p.user_id, "script_video", cost, (p.title || p.script).slice(0, 500), p.aspect_ratio);
            const claim = await supabaseAdmin.from("s2v_projects").update({ status: "generating", stage: "references", clip_seconds: clip, total_seconds: plan.scenes.length * clip, credits_charged: cost, generation_id: gid, updated_at: now }).eq("id", p.id).eq("status", "draft").select("id");
            if (!claim.data?.length) { await finish(gid, false, "duplicate confirm"); return Response.json(await view(p.id)); }
            const rows = plan.scenes.map((s, idx) => ({ project_id: p.id, user_id: p.user_id, idx, title: s.title, description: s.description, details: s, duration_seconds: clip }));
            const ins = await supabaseAdmin.from("s2v_scenes").insert(rows);
            if (ins.error) {
              await supabaseAdmin.from("s2v_projects").update({ status: "failed", error_message: "Could not queue scenes. Credits refunded." }).eq("id", p.id);
              await finish(gid, false, "queue failed");
            }
          } else if (body.action === "retry") {
            if (p.status !== "generating") return err(400, "NOT_RETRYABLE", "This project can't be retried.");
            await retryFailedScenes(p.id); // free: the project was charged once
          } else if (body.action === "cancel") {
            if (p.status !== "generating") return err(400, "NOT_CANCELLABLE", "This project is not running.");
            const r = await supabaseAdmin.from("s2v_projects").update({ status: "cancelled", stage: "cancelled", error_message: "Cancelled — credits refunded.", updated_at: now }).eq("id", p.id).eq("status", "generating").select("id");
            if (r.data?.length && p.generation_id) await finish(p.generation_id, false, "cancelled");
          } else if (body.action === "upload-url") {
            if (p.status !== "clips_ready" && p.status !== "completed") return err(400, "NOT_READY", "Scenes are not finished yet.");
            const path = `${p.user_id}/s2v/${p.id}/final.mp4`;
            const { data, error } = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).createSignedUploadUrl(path, { upsert: true });
            if (error || !data) return err(500, "UPLOAD_FAILED", "Could not prepare the upload.");
            return Response.json({ path, token: data.token });
          } else if (body.action === "finalize") {
            const path = `${p.user_id}/s2v/${p.id}/final.mp4`;
            const { data: files } = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).list(`${p.user_id}/s2v/${p.id}`, { search: "final.mp4" });
            const f = files?.find((x) => x.name === "final.mp4");
            const meta = (f?.metadata ?? null) as { size?: number; mimetype?: string } | null;
            const size = Number(meta?.size ?? 0);
            if (!f || size < 1000) return err(400, "NO_FILE", "The final video was not uploaded.");
            if (size > 1024 * 1024 * 1024 || (meta?.mimetype && meta.mimetype !== "video/mp4")) {
              await supabaseAdmin.storage.from(S2V_BUCKET_OUT).remove([path]);
              return err(400, "BAD_FILE", "The final video must be an MP4 under 1 GB.");
            }
            const done = await supabaseAdmin.from("s2v_projects").update({ status: "completed", stage: "ready", final_video_path: path, thumbnail_path: null, updated_at: now }).eq("id", p.id).neq("status", "completed").select("id");
            if (done.data?.length) await notifyS2vVideo(p.id).catch((e) => console.error("s2v telegram", e));
          } else if (body.action === "delete") {
            if (p.status === "generating") return err(400, "RUNNING", "Cancel the video before deleting it.");
            const { data: files } = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).list(`${p.user_id}/s2v/${p.id}`);
            if (files?.length) await supabaseAdmin.storage.from(S2V_BUCKET_OUT).remove(files.map((f) => `${p.user_id}/s2v/${p.id}/${f.name}`));
            await supabaseAdmin.storage.from(S2V_BUCKET_OUT).remove([p.background_path]);
            await supabaseAdmin.from("s2v_projects").delete().eq("id", p.id);
            return Response.json({ deleted: true });
          } else return err(400, "BAD_ACTION", "Unknown action.");
          return Response.json(await view(p.id));
        } catch (e) {
          if (e instanceof CreditError) return creditErrorResponse(e);
          console.error("s2v post", e);
          return err(500, "ERROR", "Something went wrong. Please try again.");
        }
      },
    },
  },
});
