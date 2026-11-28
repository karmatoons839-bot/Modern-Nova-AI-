import { z } from "zod";
import { EMOTIONS } from "./voice-types";
import { SCRIPT_LANGUAGES } from "./script-config";

/** Three studio screens: script & analysis, settings & generate, live progress & final video. */
export const STUDIO_STEPS = ["Script & Analysis", "Video Settings", "Video Generation"] as const;
export const STUDIO_STYLES = [
  { id: "3d-animation", name: "3D Animation", description: "Dimensional characters and cinematic light", prompt: "High-quality 3D animated film render, dimensional characters, cinematic lighting" },
  { id: "2d-animation", name: "2D Animation", description: "Hand-drawn lines and layered environments", prompt: "2D hand-drawn animation, clean line art, layered painted backgrounds" },
  { id: "realistic", name: "Realistic", description: "Natural materials and lifelike environments", prompt: "Photorealistic live-action look, natural materials and lighting" },
  { id: "cinematic", name: "Cinematic", description: "Film composition and dramatic lighting", prompt: "Cinematic film still, dramatic lighting, anamorphic composition" },
  { id: "cartoon", name: "Cartoon", description: "Bold shapes and expressive characters", prompt: "Cartoon animation, bold shapes, expressive characters, bright colors" },
  { id: "anime", name: "Anime", description: "Illustrated characters and detailed scenery", prompt: "Anime animation style, detailed illustrated scenery, expressive characters" },
  { id: "horror", name: "Horror Animation", description: "Dark mood, fog and eerie light", prompt: "Dark horror animation, eerie fog, moody low-key lighting, suspenseful atmosphere" },
  { id: "pixar-3d", name: "Pixar-like 3D", description: "Soft, glossy family-film 3D", prompt: "Pixar-like stylized 3D family animated film, soft global illumination, big expressive eyes" },
  { id: "fantasy", name: "Fantasy", description: "Magical worlds and rich colors", prompt: "Epic fantasy animation, magical glowing environments, rich painterly colors" },
] as const;
export type StudioStyleId = (typeof STUDIO_STYLES)[number]["id"];
export function stylePrompt(id: string) { return STUDIO_STYLES.find(s => s.id === id)?.prompt ?? id; }
export const STUDIO_GENRES = ["Horror", "Moral", "Comedy", "Thriller", "Action", "Fantasy", "Adventure", "Drama"] as const;
export const studioSceneSchema = z.object({ title: z.string().max(200), description: z.string().max(3000), location: z.number().int().min(0), characters: z.array(z.number().int().min(0)).max(12), lines: z.array(z.object({ speaker: z.string().max(100), text: z.string().max(1200), emotion: z.enum(EMOTIONS).default("Calm") })).max(40) });
export const studioSchema = z.object({
  version: z.literal(2).default(2), language: z.enum(SCRIPT_LANGUAGES.map(l => l.name) as [string, ...string[]]).default("Hindi"), genre: z.enum(STUDIO_GENRES).default("Moral"),
  minutes: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(15), z.literal(20)]).default(1), description: z.string().max(20000).default(""), preferences: z.string().max(3000).default(""), instructions: z.string().max(5000).default(""),
  style: z.enum(["2d-animation", "3d-animation", "realistic", "cartoon", "anime", "cinematic", "horror", "pixar-3d", "fantasy"]).default("3d-animation"),
  styleChosen: z.boolean().default(false), autoRevision: z.number().int().default(-1), budget: z.number().int().min(0).default(0), startedAt: z.string().max(40).default(""),
  voiceOn: z.boolean().default(false), narratorVoice: z.string().max(100).default(""), voiceAssignments: z.record(z.string().max(100)).default({}), emotion: z.enum(EMOTIONS).default("Calm"), clipSeconds: z.union([z.literal(5), z.literal(10)]).default(5), aspect: z.enum(["9:16", "16:9"]).default("16:9"),
  locations: z.array(z.object({ name: z.string().max(200), description: z.string().max(2000) })).max(240).default([]),
  characters: z.array(z.object({ name: z.string().max(100), description: z.string().max(2000), gender: z.enum(["Male", "Female", "Neutral"]).default("Neutral") })).max(40).default([]),
  scenes: z.array(studioSceneSchema).max(240).default([]), revision: z.number().int().min(0).default(0), analyzedRevision: z.number().int().default(-1),
});
export type StudioData = z.infer<typeof studioSchema>;
export type StudioScene = z.infer<typeof studioSceneSchema>;
export type StudioTask = { id: string; kind: string; target: number; status: string; cost: number; error: string | null; url: string | null; operationKey: string };
export type StudioProject = { id: string; title: string; script: string; status: string; data: StudioData; tasks: StudioTask[]; finalUrl: string | null; finalDownloadUrl?: string | null; updatedAt: string };
export type StudioRates = { image: number; character: number; voicePerMinute: number; anim5: number; anim10: number; render: number };
export const STUDIO_RATES: StudioRates = { image: 375, character: 225, voicePerMinute: 375, anim5: 750, anim10: 1500, render: 75 };
export function studioQuote(q: { backgrounds: number; characters: number; frames: number; clips: number; clipSeconds: 5 | 10; voiceOn: boolean; voiceSeconds: number; render: boolean }, rates = STUDIO_RATES) {
  for (const n of [q.backgrounds, q.characters, q.frames, q.clips, q.voiceSeconds]) if (!Number.isFinite(n) || n < 0) throw new Error("Invalid generation quantity");
  const backgrounds = q.backgrounds * rates.image, characters = q.characters * rates.character, frames = q.frames * rates.image;
  const animation = q.clips * (q.clipSeconds === 10 ? rates.anim10 : rates.anim5);
  const voice = q.voiceOn ? Math.ceil(q.voiceSeconds * rates.voicePerMinute / 60) : 0;
  const render = q.render ? rates.render : 0;
  return { analysis: 0, backgrounds, characters, frames, animation, voice, render, total: backgrounds + characters + frames + animation + voice + render };
}
export function taskKey(d: StudioData, kind: string, target: number, take = 0) {
  return `r${d.revision}:${d.style}:${kind}:${target}:${kind === "animation" || kind === "voice" || kind === "frame" ? `${d.clipSeconds}:${d.aspect}:${d.voiceOn ? "voice" : "silent"}` : "ref"}:take${take}`;
}
export function isCurrentTask(d: StudioData, t: { operationKey: string; kind: string; target: number }) { return t.operationKey.startsWith(taskKey(d, t.kind, t.target).replace(/take0$/, "take")); }
export function currentTasks(d: StudioData, tasks: StudioTask[]) {
  const latest = new Map<string, StudioTask>();
  for (const t of tasks) if (isCurrentTask(d, t)) latest.set(`${t.kind}:${t.target}`, t);
  return [...latest.values()];
}
export function clipProgress(tasks: { kind: string; status: string }[], total: number) {
  const completed = tasks.filter(t => t.kind === "animation" && t.status === "completed").length;
  return { total, completed, remaining: Math.max(0, total - completed), percent: total ? Math.floor(completed / total * 100) : 0 };
}