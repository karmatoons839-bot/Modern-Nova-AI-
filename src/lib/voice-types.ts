export type VoiceProfile = {
  voiceId: string;
  name: string;
  age: number;
  gender: "Male" | "Female" | "Neutral" | string;
  language: string;
  accent: string;
  style: string;
  tone: string;
  emotion: string;
  emotionSupport: boolean;
  status: string;
  generationCapable: boolean;
  /** Added by the server: the real engine voice backing this profile. */
  engineVoice?: string | null;
  engineConnected?: boolean;
  /** Added by the server: a human first/last name matching the voice gender. */
  displayName?: string;
};

export type VoiceLibraryResponse = {
  success: true;
  api: string;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ageRange: { min: number; max: number };
  voices: VoiceProfile[];
};

export type VoiceLibraryError = {
  success: false;
  error: string;
  message?: string;
};

export const EMOTIONS = [
  "Happy",
  "Sad",
  "Angry",
  "Fear",
  "Scared",
  "Crying",
  "Excited",
  "Surprised",
  "Calm",
  "Serious",
  "Emotional",
  "Whisper",
  "Suspense",
  "Dramatic",
  "Confused",
  "Nervous",
  "Horror",
  "Whispering",
] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type StoryLine = {
  index: number;
  character: string;
  text: string;
  emotion: Emotion | null;
  emotionLocked: boolean;
};

export type StoryCharacter = {
  name: string;
  lines: number;
  words: number;
};
