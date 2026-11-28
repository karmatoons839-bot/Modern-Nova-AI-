import { taskKey, type StudioData, type StudioTask, type StudioRates } from "./s2v-studio";

export const SEGMENT_STRIDE = 1000;
export function continuationTarget(scene: number, segment: number) { return scene + segment * SEGMENT_STRIDE; }
export function continuationKey(d: StudioData, scene: number, segment: number, clipId: string, voiceId: string) {
  return `${taskKey(d, "animation", continuationTarget(scene, segment))}:moving:${clipId}:${voiceId}`;
}
export function continuationTasks(d: StudioData, tasks: StudioTask[], scene: number) {
  const base = [...tasks].reverse().find(t => t.kind === "animation" && t.target === scene && t.status === "completed");
  const voice = [...tasks].reverse().find(t => t.kind === "voice" && t.target === scene && t.status === "completed");
  if (!base || !voice || !d.voiceOn) return [];
  return [...new Map(tasks.filter(t => t.kind === "animation" && t.target >= SEGMENT_STRIDE && t.target % SEGMENT_STRIDE === scene && (t.operationKey === continuationKey(d, scene, Math.floor(t.target / SEGMENT_STRIDE), base.id, voice.id) || t.operationKey.startsWith(`${continuationKey(d, scene, Math.floor(t.target / SEGMENT_STRIDE), base.id, voice.id)}:retry`))).map(t=>[t.target,t])).values()].sort((a,b) => a.target-b.target);
}
export function additionalSegments(video: number, voice: number, rates: StudioRates) {
  if (!Number.isFinite(video) || video <= 0 || !Number.isFinite(voice) || voice < 0 || voice > 1200) throw new Error("Could not verify media duration");
  let remaining = voice - video;
  const segments: { seconds: 5 | 10; cost: number }[] = [];
  while (remaining > 0.05) { const seconds = remaining > 5.05 ? 10 : 5; segments.push({ seconds, cost: seconds === 10 ? rates.anim10 : rates.anim5 }); remaining -= seconds; }
  return segments;
}
export function requireMovingCoverage(video: number, voice: number, scene: number) {
  if (!Number.isFinite(video) || video <= 0 || !Number.isFinite(voice) || voice < 0) throw new Error(`Scene ${scene + 1}: media duration unavailable`);
  if (voice > video + 0.05) throw new Error(`Scene ${scene + 1}: voice is ${voice.toFixed(1)}s but moving video is ${video.toFixed(1)}s. Generate additional video before rendering. No render credits charged.`);
}
/** Spoken words per second used only for the free pre-generation estimate; real voice length is measured later. */
export const SPEECH_WORDS_PER_SECOND = 2.3;
export function sceneVoiceEstimate(lines: { text: string }[]) {
  const words = lines.map(l => l.text).join(" ").trim().split(/\s+/).filter(Boolean).length;
  return words / SPEECH_WORDS_PER_SECOND;
}
type Done = { backgrounds: number; characters: number; frames: number; clips: number; voices: number };
/** Free analysis summary + itemised quote, using the same per-item rates the server charges. */
export function planVideo(d: StudioData, rates: StudioRates, done: Done = { backgrounds: 0, characters: 0, frames: 0, clips: 0, voices: 0 }) {
  const scenes = d.scenes.length;
  let voiceSeconds = 0, extraClips = 0, extraCost = 0, extraSeconds = 0, voicedScenes = 0;
  for (const s of d.scenes) {
    const v = sceneVoiceEstimate(s.lines);
    voiceSeconds += v;
    if (v > 0) voicedScenes++;
    if (d.voiceOn && v > d.clipSeconds) for (const seg of additionalSegments(d.clipSeconds, v, rates)) { extraClips++; extraCost += seg.cost; extraSeconds += seg.seconds; }
  }
  const animationSeconds = scenes * d.clipSeconds + (d.voiceOn ? extraSeconds : 0);
  const clipRate = d.clipSeconds === 10 ? rates.anim10 : rates.anim5;
  const imagesNeeded = d.locations.length + d.characters.length + scenes;
  const images = Math.max(0, d.locations.length - done.backgrounds) * rates.image + Math.max(0, d.characters.length - done.characters) * rates.character + Math.max(0, scenes - done.frames) * rates.image;
  const animation = Math.max(0, scenes - done.clips) * clipRate + (d.voiceOn ? extraCost : 0);
  const voice = d.voiceOn ? Math.max(0, voicedScenes - done.voices) * Math.ceil(d.clipSeconds * rates.voicePerMinute / 60) : 0;
  const render = scenes ? rates.render : 0;
  return {
    scenes, clips: scenes + (d.voiceOn ? extraClips : 0), extraClips: d.voiceOn ? extraClips : 0, characters: d.characters.length, locations: d.locations.length, imagesNeeded,
    voiceSeconds: Math.round(voiceSeconds), animationSeconds, videoSeconds: Math.round(Math.max(animationSeconds, d.voiceOn ? voiceSeconds : 0)),
    cost: { analysis: 0, images, animation, voice, render, total: images + animation + voice + render },
  };
}
