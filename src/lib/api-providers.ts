export const API_SERVICES = [
  { id: 'all_in_one', label: 'All-in-One API', hint: 'Used for every tool unless that tool has its own API.' },
  { id: 'voiceover', label: 'Voiceover API', hint: 'Voice Studio and story voiceovers (/v1/audio/speech).' },
  { id: 'image', label: 'Image API', hint: 'Image generator (/v1/images/generations).' },
  { id: 'thumbnail', label: 'Thumbnail API', hint: 'Thumbnail generator (/v1/images/generations).' },
] as const;
export type ApiService = (typeof API_SERVICES)[number]['id'];
export const isApiService = (v: unknown): v is ApiService => API_SERVICES.some(s => s.id === v);
/** Service override wins, then All-in-One, then the built-in engine. */
export function pickProvider<T extends { service: string; enabled: boolean }>(rows: T[], service: ApiService): T | null {
  return rows.find(r => r.enabled && r.service === service) ?? rows.find(r => r.enabled && r.service === 'all_in_one') ?? null;
}
export function validBaseUrl(url: string) {
  try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; }
}

/**
 * Provider pages where the owner reads or creates their own API key.
 * These are plain public URLs: they never carry a key, a token or any
 * credential in the path, query or fragment, and nothing is logged.
 */
export const KEY_PAGES = [
  { id: 'google_ai_studio', label: 'Google AI Studio', hint: 'Your Google AI Studio API key page', url: 'https://aistudio.google.com/apikey' },
  { id: 'elevenlabs', label: 'ElevenLabs', hint: 'Your ElevenLabs API keys page', url: 'https://elevenlabs.io/app/settings/api-keys' },
] as const;

/** True only for a bare https page URL with no credentials and no query or fragment. */
export function isSafeKeyPageUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  } catch { return false; }
}
