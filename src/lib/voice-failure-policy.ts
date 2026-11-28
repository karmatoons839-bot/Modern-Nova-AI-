/** Provider refusals end this run; changing delivery must never bypass them. */
export function isVoiceRefusal(message: string) {
  return /PROHIBITED_CONTENT|SAFETY|RECITATION|content blocked|content refus|provider.*denied/i.test(message);
}

export class VoiceRequestError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'VoiceRequestError';
  }
}

export function voiceFailureAction(error: unknown): 'stop' | 'retry' | 'review' {
  const message = error instanceof Error ? error.message : String(error);
  if (isVoiceRefusal(message)) return 'stop';
  if (error instanceof VoiceRequestError) {
    if ([401, 402, 403, 404].includes(error.status)) return 'stop';
    return error.status === 429 || error.status >= 500 ? 'retry' : 'review';
  }
  if (/INSUFFICIENT_CREDITS|VOICE_LOCKED|LOGIN_REQUIRED|SERVER_ISSUE|ACCOUNT_SUSPENDED|PROFILE_NOT_FOUND|VOICE_NOT_FOUND|TEXT_TOO_LONG|INVALID_|Server issue/i.test(message)) return 'stop';
  // Unknown/interrupted outcomes must not start another billed request implicitly.
  return 'review';
}

export function canRetryNeutral(status: number, code: string, message: string) {
  return status === 502 && code === 'VOICE_ENGINE_EMPTY_AUDIO' && !isVoiceRefusal(message);
}