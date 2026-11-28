import type { StoryLine } from './voice-types';

export const STUDIO_EMOTIONS = ['Happy', 'Sad', 'Angry', 'Scared', 'Horror', 'Crying', 'Whispering', 'Excited', 'Surprised', 'Calm', 'Suspense'] as const;

export function changeLineEmotion(lines: StoryLine[], index: number, emotion: StoryLine['emotion']) {
  return lines.map(line => line.index === index ? { ...line, emotion, emotionLocked: Boolean(emotion) } : line);
}

export function castIsDistinct(cast: Record<string, { voiceId?: string | undefined; engineVoice?: string | null }>, characters: string[]) {
  const identities = characters.map(name => cast[name]?.engineVoice);
  return identities.every(Boolean) && new Set(identities).size === characters.length;
}

export function orderedComplete<T extends { index: number; status: string }>(segments: T[], indices: number[]): T[] {
  return indices.map(index => {
    const segment = segments.find(item => item.index === index);
    if (!segment || segment.status !== 'done') throw new Error('Complete every dialogue before exporting the final audio.');
    return segment;
  });
}