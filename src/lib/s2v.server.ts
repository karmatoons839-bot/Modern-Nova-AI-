/**
 * Script-to-Video engine (server only).
 * Pipeline per project:
 *   1. planScript   — gpt-6-astra reads the whole script + the uploaded background
 *                     image and returns ordered, meaning-based scenes (≤ max_scenes).
 *   2. keyframe     — gpt-image edit composes the SELECTED character reference +
 *                     the background reference into a scene-specific first frame,
 *                     so every scene starts from the same character identity.
 *   3. animate      — gemini-omni image-to-video animates that keyframe with the
 *                     scene's action/expression/camera instructions (real motion).
 *   4. clips are stored privately; the browser joins them in order (user choice).
 * State lives in s2v_projects / s2v_scenes so work resumes after the user leaves.
 */
import { editImage, generateResponse } from "@lovable.dev/ai-gateway";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { finish } from "@/lib/credits.server";
import { createVideo, downloadVideo, pollVideo } from "@/lib/video-engine.server";
import { allVoices, engineVoiceFor, generateSpeech } from "@/lib/voice-engine.server";

/** Picks a real Voice Studio voice that fits the selected character's category. */
function voiceForCategory(category: string, language: string) {
  const want = (v: { age: number; gender: string }) =>
    category === "female" ? v.gender === "Female" && v.age >= 20 && v.age <= 50
    : category === "child" ? v.age <= 12
    : category === "old" ? v.age >= 60
    : v.gender === "Male" && v.age >= 20 && v.age <= 50;
  const usable = allVoices().filter((v) => engineVoiceFor(v) && want(v));
  return usable.find((v) => v.language.toLowerCase() === language.toLowerCase()) ?? usable[0] ?? allVoices().find((v) => engineVoiceFor(v));
}

/** Scene voiceover through the existing Voice Studio engine (included in the Script-to-Video price). */
async function sceneVoiceover(scene: { idx: number }, details: ScenePlan, project: { id: string; user_id: string; character_id: string | null }, language: string) {
  if (!details.dialogue.trim()) return null;
  const { data: ch } = await supabaseAdmin.from("s2v_characters").select("category").eq("id", project.character_id ?? "").maybeSingle();
  const profile = voiceForCategory(ch?.category ?? "male", language || "Hindi");
  if (!profile) throw new Error("No voice is available for this character.");
  const res = await generateSpeech({ profile, text: details.dialogue, emotion: null });
  if (!res.ok) throw new Error(`Voiceover failed: ${res.message}`);
  const bytes = new Uint8Array(await new Response(res.body).arrayBuffer());
  if (bytes.byteLength < 500) throw new Error("Voiceover came back empty.");
  const ext = res.contentType.includes("mpeg") ? "mp3" : "wav";
  const path = `${project.user_id}/s2v/${project.id}/voice-${scene.idx}.${ext}`;
  const up = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).upload(path, bytes, { contentType: res.contentType, upsert: true });
  if (up.error) throw new Error("Could not store the voiceover.");
  return path;
}

export const S2V_BUCKET_CHARS = "s2v-characters";
export const S2V_BUCKET_OUT = "generations";
const MAX_ATTEMPTS = 3;
const STALE_MS = 4 * 60 * 1000;

export type ScenePlan = {
  title: string;
  description: string;
  action: string;
  pose: string;
  position: string;
  expression: string;
  movement: string;
  environment: string;
  camera: string;
  cameraMovement: string;
  lighting: string;
  dialogue: string;
  emotion: string;
  transition: string;
  duration: number;
};

export type StoryPlan = {
  language: string;
  backgroundSummary: string;
  characters: string[];
  scenes: ScenePlan[];
};

export async function getSettings() {
  const { data } = await supabaseAdmin.from("s2v_settings").select("*").eq("id", 1).single();
  return data!;
}

function responseText(res: unknown): string {
  const r = res as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof r.output_text === "string" && r.output_text) return r.output_text;
  return (r.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("");
}

function clampScene(s: Partial<ScenePlan>): ScenePlan {
  const str = (v: unknown, n = 600) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const d = Math.round(Number(s.duration) || 5);
  return {
    title: str(s.title, 120) || "Scene",
    description: str(s.description, 1200),
    action: str(s.action),
    pose: str(s.pose),
    position: str(s.position),
    expression: str(s.expression),
    movement: str(s.movement),
    environment: str(s.environment),
    camera: str(s.camera),
    cameraMovement: str(s.cameraMovement),
    lighting: str(s.lighting),
    dialogue: str(s.dialogue, 400),
    emotion: str(s.emotion, 60),
    transition: str(s.transition, 120),
    duration: Math.min(10, Math.max(3, d)),
  };
}

export async function planScript(opts: {
  title: string;
  script: string;
  characterName: string;
  characterDescription: string;
  bgBase64: string;
  bgMime: string;
  maxScenes: number;
}): Promise<StoryPlan> {
  const instructions = `You are a film director turning a written story into an animated short.
Read the WHOLE script first. Identify main/supporting characters, locations, key events, dialogue, emotions and the order of events.
Split the story into between 1 and ${opts.maxScenes} scenes by MEANING (events and turning points), never by word count. Keep the original order and do not skip important events; merge minor beats into the nearest scene when the limit is reached.
The protagonist is always the selected character: "${opts.characterName}" (${opts.characterDescription}). Other characters may appear only as background/silhouettes.
The attached image is the user's background reference. Describe its environment and keep every scene in that same environment (vary composition and camera angle, not the place).
Each scene duration must be an integer 3-10 seconds matching the beat.
Return ONLY JSON: {"language":"<script language>","backgroundSummary":"<1-2 sentences>","characters":["..."],"scenes":[{"title","description","action","pose","position","expression","movement","environment","camera","cameraMovement","lighting","dialogue","emotion","transition","duration"}]}.
"dialogue" = the exact short line spoken in the scene in the script's own language (or "" if none). Write all other fields in English.`;
  const res = await generateResponse({
    model: "openai/gpt-6-astra",
    instructions,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `Title: ${opts.title || "(untitled)"}\n\nSCRIPT:\n${opts.script}` },
          { type: "input_image", image_url: `data:${opts.bgMime};base64,${opts.bgBase64}`, detail: "auto" },
        ],
      },
    ],
    store: false,
    reasoning: { effort: "medium" },
  } as Parameters<typeof generateResponse<"openai/gpt-6-astra">>[0]);
  const text = responseText(res);
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  let parsed: Partial<StoryPlan>;
  try {
    parsed = JSON.parse(json) as Partial<StoryPlan>;
  } catch {
    throw new Error("The script could not be understood. Please try again.");
  }
  const scenes = (parsed.scenes ?? []).slice(0, opts.maxScenes).map(clampScene).filter((s) => s.description);
  if (!scenes.length) throw new Error("No scenes could be created from this script.");
  return {
    language: String(parsed.language ?? ""),
    backgroundSummary: String(parsed.backgroundSummary ?? "").slice(0, 600),
    characters: Array.isArray(parsed.characters) ? parsed.characters.map(String).slice(0, 12) : [],
    scenes,
  };
}

export function scenePrompt(s: ScenePlan, characterDescription: string, bgSummary: string, language: string) {
  return [
    `3D animated cinematic shot. ${s.description}`,
    `Main character (keep identical to the first frame: same face, hair, clothing, body proportions): ${characterDescription}.`,
    `Action: ${s.action}. Body movement: ${s.movement}. Pose: ${s.pose}. Facial expression: ${s.expression}. Emotion: ${s.emotion}.`,
    `Environment (same place throughout): ${bgSummary} ${s.environment}`,
    `Camera: ${s.camera}; camera movement: ${s.cameraMovement}. Lighting: ${s.lighting}.`,
    s.dialogue ? `The character is speaking these ${language || "script"} lines with natural lip movement (the voice track is added separately): "${s.dialogue}"` : "No dialogue; natural ambient sound.",
    "Natural, fluid character animation. Do not change the character's design.",
  ].join("\n");
}

async function bytes(bucket: string, path: string) {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) throw new Error("A reference image is missing.");
  return data;
}

async function makeKeyframe(sceneDetails: ScenePlan, project: { character_image_path: string; background_path: string; aspect_ratio: string; background_summary: string }, characterDescription: string) {
  const [charBlob, bgBlob] = await Promise.all([bytes(S2V_BUCKET_CHARS, project.character_image_path), bytes(S2V_BUCKET_OUT, project.background_path)]);
  const res = await editImage({
    model: "openai/gpt-image-2.5-sunburst",
    image: [new Blob([charBlob], { type: charBlob.type || "image/jpeg" }), new Blob([bgBlob], { type: bgBlob.type || "image/jpeg" })],
    prompt: `Create one cinematic 3D animated film frame.
Image 1 is the CHARACTER reference: reproduce this exact character (same face, hair style and color, clothing, body proportions, art style). Do not redesign them.
Image 2 is the ENVIRONMENT reference: place the scene in this same location (${project.background_summary}), with a new composition and camera angle that fits the moment.
Scene: ${sceneDetails.description}
Character position: ${sceneDetails.position}. Pose: ${sceneDetails.pose}. Expression: ${sceneDetails.expression}. Action starting: ${sceneDetails.action}.
Camera: ${sceneDetails.camera}. Lighting: ${sceneDetails.lighting}. Character notes: ${characterDescription}. No text, no captions.`,
    size: project.aspect_ratio === "9:16" ? "1024x1536" : "1536x1024",
    quality: "medium",
    output_format: "jpeg",
  });
  const b64 = (res as { data?: Array<{ b64_json?: string }> }).data?.[0]?.b64_json;
  if (!b64) throw new Error("The scene frame could not be created.");
  return b64;
}

type SceneRow = { id: string; project_id: string; user_id: string; idx: number; details: unknown; duration_seconds: number; status: string; provider_job_id: string | null; attempts: number; updated_at: string; audio_path: string | null };

async function startScene(scene: SceneRow, project: Awaited<ReturnType<typeof loadProject>>) {
  const details = scene.details as ScenePlan;
  const { data: ch } = await supabaseAdmin.from("s2v_characters").select("description").eq("id", project.character_id ?? "").maybeSingle();
  const charDesc = ch?.description || project.character_name;
  try {
    const audioPath = scene.audio_path ?? (await sceneVoiceover(scene, details, project, (project.plan as StoryPlan | null)?.language ?? ""));
    if (audioPath !== scene.audio_path) await supabaseAdmin.from("s2v_scenes").update({ audio_path: audioPath }).eq("id", scene.id);
    const b64 = await makeKeyframe(details, project, charDesc);
    const kfPath = `${project.user_id}/s2v/${project.id}/scene-${scene.idx}.jpg`;
    await supabaseAdmin.storage.from(S2V_BUCKET_OUT).upload(kfPath, Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), { contentType: "image/jpeg", upsert: true });
    const plan = project.plan as StoryPlan | null;
    const job = await createVideo({
      mode: "image",
      prompt: scenePrompt(details, charDesc, project.background_summary, plan?.language ?? "").slice(0, 4000),
      aspectRatio: project.aspect_ratio as "16:9" | "9:16",
      duration: scene.duration_seconds,
      style: "animation",
      imageData: b64,
      imageMime: "image/jpeg",
    });
    await supabaseAdmin.from("s2v_scenes").update({ status: "rendering", keyframe_path: kfPath, provider_job_id: job.id, error_message: null, updated_at: new Date().toISOString() }).eq("id", scene.id);
  } catch (e) {
    await failScene(scene, e instanceof Error ? e.message : "Scene generation failed.");
  }
}

async function failScene(scene: SceneRow, message: string) {
  await supabaseAdmin.from("s2v_scenes").update({ status: "failed", attempts: scene.attempts + 1, error_message: message.slice(0, 400), updated_at: new Date().toISOString() }).eq("id", scene.id);
}

async function loadProject(id: string) {
  const { data } = await supabaseAdmin.from("s2v_projects").select("*").eq("id", id).single();
  return data!;
}

/** One bounded step of work. Safe to call concurrently (claims are conditional updates). */
export async function advanceProject(projectId: string) {
  let project = await loadProject(projectId);
  if (!["generating"].includes(project.status)) return project;
  const { data: scenes } = await supabaseAdmin.from("s2v_scenes").select("*").eq("project_id", projectId).order("idx");
  const list = (scenes ?? []) as SceneRow[];
  const now = Date.now();

  // Recover scenes stuck mid-keyframe (e.g. a request was cut off).
  for (const s of list)
    if (s.status === "keyframing" && now - new Date(s.updated_at).getTime() > STALE_MS)
      await supabaseAdmin.from("s2v_scenes").update({ status: "pending", updated_at: new Date().toISOString() }).eq("id", s.id).eq("status", "keyframing");

  // Poll renders.
  await Promise.all(
    list.filter((s) => s.status === "rendering" && s.provider_job_id).map(async (s) => {
      try {
        const remote = await pollVideo(s.provider_job_id!);
        if (remote.status === "failed") return failScene(s, remote.error?.message ?? "Animation failed.");
        if (remote.status !== "completed") return;
        const claimed = await supabaseAdmin.from("s2v_scenes").update({ status: "saving", updated_at: new Date().toISOString() }).eq("id", s.id).eq("status", "rendering").select("id");
        if (!claimed.data?.length) return;
        const mp4 = await downloadVideo(s.provider_job_id!);
        const path = `${project.user_id}/s2v/${project.id}/scene-${s.idx}.mp4`;
        const up = await supabaseAdmin.storage.from(S2V_BUCKET_OUT).upload(path, mp4, { contentType: "video/mp4", upsert: true });
        if (up.error) throw new Error("Could not store the scene clip.");
        await supabaseAdmin.from("s2v_scenes").update({ status: "completed", video_path: path, updated_at: new Date().toISOString() }).eq("id", s.id);
      } catch (e) {
        await supabaseAdmin.from("s2v_scenes").update({ status: "rendering" }).eq("id", s.id).eq("status", "saving");
        if (!(e instanceof Error && /busy|429/i.test(e.message))) console.error("s2v poll", s.id, e);
      }
    }),
  );

  // Claim up to 2 pending scenes for keyframe + animation start.
  const pending = list.filter((s) => s.status === "pending").slice(0, 2);
  await Promise.all(
    pending.map(async (s) => {
      const claimed = await supabaseAdmin.from("s2v_scenes").update({ status: "keyframing", updated_at: new Date().toISOString() }).eq("id", s.id).eq("status", "pending").select("id");
      if (claimed.data?.length) await startScene(s, project);
    }),
  );

  // Settle project.
  const { data: fresh } = await supabaseAdmin.from("s2v_scenes").select("status, attempts").eq("project_id", projectId);
  const all = fresh ?? [];
  const exhausted = all.some((s) => s.status === "failed" && s.attempts >= MAX_ATTEMPTS);
  if (all.length && all.every((s) => s.status === "completed")) {
    const r = await supabaseAdmin.from("s2v_projects").update({ status: "clips_ready", stage: "combining", updated_at: new Date().toISOString() }).eq("id", projectId).eq("status", "generating").select("id");
    if (r.data?.length && project.generation_id) await finish(project.generation_id, true);
  } else if (exhausted) {
    const r = await supabaseAdmin.from("s2v_projects").update({ status: "failed", stage: "failed", error_message: "A scene failed after several attempts. Your credits were refunded.", updated_at: new Date().toISOString() }).eq("id", projectId).eq("status", "generating").select("id");
    if (r.data?.length && project.generation_id) await finish(project.generation_id, false, "scene failed");
  } else {
    const stage = all.some((s) => s.status === "rendering" || s.status === "saving") ? "animating" : "references";
    await supabaseAdmin.from("s2v_projects").update({ stage, updated_at: new Date().toISOString() }).eq("id", projectId);
  }
  project = await loadProject(projectId);
  return project;
}

export async function retryFailedScenes(projectId: string) {
  await supabaseAdmin.from("s2v_scenes").update({ status: "pending", provider_job_id: null, error_message: null, updated_at: new Date().toISOString() }).eq("project_id", projectId).eq("status", "failed").lt("attempts", MAX_ATTEMPTS);
}

/** Cron driver: a few active projects per run, so work continues while users are away. */
export async function tickActiveProjects() {
  const { data } = await supabaseAdmin.from("s2v_projects").select("id").eq("status", "generating").order("updated_at").limit(3);
  for (const p of data ?? []) await advanceProject(p.id).catch((e) => console.error("s2v tick", p.id, e));
  return { advanced: data?.length ?? 0 };
}
