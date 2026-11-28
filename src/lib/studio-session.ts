import { useEffect, useState } from "react";
import type { StoryCharacter, StoryLine } from "./voice-types";
import { useAuth } from './auth';
import { loadDraft, saveDraft } from './studio-storage';

/** Voice Studio state shared by the Script, Cast & Emotion and Voiceover pages (tab-scoped). */
export type AgeCategory = "Child" | "Young" | "Adult" | "Elderly";
export type CastEntry = {
  gender: "Male" | "Female" | "any";
  age: AgeCategory;
  voiceId?: string | undefined;
  name?: string | undefined;
  engineVoice?: string | null;
  speed: number;
};
export type StudioSession = {
  projectName: string;
  script: string;
  autoEmotions: boolean;
  voiceLanguage?: string;
  /** language+storyType the current cast was chosen for; a change re-casts. */
  castKey?: string;
  storyType?: 'horror' | 'moral' | 'other';
  lines: StoryLine[];
  characters: StoryCharacter[];
  cast: Record<string, CastEntry>;
};

export const AGE_RANGES: Record<AgeCategory, { minAge: string; maxAge: string }> = {
  Child: { minAge: "6", maxAge: "12" },
  Young: { minAge: "13", maxAge: "25" },
  Adult: { minAge: "26", maxAge: "59" },
  Elderly: { minAge: "60", maxAge: "80" },
};

const KEY = "mn-voice-studio";
const EVENT = "mn-voice-studio-change";

export const EMPTY_SESSION: StudioSession = {
  projectName: "",
  script: "",
  autoEmotions: true,
  lines: [],
  characters: [],
  cast: {},
};

export function readSession(): StudioSession {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? { ...EMPTY_SESSION, ...(JSON.parse(raw) as Partial<StudioSession>) } : EMPTY_SESSION;
  } catch {
    return EMPTY_SESSION;
  }
}

export function writeSession(patch: Partial<StudioSession>) {
  const next = { ...readSession(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
  return next;
}

/** Reads after hydration so SSR markup never depends on browser storage. */
export function useStudioSession() {
  const { session, ready: authReady } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<StudioSession>(EMPTY_SESSION);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    const accountKey = 'mn-voice-studio-account';
    const owner = sessionStorage.getItem(accountKey);
    if (owner && owner !== userId) sessionStorage.removeItem(KEY);
    if (userId) sessionStorage.setItem(accountKey, userId);
    else sessionStorage.removeItem(accountKey);
    const sync = () => {
      const next = readSession();
      setState(next);
      if (userId) void saveDraft(userId, next).catch(() => {});
    };
    const restore = async () => {
      if (userId && !sessionStorage.getItem(KEY)) {
        const draft = await loadDraft(userId).catch(() => undefined);
        if (active && draft) writeSession(draft);
      }
      if (active) { sync(); setReady(true); }
    };
    void restore();
    window.addEventListener(EVENT, sync);
    return () => { active = false; window.removeEventListener(EVENT, sync); };
  }, [userId, authReady]);
  return { state, ready, update: writeSession };
}
