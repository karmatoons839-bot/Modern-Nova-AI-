// Shared (browser-safe) Developer API config. Server computes the real cost with apiCost().
export const FREE_API_CREDITS = 10000;
export const DEFAULT_RATE_LIMIT = 60;
export const API_BASE_PATH = "/api/public/v1";

export type ApiServiceId =
  | "story" | "story-voice" | "text-to-image" | "text-to-speech"
  | "thumbnail" | "background" | "image-editor" | "voice-changer";

export const API_SERVICES: { id: ApiServiceId; name: string; text: string; available: boolean; price: string }[] = [
  { id: "story", name: "Story Generator", text: "Generate AI-powered stories.", available: true, price: "20 + 15/min" },
  { id: "story-voice", name: "Story Voice", text: "Generate voiceovers from stories and scripts.", available: true, price: "100/min of speech" },
  { id: "text-to-image", name: "Text to Image", text: "Generate images from text prompts.", available: true, price: "50" },
  { id: "text-to-speech", name: "Text to Speech", text: "Convert text into AI voice.", available: true, price: "100/min of speech" },
  { id: "thumbnail", name: "Thumbnail Generator", text: "Generate YouTube and social media thumbnails.", available: true, price: "75" },
  { id: "background", name: "Background Generator", text: "Generate AI backgrounds.", available: true, price: "50" },
  { id: "image-editor", name: "Image Editor", text: "Edit images using AI.", available: false, price: "—" },
  { id: "voice-changer", name: "Voice Changer", text: "Transform uploaded voice into supported AI voices.", available: false, price: "—" },
];

export function apiCost(service: ApiServiceId, body: Record<string, unknown>): number {
  switch (service) {
    case "story": return 20 + (Math.min(30, Math.max(1, Number(body["duration"]) || 1)) - 1) * 15;
    case "story-voice":
    case "text-to-speech": {
      const words = String(body["text"] ?? "").trim().split(/\s+/).filter(Boolean).length;
      return Math.max(1, Math.ceil((words / 150) * 100));
    }
    case "thumbnail": return 75;
    default: return 50;
  }
}

export const EXAMPLES: Record<string, Record<string, unknown>> = {
  story: { prompt: "The Haunted Well", duration: 5, style: "horror", language: "Hindi" },
  "story-voice": { text: "Once upon a time, in a quiet village...", voice_id: "ZV001", emotion: "calm" },
  "text-to-speech": { text: "Welcome to my website!", voice_id: "ZV001" },
  "text-to-image": { prompt: "A village at night with a mysterious old house", style: "horror", width: 1024, height: 1024 },
  thumbnail: { prompt: "Scared boy in front of a haunted house", style: "horror", text: "DON'T GO IN" },
  background: { prompt: "Misty forest at dawn", style: "cinematic", width: 1536, height: 1024 },
};
