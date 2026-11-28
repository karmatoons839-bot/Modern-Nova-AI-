import { EMOTIONS, type StoryLine, type StoryCharacter } from './voice-types';

// Application envelope, not the model context window. Every AI request is much smaller.
export const MAX_STORY_CHARS = 500_000;
export const STORY_SECTION_CHARS = 6_000;
export const MAX_STORY_IMPORT_BYTES = MAX_STORY_CHARS * 4;
export const MAX_VOICE_LINE_CHARS = 3_000;

export function validateStory(script: string) {
  if (typeof script !== 'string' || !script.trim()) throw new Error('Please write or paste a story before analyzing.');
  if (script.length > MAX_STORY_CHARS) throw new Error(`Processing limit reached: ${MAX_STORY_CHARS.toLocaleString('en-IN')} characters. Your story has not been changed.`);
  return script;
}

/** Lossless partition: chapter/paragraph boundaries first; never overlap or discard text. */
export function splitStorySections(text: string, max = STORY_SECTION_CHARS): string[] {
  if (max < 2) throw new Error('Invalid section size.');
  const sections: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + max, text.length);
    if (end < text.length) {
      const candidate = text.slice(start, end);
      const boundary = Math.max(candidate.lastIndexOf('\n'), candidate.lastIndexOf('।'), candidate.lastIndexOf('. '), candidate.lastIndexOf(' '));
      if (boundary >= max / 2) end = start + boundary + 1;
      // Do not bisect a short casting tag at a word boundary.
      const opening = text.lastIndexOf('[', end - 1);
      const closing = text.lastIndexOf(']', end - 1);
      if (opening > closing && opening > start && end - opening < 220 && text.indexOf(']', end) < end + 220) end = opening;
      const code = text.charCodeAt(end - 1);
      if (code >= 0xD800 && code <= 0xDBFF) end -= 1;
    }
    sections.push(text.slice(start, end));
    start = end;
  }
  return sections;
}

export function storyUnits(text: string): string[] {
  const raw = text.match(/[^\n.!?।。！？]*[\n.!?।。！？]+[”’"']*|[^\n.!?।。！？]+$/g) ?? [];
  const merged: string[] = [];
  let leading = '';
  for (const unit of raw) {
    if (!/[\p{L}\p{N}]/u.test(unit)) {
      const last = merged.length - 1;
      if (last >= 0) merged[last] = (merged[last] ?? '') + unit;
      else leading += unit;
    } else { merged.push(leading + unit); leading = ''; }
  }
  if (leading) merged.push(leading);
  return merged.flatMap(line => splitStorySections(line, MAX_VOICE_LINE_CHARS));
}

/** Spoken lines: storyUnits minus blank separator units, which carry no dialogue and must never reach billing or the voice engine. storyUnits itself stays lossless for full-story preservation checks. */
export function spokenUnits(text: string): string[] {
  return storyUnits(text).filter(unit => unit.trim().length > 0);
}

/** Recognize repeated screenplay speaker headings, never arbitrary single words. */
export function screenplayTags(script: string): string {
  if (/^\s*\[[^\]\n]+\]/m.test(script)) return script;
  const rows = script.split('\n');
  const candidates = new Map<string, number>();
  rows.forEach((row, i) => {
    const name = row.trim();
    if ((!i || !rows[i - 1]?.trim()) && rows[i + 1]?.trim() && /^[\p{L}\p{M}][\p{L}\p{M} ._-]{0,59}$/u.test(name)) candidates.set(name, (candidates.get(name) ?? 0) + 1);
  });
  const names = new Set([...candidates].filter(([, count]) => count >= 2).map(([name]) => name));
  if (!names.size) return script;
  // Single-occurrence speakers qualify only within an established screenplay.
  for (const [name] of candidates) if (name !== rows[0]?.trim()) names.add(name);
  return rows.map((row, i) => names.has(row.trim()) && (!i || !rows[i - 1]?.trim()) && rows[i + 1]?.trim() ? `[${row.trim()}]` : row).join('\n');
}

export function storyCharacters(lines: StoryLine[]): StoryCharacter[] {
  const map = new Map<string, StoryCharacter>();
  for (const line of lines) {
    const entry = map.get(line.character) ?? { name: line.character, lines: 0, words: 0 };
    entry.lines += 1;
    entry.words += line.text.split(/\s+/).filter(Boolean).length;
    map.set(line.character, entry);
  }
  return [...map.values()].sort((a, b) => b.words - a.words);
}

export function emotionBatches<T extends { text: string }>(lines: T[]): T[][] {
  const result: T[][] = [];
  let batch: T[] = [], chars = 0;
  for (const line of lines) {
    if (batch.length && (batch.length >= 40 || chars + line.text.length > STORY_SECTION_CHARS)) {
      result.push(batch); batch = []; chars = 0;
    }
    batch.push(line); chars += line.text.length;
  }
  if (batch.length) result.push(batch);
  return result;
}

/** AI only labels source units: it never owns/reconstructs the dialogue text. */
export function applyCharacterLabels(units: string[], labels: unknown, known: string[] = []): StoryLine[] {
  if (!Array.isArray(labels)) throw new Error('Unexpected analysis result. Your story has not been changed.');
  const names = new Map<number, string>();
  for (const item of labels) {
    if (!item || typeof item !== 'object') continue;
    const { index, character } = item as { index?: unknown; character?: unknown };
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= units.length || typeof character !== 'string' || !character.trim() || character.length > 200 || names.has(index)) throw new Error('Incomplete analysis. Your story has not been changed.');
    const name = character.trim();
    names.set(index, known.find(k => k.toLocaleLowerCase() === name.toLocaleLowerCase()) ?? name);
  }
  if (names.size !== units.length) throw new Error('Some story lines were not analyzed. Your story has not been changed.');
  return units.map((text, index) => ({ index, text, character: names.get(index) ?? 'Narrator', emotion: null, emotionLocked: false }));
}

export function lockedEmotion(value: string) {
  return EMOTIONS.find(e => e.toLowerCase() === value.trim().toLowerCase()) ?? null;
}