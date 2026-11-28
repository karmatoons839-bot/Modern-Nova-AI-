import { SCRIPT_LANGUAGES } from './script-config';
import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { EMOTIONS, type StoryLine } from './voice-types';
import { applyCharacterLabels, emotionBatches, lockedEmotion, MAX_STORY_CHARS, splitStorySections, spokenUnits, storyCharacters, validateStory } from './story-processing';
import { isNarrator, narratorGender, pickCastVoices, type StoryType } from './voice-cast';
import { voiceAllowed } from './plans';

type AnalysisInput = { script: string; tagged?: boolean; continuationCharacter?: string; continuationEmotion?: string | null; knownCharacters?: string[]; previousText?: string };

/** Tagged source is authoritative; continued blocks retain their original speaker. */
function taggedLines(script: string, character = 'Narrator', emotion: string | null = null) {
  const lines: StoryLine[] = [];
  const blocks = script.split(/(?=^\s*\[[^\]\n]+\])/m);
  for (const block of blocks) {
    if (!block.trim()) continue; // blank separator between tagged blocks
    const tag = block.match(/^\s*\[([^\]\n]+)\][ \t]*(?:\r?\n)?/);
    if (tag) {
      const parts = (tag[1] ?? '').split('|').map(p => p.trim());
      character = parts[0] || 'Narrator';
      emotion = parts.slice(1).map(lockedEmotion).find(Boolean) ?? null;
    }
    const body = tag ? block.slice(tag[0].length) : block;
    for (const text of spokenUnits(body)) {
      lines.push({ index: lines.length, character, text, emotion: lockedEmotion(emotion ?? ''), emotionLocked: Boolean(emotion) });
    }
  }
  return { lines, continuationCharacter: character, continuationEmotion: emotion };
}

export const analyzeStory = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AnalysisInput) => {
    const script = validateStory(data?.script);
    const knownCharacters = data.knownCharacters ?? [];
    if (knownCharacters.length > 2000 || knownCharacters.some(n => typeof n !== 'string' || n.length > 200)) throw new Error('Invalid cast context.');
    return { ...data, script, knownCharacters, previousText: (data.previousText ?? '').slice(-1500) };
  })
  .handler(async ({ data, context }) => {
    const { requireGenerationAvailable } = await import('./maintenance.server');
    await requireGenerationAvailable(context.userId);
    const { astraText, extractJson } = await import('./ai.server');
    const sections = splitStorySections(data.script);
    const lines: StoryLine[] = [];
    const known = [...data.knownCharacters];
    let previousText = data.previousText;
    let character = data.continuationCharacter ?? 'Narrator';
    let emotion = data.continuationEmotion ?? null;
    const tagged = data.tagged ?? /^\s*\[[^\]\n]+\]/m.test(data.script);
    for (const section of sections) {
      let next: StoryLine[];
      if (tagged) {
        const result = taggedLines(section, character, emotion);
        next = result.lines; character = result.continuationCharacter; emotion = result.continuationEmotion;
      } else {
        const units = spokenUnits(section);
        const raw = await astraText([
          'Assign a speaker to EVERY numbered source unit for voice-over casting. Return ONLY a JSON array of {"index":number,"character":string}.',
          'Use Narrator for narration and chapter headings. Never rewrite text. Keep character names exactly as written, including Hindi and other Indian languages.',
          'A unit may continue a dialogue from the previous section. Reuse established names; descriptions and quoted narration are not new speakers.',
        ].join(' '), JSON.stringify({ knownCharacters: known, previousText, units: units.map((text, index) => ({ index, text })) }));
        next = applyCharacterLabels(units, extractJson(raw), known);
      }
      for (const line of next) {
        lines.push({ ...line, index: lines.length });
        if (!known.includes(line.character)) known.push(line.character);
      }
      previousText = section.slice(-1500);
    }
    if (!lines.length) throw new Error('No lines could be detected in this story.');
    return { lines, characters: storyCharacters(lines), source: tagged ? 'script-tags' as const : 'ai' as const, continuationCharacter: character, continuationEmotion: emotion };
  });

export const addEmotions = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lines: { index: number; character: string; text: string }[]; previousText?: string }) => {
    const lines = data?.lines;
    if (!Array.isArray(lines) || !lines.length) throw new Error('Analyze the story first, then add emotions.');
    if (lines.some(l => !Number.isInteger(l.index) || typeof l.text !== 'string' || typeof l.character !== 'string') || new Set(lines.map(l => l.index)).size !== lines.length) throw new Error('Invalid story lines.');
    if (lines.reduce((n, l) => n + l.text.length, 0) > MAX_STORY_CHARS) throw new Error('Story processing limit reached. Your story has not been changed.');
    return { lines, previousText: (data.previousText ?? '').slice(-1500) };
  })
  .handler(async ({ data, context }) => {
    const { requireGenerationAvailable } = await import('./maintenance.server');
    await requireGenerationAvailable(context.userId);
    const { astraText, extractJson } = await import('./ai.server');
    const emotions: { index: number; emotion: typeof EMOTIONS[number] | null }[] = [];
    let previousText = data.previousText;
    for (const batch of emotionBatches(data.lines)) {
      const raw = await astraText(`Tag every line with exactly one emotion for voice-over. Allowed: ${EMOTIONS.join(', ')}. Return ONLY a JSON array of {"index":number,"emotion":string}. Cover every index in order. Previous text is context only.`, JSON.stringify({ previousText, lines: batch }));
      const parsed = extractJson(raw);
      if (!Array.isArray(parsed)) throw new Error('Emotion tagging returned unexpected data.');
      const byIndex = new Map<number, typeof EMOTIONS[number]>();
      for (const item of parsed) {
        if (!item || typeof item !== 'object') continue;
        const o = item as { index?: unknown; emotion?: unknown };
        const emotion = typeof o.emotion === 'string' ? lockedEmotion(o.emotion) : null;
        if (typeof o.index === 'number' && emotion) byIndex.set(o.index, emotion);
      }
      emotions.push(...batch.map(l => ({ index: l.index, emotion: byIndex.get(l.index) ?? null })));
      previousText = batch.map(l => l.text).join('').slice(-1500);
    }
    return { emotions, missing: emotions.filter(e => !e.emotion).map(e => e.index) };
  });

/**
 * Automatic character voice casting: the AI only classifies each character's
 * gender/age from the dialogue; the deterministic picker then assigns real
 * plan-allowed Hindi voices with distinct engine voices. Free analysis aid —
 * no credits are spent here.
 */
export const suggestCast = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { characters?: { name: string; samples: string[] }[]; language?: string; storyType?: string }) => {
    const characters = data?.characters;
    if (!Array.isArray(characters) || !characters.length || characters.length > 100) throw new Error('Analyze the story first, then voices can be suggested.');
    for (const c of characters) {
      if (!c || typeof c.name !== 'string' || !c.name.trim() || c.name.length > 200) throw new Error('Invalid character list.');
      if (!Array.isArray(c.samples) || c.samples.length > 3 || c.samples.some(s => typeof s !== 'string' || s.length > 300)) throw new Error('Invalid character samples.');
    }
    const language = SCRIPT_LANGUAGES.some(l => l.name === data.language) ? (data.language as string) : 'Hindi';
    const storyType = data.storyType === 'horror' || data.storyType === 'moral' ? data.storyType : 'other';
    return { language, storyType, characters: characters.map(c => ({ name: c.name.trim(), samples: c.samples.map(s => s.slice(0, 300)) })) };
  })
  .handler(async ({ data, context }) => {
    const { requireGenerationAvailable } = await import('./maintenance.server');
    await requireGenerationAvailable(context.userId);
    const { astraText, extractJson, AiError } = await import('./ai.server');
    const { allVoices, decorate } = await import('./voice-engine.server');
    const { userVoicePlan } = await import('./credits.server');
    const plan = await userVoicePlan(context.userId);

    const classified = new Map<string, { gender: 'Male' | 'Female' | 'any'; age: number }>(
      data.characters.map(c => [c.name, { gender: 'any', age: 30 }]),
    );
    try {
      const raw = await astraText(
        [
          'For each story character, decide the speaker gender (Male or Female) and realistic age in years (6-80) for voice casting.',
          'Judge from the character name and dialogue. A Narrator is an adult (30-45). Children are 6-12, teenagers 13-17, elderly 60+.',
          'Return ONLY a JSON array of {"name":string,"gender":"Male"|"Female","age":number}. Cover every character exactly once, keeping the exact same name.',
        ].join(' '),
        JSON.stringify({ characters: data.characters }),
      );
      const parsed = extractJson(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const o = item as { name?: unknown; gender?: unknown; age?: unknown };
          if (!o || typeof o.name !== 'string') continue;
          const key = data.characters.find(c => c.name.toLocaleLowerCase() === (o.name as string).trim().toLocaleLowerCase())?.name;
          if (!key) continue;
          const gender = o.gender === 'Male' || o.gender === 'Female' ? o.gender : 'any';
          const age = typeof o.age === 'number' && Number.isFinite(o.age) ? Math.min(80, Math.max(6, Math.round(o.age))) : 30;
          classified.set(key, { gender, age });
        }
      }
    } catch (e) {
      // Provider denials (auth, workspace credits, rate limits, service unavailable) must
      // reach the user; only transient/parse failures fall back to safe adult defaults.
      if (e instanceof AiError && [401, 402, 403, 429, 503].includes(e.status)) throw e;
      /* AI classification unavailable: safe adult defaults still give real voices. */
    }

    const forced = narratorGender(data.storyType as StoryType);
    if (forced) for (const c of data.characters) if (isNarrator(c.name)) classified.set(c.name, { gender: forced, age: classified.get(c.name)?.age ?? 35 });
    const voices = allVoices().map(decorate);
    const picks = pickCastVoices(
      data.characters.map(c => ({ name: c.name, ...(classified.get(c.name) ?? { gender: 'any' as const, age: 30 }) })),
      voices,
      { allowed: id => voiceAllowed(id, plan), engineOf: v => v.engineVoice ?? null, language: data.language === 'English' ? 'English' : 'Hindi' },
    );
    return { cast: picks };
  });
/** Free translation of already-analyzed dialogue into the chosen voiceover language, one output per input line. */
export const translateLines = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lines?: string[]; language?: string }) => {
    
    if (!data || !SCRIPT_LANGUAGES.some(l => l.name === data.language)) throw new Error('Choose a supported voiceover language.');
    if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > 60 || data.lines.some(l => typeof l !== 'string' || l.length > 4000)) throw new Error('Invalid lines.');
    if (data.lines.join('').length > 24000) throw new Error('Too much text in one section.');
    return { lines: data.lines, language: data.language as string };
  })
  .handler(async ({ data, context }) => {
    const { requireGenerationAvailable } = await import('./maintenance.server');
    await requireGenerationAvailable(context.userId);
    const { astraText, extractJson, AiError } = await import('./ai.server');
    const raw = await astraText(
      `Translate each story dialogue line into natural spoken ${data.language} using its native script. Keep meaning, emotion, names and punctuation pauses. Output must be 100% ${data.language} — no words from any other language except proper names. If a line is already fully ${data.language}, return it unchanged. Return ONLY a JSON array of strings with exactly ${data.lines.length} items in the same order.`,
      JSON.stringify(data.lines),
    );
    const parsed = extractJson(raw);
    if (!Array.isArray(parsed) || parsed.length !== data.lines.length || parsed.some(x => typeof x !== 'string' || !x.trim()))
      throw new AiError(502, 'Translation returned an incomplete result. Please analyze again.');
    return { lines: (parsed as string[]).map(s => s.trim().slice(0, 4000)) };
  });
