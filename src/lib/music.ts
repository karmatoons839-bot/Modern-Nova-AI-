/** Single source of truth for AI Music Maker pricing and options (shared by UI and server). */
export const MUSIC_CREDIT_COSTS = { 15: 50, 30: 100, 60: 200, 90: 300 } as const;
export type MusicDuration = keyof typeof MUSIC_CREDIT_COSTS;
export const MUSIC_DURATIONS = [15, 30, 60, 90] as const satisfies readonly MusicDuration[];

export const MUSIC_MOODS = ["Cinematic", "Horror", "Sad", "Happy", "Energetic", "Calm", "Suspense", "Emotional"] as const;
export const MUSIC_TYPES = ["Background Music", "Intro", "Outro", "Action", "Emotional", "Ambient"] as const;
export const MUSIC_INSTRUMENTS = ["Piano", "Guitar", "Violin", "Drums", "Flute", "Synth", "Orchestral"] as const;
export const MUSIC_PROMPT_MAX = 10000; // ~1500+ words so long, detailed music briefs fit
