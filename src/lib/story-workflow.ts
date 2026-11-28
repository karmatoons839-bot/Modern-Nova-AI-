import type { StoryLine } from './voice-types';
import { emotionBatches, screenplayTags, splitStorySections, storyCharacters, validateStory } from './story-processing';

type AnalyzeRequest = { script: string; tagged: boolean; knownCharacters: string[]; previousText: string; continuationCharacter: string; continuationEmotion: string | null };
type AnalyzeResult = { lines: StoryLine[]; continuationCharacter: string; continuationEmotion: string | null };
type EmotionResult = { emotions: { index: number; emotion: string | null }[]; missing: number[] };
export type StoryProgress = { phase: 'analyze' | 'emotions'; completed: number; total: number; detail?: string };

/** Bounded server requests; sections stay sequential for continuity, emotion batches run 3 at a time. Commits the complete story only after success. */
export async function processStory(script: string, autoEmotions: boolean, analyze: (data: AnalyzeRequest) => Promise<AnalyzeResult>, emotions: (data: { lines: StoryLine[]; previousText: string }) => Promise<EmotionResult>, progress: (value: StoryProgress) => void) {
  validateStory(script);
  const voiceScript = screenplayTags(script);
  const sections = splitStorySections(voiceScript);
  const tagged = /^\s*\[[^\]\n]+\]/m.test(voiceScript);
  const lines: StoryLine[] = [];
  let continuationCharacter = 'Narrator', continuationEmotion: string | null = null, previousText = '';
  const knownCharacters: string[] = [];
  progress({ phase: 'analyze', completed: 0, total: sections.length });
  for (const [index, section] of sections.entries()) {
    progress({ phase: 'analyze', completed: index, total: sections.length, detail: section.trim().slice(0, 60) });
    const result = await analyze({ script: section, tagged, knownCharacters, previousText, continuationCharacter, continuationEmotion });
    for (const line of result.lines) {
      lines.push({ ...line, index: lines.length });
      if (!knownCharacters.includes(line.character)) knownCharacters.push(line.character);
    }
    continuationCharacter = result.continuationCharacter;
    continuationEmotion = result.continuationEmotion;
    previousText = section.slice(-1500);
    progress({ phase: 'analyze', completed: index + 1, total: sections.length });
  }
  if (autoEmotions) {
    const batches = emotionBatches(lines.filter(l => !l.emotion));
    progress({ phase: 'emotions', completed: 0, total: batches.length });
    let next = 0, completed = 0;
    const worker = async () => {
      while (next < batches.length) {
        const i = next++;
        const batch = batches[i]!;
        const first = batch[0];
        const last = batch[batch.length - 1];
        progress({ phase: 'emotions', completed, total: batches.length, detail: `Lines ${(first?.index ?? 0) + 1}–${(last?.index ?? 0) + 1} · “${(first?.text.trim() ?? '').slice(0, 40)}…”` });
        const result = await emotions({ lines: batch, previousText: first ? lines.slice(Math.max(0, first.index - 3), first.index).map(l => l.text).join('').slice(-1500) : '' });
        if (result.missing.length) throw new Error('Some emotions could not be detected. Your original story is preserved. Try again or turn automatic emotions off.');
        for (const entry of result.emotions) {
          const line = lines[entry.index];
          if (line && !line.emotion && entry.emotion) {
            line.emotion = entry.emotion as StoryLine['emotion']; line.emotionLocked = true;
          }
        }
        completed++;
        progress({ phase: 'emotions', completed, total: batches.length });
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, batches.length) }, worker));
  }
  return { lines, characters: storyCharacters(lines) };
}