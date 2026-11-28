import { SCRIPT_LANGUAGES } from "@/lib/script-config";
import { createFileRoute } from "@tanstack/react-router";
import { findVoice, generateSpeech } from "@/lib/voice-engine.server";
import { CreditError, finish, notifyGenerationComplete, requireUser, saveBinaryOutput, spend, userVoicePlan, voiceCost } from "@/lib/credits.server";
import { PLANS, voiceAllowed } from "@/lib/plans";
import { EMOTIONS } from '@/lib/voice-types';
import { canRetryNeutral } from '@/lib/voice-failure-policy';

const PREVIEW_MAX_CHARS = 200;

function jsonError(status: number, error: string, message: string) {
  return new Response(JSON.stringify({ success: false, error, message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/speech")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: {
          voiceId?: string;
          text?: string;
          emotion?: string | null;
          speed?: number;
          preview?: boolean;
          language?: string;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return jsonError(400, "INVALID_JSON_BODY", "Request body must be valid JSON.");
        }

        const voiceId = payload.voiceId?.trim();
        const text = payload.text?.trim();
        if (!voiceId) return jsonError(400, "VOICE_ID_REQUIRED", "A voiceId is required.");
        if (!text) return jsonError(400, "TEXT_REQUIRED", "Text to speak is required.");
        if (text.length > 4000)
          return jsonError(400, "TEXT_TOO_LONG", "Text must be 4000 characters or fewer.");
        if (payload.language != null && !SCRIPT_LANGUAGES.some(l => l.name === payload.language)) return jsonError(400, 'INVALID_LANGUAGE', 'Choose a supported voiceover language.');
        const language = payload.language ?? undefined;
        if (payload.emotion != null && !EMOTIONS.some(emotion => emotion === payload.emotion)) return jsonError(400, 'INVALID_EMOTION', 'Choose one supported emotion per dialogue.');

        const profile = findVoice(voiceId);
        if (!profile)
          return jsonError(404, "VOICE_NOT_FOUND", `No voice profile found for ${voiceId}.`);

        // Voice previews are free but capped to one short line so they cannot replace paid generation.
        const isPreview = payload.preview === true && text.length <= PREVIEW_MAX_CHARS;
        let user;
        let gid: string;
        try {
          user = await requireUser(request);
          const plan = await userVoicePlan(user.id);
          if (!voiceAllowed(voiceId, plan))
            return jsonError(403, "VOICE_LOCKED", `This voice needs a higher plan. Your ${plan} plan includes ${PLANS.find((p) => p.id === plan)?.voices} voices — upgrade to unlock it.`);
          if (isPreview) {
            const result = await generateSpeech({ profile, text, emotion: payload.emotion ?? null, speed: typeof payload.speed === "number" ? payload.speed : undefined, signal: request.signal, language });
            if (!result.ok) return jsonError(result.status, result.error, result.message);
            return new Response(result.body, { status: 200, headers: { "Content-Type": result.contentType, "Cache-Control": "no-store", "X-Voice-Id": voiceId, "X-Preview": "free" } });
          }
          gid = await spend(user.id, "voice", voiceCost(text), text, `${profile.voiceId} · ${payload.emotion ?? profile.emotion}`);
        } catch (e) {
          if (e instanceof CreditError) return jsonError(e.status, e.code, e.message);
          throw e;
        }

        try {
        const requestedEmotion = payload.emotion ?? null;
        let result = await generateSpeech({
          profile,
          text,
          emotion: requestedEmotion,
          speed: typeof payload.speed === "number" ? payload.speed : undefined,
          signal: request.signal,
          language,
        });

        // The engine occasionally renders no audio for an intense emotion on one specific
        // line. Retry that line once with a neutral delivery (same single charge) so the
        // story still gets real audio instead of a permanently failed dialogue.
        if (!result.ok && canRetryNeutral(result.status, result.error, result.message) && requestedEmotion && requestedEmotion !== 'Calm' && !request.signal.aborted) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          result = await generateSpeech({
            profile,
            text,
            emotion: 'Calm',
            speed: typeof payload.speed === "number" ? payload.speed : undefined,
            signal: request.signal,
            language,
          });
        }

        if (!result.ok) {
          await finish(gid, false, result.message);
          return jsonError(result.status, result.error, result.message);
        }
        const [responseBody, storageBody] = result.body.tee();
        const bytes = new Uint8Array(await new Response(storageBody).arrayBuffer());
        if (bytes.length < 44 || String.fromCharCode(...bytes.slice(0, 4)) !== 'RIFF') {
          await finish(gid, false, 'The voice engine returned incomplete audio.');
          return jsonError(502, 'VOICE_ENGINE_EMPTY_AUDIO', 'The voice engine returned incomplete audio.');
        }
        const outputStored = await saveBinaryOutput(user.id, gid, bytes, result.contentType);
        await finish(gid, true);
        await notifyGenerationComplete(gid, outputStored).catch(() => {});

        return new Response(responseBody, {
          status: 200,
          headers: {
            "Content-Type": result.contentType,
            "Cache-Control": "no-store",
            "X-Voice-Id": voiceId,
            "X-Generation-Id": gid,
          },
        });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Voice generation failed.';
          await finish(gid, false, message);
          return jsonError(request.signal.aborted ? 499 : 502, 'VOICE_GENERATION_FAILED', message);
        }
      },
    },
  },
});
