import type { VoiceProfile } from "./voice-types";
import catalogJson from "../data/voices.json";

/**
 * Real prebuilt voices available on the connected engine
 * (Gemini TTS via the Lovable AI Gateway). This is the honest list of
 * genuinely distinct base timbres - there are far fewer than 400.
 */
const FEMALE_VOICES = [
  "Zephyr",
  "Kore",
  "Leda",
  "Aoede",
  "Callirrhoe",
  "Autonoe",
  "Despina",
  "Erinome",
  "Laomedeia",
  "Achernar",
  "Pulcherrima",
  "Vindemiatrix",
  "Sulafat",
  "Gacrux",
  "Sadachbia",
];

const MALE_VOICES = [
  "Puck",
  "Charon",
  "Fenrir",
  "Orus",
  "Enceladus",
  "Iapetus",
  "Umbriel",
  "Algieba",
  "Algenib",
  "Rasalgethi",
  "Alnilam",
  "Schedar",
  "Achird",
  "Zubenelgenubi",
  "Sadaltager",
];

const NEUTRAL_VOICES = [
  "Zephyr",
  "Orus",
  "Umbriel",
  "Schedar",
  "Achird",
  "Alnilam",
  "Erinome",
  "Iapetus",
  "Despina",
  "Algenib",
];

export const ENGINE_VOICE_COUNT = new Set([
  ...FEMALE_VOICES,
  ...MALE_VOICES,
  ...NEUTRAL_VOICES,
]).size;

export const SPEECH_MODEL = "google/gemini-3.1-flash-tts-preview";
const GATEWAY = "https://ai.gateway.lovable.dev";

type Catalog = {
  api: string;
  version: string;
  count: number;
  ageRange: { min: number; max: number };
  voices: VoiceProfile[];
};

const catalog = catalogJson as unknown as Catalog;

function seedOf(voiceId: string) {
  const digits = voiceId.replace(/\D/g, "");
  const n = Number(digits || "0");
  return Number.isFinite(n) ? n : 0;
}

/** Deterministic voiceId -> real engine voice mapping. Server-side only. */
const CHILD_GIRL_VOICES = ["Leda", "Zephyr", "Aoede"] as const;
const CHILD_BOY_VOICES = ["Puck", "Leda", "Zephyr"] as const;

function ageDirection(age: number, gender: string) {
  const g = gender === "Male" ? "boy" : gender === "Female" ? "girl" : "child";
  if (age <= 9) return `Voice character: a small ${g} about ${age} years old. Speak exactly like a real little kid - high-pitched, light, soft childish voice, simple innocent delivery. Absolutely NOT an adult voice.`;
  if (age <= 13) return `Voice character: a ${g} about ${age} years old, clearly a child - higher pitch, young and light voice, not an adult.`;
  if (age <= 17) return `Voice character: a teenage ${g === "child" ? "speaker" : g} about ${age} years old - youthful, lighter voice, not a grown adult.`;
  if (age >= 60) return `Voice character: an elderly ${gender.toLowerCase()} speaker about ${age} years old - older, slightly aged texture.`;
  return `Voice character: about ${age} years old, ${gender.toLowerCase()} speaker.`;
}

export function engineVoiceFor(profile: VoiceProfile): string | null {
  const pool =
    profile.gender === "Female"
      ? FEMALE_VOICES
      : profile.gender === "Male"
        ? MALE_VOICES
        : NEUTRAL_VOICES;
  if (pool.length === 0) return null;
  const seed = seedOf(profile.voiceId);
  // Children/teens use the engine's lightest, most youthful timbres so they don't sound adult.
  if (profile.age <= 17) {
    const young = profile.gender === "Male" ? CHILD_BOY_VOICES : CHILD_GIRL_VOICES;
    return young[seed % young.length] ?? null;
  }
  return pool[seed % pool.length] ?? null;
}

const GIRL_NAMES = ["Ananya","Priya","Aisha","Kavya","Meera","Riya","Sanya","Isha","Diya","Neha","Pooja","Sneha","Tara","Zara","Nisha","Aditi","Simran","Anjali","Kiara","Myra","Sara","Emma","Olivia","Sophia","Mia","Lily","Grace","Chloe","Nora","Ava"];
const BOY_NAMES = ["Aarav","Rohan","Vivaan","Arjun","Kabir","Aditya","Rahul","Vikram","Karan","Dev","Ishaan","Aryan","Sahil","Nikhil","Yash","Kunal","Rudra","Veer","Om","Advik","Liam","Noah","James","Ethan","Lucas","Leo","Ryan","Adam","Oliver","Jack"];
const SURNAMES = ["Sharma","Verma","Kapoor","Mehta","Iyer","Rao","Singh","Das","Nair","Joshi","Malhotra","Bose","Reddy","Gill","Khan"];

/** Girl name for female voices, boy name for male voices (neutral follows its engine voice). */
export function displayNameFor(profile: VoiceProfile, engineVoice: string | null): string {
  const female =
    profile.gender === "Female" ||
    (profile.gender !== "Male" && engineVoice !== null && (FEMALE_VOICES as readonly string[]).includes(engineVoice));
  const pool = female ? GIRL_NAMES : BOY_NAMES;
  const seed = seedOf(profile.voiceId);
  const first = pool[seed % pool.length];
  const last = SURNAMES[Math.floor(seed / pool.length) % SURNAMES.length];
  return `${first} ${last}`;
}

export function decorate(profile: VoiceProfile): VoiceProfile {
  const engineVoice = engineVoiceFor(profile);
  return {
    ...profile,
    engineVoice,
    engineConnected: Boolean(engineVoice),
    displayName: displayNameFor(profile, engineVoice),
  };
}

export function allVoices(): VoiceProfile[] {
  return catalog.voices;
}

export function findVoice(voiceId: string): VoiceProfile | undefined {
  return catalog.voices.find((v) => v.voiceId === voiceId);
}

export function catalogMeta() {
  return { api: catalog.api, ageRange: catalog.ageRange, count: catalog.count };
}

/** Preview/story line spoken with the profile's characteristics + locked emotion. */
export function buildSpokenPrompt(
  profile: VoiceProfile,
  text: string,
  emotion?: string | null,
  speed?: number,
  language?: string,
) {
  const lang = language ?? profile.language;
  const useEmotion = emotion || profile.emotion;
  const pace =
    speed && speed < 0.95
      ? "slightly slower than normal"
      : speed && speed > 1.05
        ? "slightly faster than normal"
        : "natural conversational pace";
  const whisper = /whisper/i.test(useEmotion) ? " Low volume, a real breathy whisper." : "";
  const performance: Record<string, string> = {
    Happy: "bright, smiling energy with a naturally lifted cadence",
    Sad: "heavy, subdued feeling with restrained grief and gentle pauses",
    Angry: "controlled anger, firm emphasis and tense breath without shouting every word",
    Fear: "audible fear, guarded breath and urgent hesitation",
    Scared: "frightened, vulnerable delivery with unstable breath",
    Crying: "tearful, breaking delivery with emotion held in the voice",
    Excited: "genuine excitement, quicker reactions and energetic emphasis",
    Surprised: "an immediate, believable shock followed by alert curiosity",
    Calm: "settled, warm and unhurried delivery",
    Serious: "grounded, focused delivery with deliberate emphasis",
    Emotional: "deep personal feeling with natural breath and restrained intensity",
    Whisper: "a close, breathy, low-volume whisper",
    Suspense: "quiet tension, measured pacing and expectant pauses",
    Dramatic: "cinematic intensity with purposeful rises, falls and pauses",
    Confused: "uncertain phrasing with questioning intonation",
    Nervous: "uneasy breath, slight hesitation and contained tension",
    Horror: "a hushed, eerie horror-storyteller delivery: slow, low and suspenseful with long pauses",
    Whispering: "a close, breathy, low-volume whisper with soft consonants",
  };
  const emotionPerformance = performance[useEmotion] ?? `${useEmotion.toLowerCase()} but natural`;
  // Structured director-notes format: the engine performs only the TRANSCRIPT,
  // so no instruction words leak into the audio.
  const tag = EMOTION_TAGS[useEmotion] ?? useEmotion.toLowerCase();
  // Profiles sharing a prebuilt timbre still get stable individual performance
  // direction. This does not invent additional engine voices or replace audio.
  const seed = seedOf(profile.voiceId);
  const textures = ['smooth and rounded', 'lightly airy', 'clear and resonant', 'softly textured', 'crisp and focused'];
  const cadences = ['flowing connected phrasing', 'measured phrase endings', 'gentle melodic inflection', 'direct even phrasing', 'softly lilting phrase endings', 'precise consonant articulation'];
  const identity = `Stable speaker signature: ${textures[seed % textures.length]}, ${cadences[Math.floor(seed / textures.length) % cadences.length]}. Keep this texture and cadence consistent across lines; the locked emotion affects expression, not identity.`;
  return [
    `Audio direction: perform this like a friendly Indian animated cartoon-story voiceover (kids/family animation channel style): clear, lively, expressive and easy to follow, never overacted, never melodramatic, no sobbing, no heavy breathing. The ONE emotion for this line is ${useEmotion.toUpperCase()}: ${emotionPerformance}. Show it LIGHTLY — about 40% intensity — through tone and emphasis only, keeping the voice clean and steady without changing the speaker's underlying timbre.${whisper}`,
    `Speaker: ${ageDirection(profile.age, profile.gender)} Language: ${lang} ONLY — every word must be spoken in ${lang}; never switch to another language mid-line. Accent: ${lang === profile.language ? profile.accent : `native ${lang}`}. Style: ${profile.style.toLowerCase()}, tone: ${profile.tone.toLowerCase()}. Pace: ${pace}, keep it moving briskly like animation narration; short pauses only. Sound like a real person, never robotic.`,
    identity,
    `Delivery: conversational storytelling rhythm, short phrase breaks at commas, a settled pause at Hindi danda (।) and full stops, and a longer expectant pause at ellipses. Avoid equal stress on every syllable, sing-song cadence, exaggerated gasps or mechanical pacing. For ${lang}, use natural native pronunciation. For Hindi, use natural Indian Hindi pronunciation, correct dental and retroflex consonants, and natural schwa deletion; do not anglicise Hindi words. Keep the same speaker identity throughout.`,
    `Speak ONLY the transcript words. Do not say the emotion name, these directions, or any extra word. Do not repeat or translate.`,
    ``,
    `TRANSCRIPT:`,
    `[${tag}] ${text}`,
  ].join("\n");
}

const EMOTION_TAGS: Record<string, string> = {
  Happy: "happily", Sad: "sadly", Angry: "angrily", Fear: "fearfully", Scared: "scared",
  Crying: "crying", Excited: "excitedly", Surprised: "surprised", Calm: "calmly", Serious: "seriously",
  Emotional: "emotionally", Whisper: "whispering", Suspense: "tense, suspenseful", Dramatic: "dramatically",
  Confused: "confused", Nervous: "nervously", Horror: "eerily", Whispering: "whispering",
};

export type SpeechResult =
  | { ok: true; body: ReadableStream<Uint8Array>; contentType: string }
  | { ok: false; status: number; error: string; message: string };

export async function generateSpeech(opts: {
  profile: VoiceProfile;
  text: string;
  emotion?: string | null | undefined;
  speed?: number | undefined;
  signal?: AbortSignal | undefined;
  language?: string | undefined;
}): Promise<SpeechResult> {
  const { resolveProvider } = await import("./api-providers.server");
  const provider = await resolveProvider("voiceover", { base: GATEWAY, model: SPEECH_MODEL });
  if (!provider) {
    return {
      ok: false,
      status: 503,
      error: "VOICE_ENGINE_NOT_CONFIGURED",
      message: "No voice engine credentials are configured on the server.",
    };
  }
  const engineVoice = engineVoiceFor(opts.profile);
  if (!engineVoice) {
    return {
      ok: false,
      status: 503,
      error: "VOICE_ENGINE_NOT_CONNECTED",
      message: `No real engine voice is connected for ${opts.profile.voiceId}.`,
    };
  }

  const prompt = buildSpokenPrompt(opts.profile, opts.text, opts.emotion, opts.speed, opts.language);

  const response = await fetch(`${provider.base}/v1/audio/speech`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.key}`,
      "Content-Type": "application/json",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: provider.model,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: engineVoice } } },
      },
      stream_format: "audio",
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (!response.ok || !response.body) {
    let message = `Voice engine returned ${response.status}.`;
    try {
      const text = await response.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
          message = parsed.error?.message || parsed.message || text.slice(0, 400);
        } catch {
          message = text.slice(0, 400);
        }
      }
    } catch {
      /* keep default message */
    }
    return {
      ok: false,
      status: response.status || 502,
      error: "VOICE_ENGINE_ERROR",
      message,
    };
  }

  return {
    ok: true,
    body: response.body,
    contentType: response.headers.get("content-type") || "audio/wav",
  };
}
