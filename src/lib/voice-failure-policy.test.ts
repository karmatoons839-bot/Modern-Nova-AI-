import { describe, it, expect } from 'vitest';
import { canRetryNeutral, isVoiceRefusal, voiceFailureAction, VoiceRequestError } from './voice-failure-policy';

describe('failed voiceover recovery', () => {
  it('stops the observed PROHIBITED_CONTENT failure instead of replaying it', () => {
    const message = 'content blocked by the provider (PROHIBITED_CONTENT)';
    expect(isVoiceRefusal(message)).toBe(true);
    expect(voiceFailureAction(new VoiceRequestError(message, 502, 'VOICE_ENGINE_ERROR'))).toBe('stop');
    expect(canRetryNeutral(502, 'VOICE_ENGINE_EMPTY_AUDIO', message)).toBe(false);
  });
  it('does not fallback or retry provider authorization and payment errors', () => {
    for (const status of [401,402,403,404]) {
      expect(voiceFailureAction(new VoiceRequestError('Provider unavailable', status, 'VOICE_ENGINE_ERROR'))).toBe('stop');
      expect(canRetryNeutral(status, 'VOICE_ENGINE_ERROR', 'Provider unavailable')).toBe(false);
    }
  });
  it('permits only bounded transient retries and reviews unknown outcomes', () => {
    expect(voiceFailureAction(new VoiceRequestError('Busy', 429, 'VOICE_ENGINE_ERROR'))).toBe('retry');
    expect(voiceFailureAction(new VoiceRequestError('Unavailable', 503, 'VOICE_ENGINE_ERROR'))).toBe('retry');
    expect(voiceFailureAction(new Error('Failed to fetch'))).toBe('review');
    expect(voiceFailureAction(new VoiceRequestError('Invalid input', 400, 'INVALID_INPUT'))).toBe('review');
  });
  it('allows Calm fallback only for a non-refusal empty-audio response', () => {
    expect(canRetryNeutral(502, 'VOICE_ENGINE_EMPTY_AUDIO', 'No audio rendered')).toBe(true);
    expect(canRetryNeutral(502, 'VOICE_ENGINE_ERROR', 'Upstream failure')).toBe(false);
  });
});