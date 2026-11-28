import type { VoiceProfile } from './voice-types';

/** Automatic character → voice casting. Pure logic; the AI only classifies gender/age, selection stays deterministic. */
export type CastCharacter = { name: string; gender: 'Male' | 'Female' | 'any'; age: number };
export type CastPick = {
  name: string;
  voiceId: string;
  displayName: string;
  engineVoice: string;
  gender: string;
  age: number;
};

export type AgeCategoryName = 'Child' | 'Young' | 'Adult' | 'Elderly';

export function ageCategory(age: number): AgeCategoryName {
  if (age <= 12) return 'Child';
  if (age <= 25) return 'Young';
  if (age <= 59) return 'Adult';
  return 'Elderly';
}

const CATEGORY_RANGE: Record<AgeCategoryName, [number, number]> = {
  Child: [6, 12],
  Young: [13, 25],
  Adult: [26, 59],
  Elderly: [60, 80],
};

/**
 * Picks one real voice per character from the catalog, in character order.
 * Every character gets a distinct engine voice when the catalog allows it;
 * returns null for a character when no unused engine voice remains, so the
 * user chooses that one manually instead of two characters sharing a voice.
 */
export function pickCastVoices(
  characters: CastCharacter[],
  voices: VoiceProfile[],
  opts: {
    allowed: (voiceId: string) => boolean;
    engineOf: (profile: VoiceProfile) => string | null;
    language?: string;
  },
): (CastPick | null)[] {
  const language = opts.language ?? 'Hindi';
  const usable = voices.filter((v) => v.language === language && opts.allowed(v.voiceId) && opts.engineOf(v));
  const used = new Set<string>();

  const pick = (c: CastCharacter): CastPick | null => {
    const [lo, hi] = CATEGORY_RANGE[ageCategory(c.age)];
    const genderOk = (v: VoiceProfile) => c.gender === 'any' || v.gender === c.gender;
    const inRange = (v: VoiceProfile) => v.age >= lo && v.age <= hi;
    const byAge = (a: VoiceProfile, b: VoiceProfile) =>
      Math.abs(a.age - c.age) - Math.abs(b.age - c.age) || a.voiceId.localeCompare(b.voiceId);
    // Best match first; widen only when no unused engine voice is left.
    // A child never widens to an adult/cross-gender profile: it must keep a
    // real child voice, or wait for a manual choice instead of faking one.
    const stages =
      ageCategory(c.age) === 'Child'
        ? [usable.filter((v) => genderOk(v) && inRange(v))]
        : [
            usable.filter((v) => genderOk(v) && inRange(v)),
            usable.filter((v) => genderOk(v)),
          ];
    for (const pool of stages) {
      const fresh = [...pool].sort(byAge).find((v) => !used.has(opts.engineOf(v) as string));
      if (fresh) {
        const engineVoice = opts.engineOf(fresh) as string;
        used.add(engineVoice);
        return {
          name: c.name,
          voiceId: fresh.voiceId,
          displayName: fresh.displayName ?? fresh.name,
          engineVoice,
          gender: fresh.gender,
          age: fresh.age,
        };
      }
    }
    return null;
  };

  return characters.map(pick);
}

export type StoryType = 'horror' | 'moral' | 'other';
export const NARRATOR_NAMES = ['narrator', 'नैरेटर', 'नरेटर', 'सूत्रधार'];
export const isNarrator = (name: string) => NARRATOR_NAMES.includes(name.trim().toLocaleLowerCase());
/** Owner rule: horror stories use a male narrator, moral stories a female narrator. */
export function narratorGender(type: StoryType | undefined): 'Male' | 'Female' | null {
  return type === 'horror' ? 'Male' : type === 'moral' ? 'Female' : null;
}
