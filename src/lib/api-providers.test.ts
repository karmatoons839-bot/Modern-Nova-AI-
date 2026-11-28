import { describe, it, expect } from 'vitest';
import { pickProvider, validBaseUrl, KEY_PAGES, isSafeKeyPageUrl } from './api-providers';
const rows = [{ service: 'all_in_one', enabled: true }, { service: 'voiceover', enabled: true }, { service: 'image', enabled: false }];
describe('api providers', () => {
  it('voiceover API overrides All-in-One', () => expect(pickProvider(rows, 'voiceover')?.service).toBe('voiceover'));
  it('disabled tool API falls back to All-in-One', () => expect(pickProvider(rows, 'image')?.service).toBe('all_in_one'));
  it('no rows means built-in engine', () => expect(pickProvider([], 'thumbnail')).toBeNull());
  it('only https URLs allowed', () => { expect(validBaseUrl('http://x.com')).toBe(false); expect(validBaseUrl('https://x.com')).toBe(true); });
  it('key pages are bare https URLs that cannot carry a secret', () => {
    expect(KEY_PAGES.map(p => p.id)).toEqual(['google_ai_studio', 'elevenlabs']);
    for (const p of KEY_PAGES) {
      expect(isSafeKeyPageUrl(p.url)).toBe(true);
      expect(p.url).not.toMatch(/[?#]/);
    }
  });
  it('rejects a key page URL with a query, fragment or plain http', () => {
    expect(isSafeKeyPageUrl('https://x.com/key?key=abc')).toBe(false);
    expect(isSafeKeyPageUrl('https://x.com#token')).toBe(false);
    expect(isSafeKeyPageUrl('http://x.com')).toBe(false);
  });
});
