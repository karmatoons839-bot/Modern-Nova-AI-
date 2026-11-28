import { authHeaders } from "./auth";
import type { VoiceLibraryResponse, VoiceProfile } from "./voice-types";
import { isServiceIssue } from "./maintenance-policy";
import { VoiceRequestError } from './voice-failure-policy';

export type VoiceQuery = {
  search?: string;
  gender?: string;
  language?: string;
  emotion?: string;
  style?: string;
  age?: string;
  minAge?: string;
  maxAge?: string;
  page?: number;
  limit?: number;
};

export async function fetchVoices(query: VoiceQuery): Promise<VoiceLibraryResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "" || v === "any") continue;
    params.set(k, String(v));
  }
  const res = await fetch(`/api/voice-library?${params.toString()}`);
  const body = (await res.json()) as VoiceLibraryResponse | { success: false; error: string };
  if (!res.ok || body.success !== true) {
    const err = body as { error?: string };
    throw new Error(err.error || `VOICE_LIBRARY_ERROR (${res.status})`);
  }
  return body;
}

export async function fetchVoice(voiceId: string): Promise<VoiceProfile> {
  const res = await fetch(`/api/voice-library?voiceId=${encodeURIComponent(voiceId)}`);
  const body = (await res.json()) as
    | { success: true; voice: VoiceProfile }
    | { success: false; error: string };
  if (!res.ok || body.success !== true) throw new Error("VOICE_NOT_FOUND");
  return body.voice;
}

/** Generates real audio for a voiceId. Throws the engine's real error message. */
export async function generateVoiceAudio(input: {
  voiceId: string;
  text: string;
  emotion?: string | null;
  speed?: number;
  preview?: boolean;
  language?: string;
  signal?: AbortSignal;
}): Promise<Blob> {
  const res = await fetch("/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      voiceId: input.voiceId,
      text: input.text,
      emotion: input.emotion ?? null,
      speed: input.speed,
      preview: input.preview === true,
      ...(input.language ? { language: input.language } : {}),
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });

  if (!res.ok) {
    let error = `VOICE_ENGINE_ERROR (${res.status})`;
    let message = "";
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      error = body.error || error;
      message = body.message || "";
    } catch {
      /* non-JSON error */
    }
    throw new VoiceRequestError(`${isServiceIssue(res.status) ? "Server issue. " : ""}${message ? `${error}: ${message}` : error}`, res.status, error);
  }

  const blob = await res.blob();
  if (blob.size === 0) throw new Error("VOICE_ENGINE_EMPTY_AUDIO: engine returned no audio.");
  return blob;
}

export const PREVIEW_LINES: Record<string, { en: string; hi: string }> = {
  Happy: {
    en: "The doors opened, and the whole street was waiting for us with flowers.",
    hi: "Darwaaza khula, aur poori gali phoolon ke saath hamara intezaar kar rahi thi.",
  },
  Sad: {
    en: "I kept her letter in my pocket for years, and never read the last line.",
    hi: "Uska khat saalon tak jeb mein rakha, aur aakhri line kabhi padhi hi nahi.",
  },
  Angry: {
    en: "You knew the truth all along, and you let me walk into that room alone.",
    hi: "Tumhe sach pata tha, aur tumne mujhe akela us kamre mein jaane diya.",
  },
  Fear: {
    en: "Something moved behind the curtain, and the light went out on its own.",
    hi: "Parde ke peeche kuch hila, aur roshni apne aap bujh gayi.",
  },
  Scared: {
    en: "Don't go inside. I can hear it breathing near the stairs.",
    hi: "Andar mat jao. Mujhe seedhiyon ke paas uski saans sunai de rahi hai.",
  },
  Crying: {
    en: "I am still standing at that station, waiting for a train that left long ago.",
    hi: "Main aaj bhi us station par khada hoon, ek train ka intezaar karte hue jo kab ki ja chuki.",
  },
  Excited: {
    en: "We did it! The signal is live, and the whole valley can hear us now.",
    hi: "Ho gaya! Signal live hai, aur poori ghaati ab humein sun sakti hai.",
  },
  Surprised: {
    en: "Wait, that is my name written on the very first page of this diary.",
    hi: "Ruko, is diary ke pehle hi panne par mera naam likha hai.",
  },
  Calm: {
    en: "Sit here a while. The river tells this story better than I ever could.",
    hi: "Thodi der yahan baitho. Yeh kahani nadi mujhse behtar sunati hai.",
  },
  Serious: {
    en: "Listen carefully. What happens after midnight cannot be undone.",
    hi: "Dhyaan se suno. Aadhi raat ke baad jo hoga, use badla nahi ja sakta.",
  },
  Emotional: {
    en: "After twenty winters, my father finally said the words out loud.",
    hi: "Bees sardiyon ke baad, mere pita ne aakhirkar woh baat zubaan se keh di.",
  },
  Whisper: {
    en: "Come closer. They must not hear what I am about to tell you.",
    hi: "Paas aao. Jo main batane ja raha hoon, woh unhe sunai nahi dena chahiye.",
  },
  Suspense: {
    en: "The footsteps stopped right outside the door, and then nothing at all.",
    hi: "Kadmon ki aawaz theek darwaze ke bahar ruk gayi, aur phir bilkul sannata.",
  },
  Dramatic: {
    en: "This city buried my name once. Tonight, it will learn to say it again.",
    hi: "Is shehar ne ek baar mera naam dafn kiya tha. Aaj raat use phir kehna seekhna padega.",
  },
  Confused: {
    en: "But I locked that gate myself. So who opened it before sunrise?",
    hi: "Lekin woh gate maine khud band kiya tha. To suraj ugne se pehle kisne khola?",
  },
  Nervous: {
    en: "My hands are shaking. I have only one chance to say this right.",
    hi: "Mere haath kaanp rahe hain. Mujhe yeh sahi kehne ka ek hi mauka hai.",
  },
};

export function previewLineFor(profile: VoiceProfile, lang: "en" | "hi") {
  const entry = PREVIEW_LINES[profile.emotion] ?? PREVIEW_LINES["Calm"]!;
  return profile.language.toLowerCase() === "hindi" ? entry.hi : entry[lang === "hi" ? "hi" : "en"];
}
