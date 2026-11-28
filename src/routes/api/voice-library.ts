import { createFileRoute } from "@tanstack/react-router";
import { allVoices, catalogMeta, decorate, findVoice } from "@/lib/voice-engine.server";

/**
 * Same query contract as the uploaded Zorvexa voice-library.js:
 * voiceId lookup, search, age (6-80) validation, gender/language/emotion
 * filters, pagination, and identical response/error shapes.
 * Extra optional filters (style, minAge/maxAge) are additive only.
 */
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/voice-library")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const u = new URL(request.url);
          const meta = catalogMeta();
          const voiceId = u.searchParams.get("voiceId");
          const search = (u.searchParams.get("search") || "").toLowerCase();
          const age = u.searchParams.get("age");
          const minAge = u.searchParams.get("minAge");
          const maxAge = u.searchParams.get("maxAge");
          const gender = u.searchParams.get("gender");
          const language = u.searchParams.get("language");
          const emotion = u.searchParams.get("emotion");
          const style = u.searchParams.get("style");

          let list = allVoices();

          if (voiceId) {
            const v = findVoice(voiceId);
            return v
              ? json({ success: true, api: meta.api, voice: decorate(v) })
              : json({ success: false, error: "VOICE_NOT_FOUND" }, 404);
          }

          if (search)
            list = list.filter((v) =>
              Object.values(decorate(v)).some((x) => String(x).toLowerCase().includes(search)),
            );

          if (age) {
            const n = Number(age);
            if (!Number.isInteger(n) || n < 6 || n > 80)
              return json({ success: false, error: "AGE_MUST_BE_BETWEEN_6_AND_80" }, 400);
            list = list.filter((v) => v.age === n);
          }

          for (const [raw, cmp] of [
            [minAge, (v: number, n: number) => v >= n],
            [maxAge, (v: number, n: number) => v <= n],
          ] as const) {
            if (!raw) continue;
            const n = Number(raw);
            if (!Number.isInteger(n) || n < 6 || n > 80)
              return json({ success: false, error: "AGE_MUST_BE_BETWEEN_6_AND_80" }, 400);
            list = list.filter((v) => cmp(v.age, n));
          }

          if (gender) list = list.filter((v) => v.gender.toLowerCase() === gender.toLowerCase());
          if (language)
            list = list.filter((v) => v.language.toLowerCase() === language.toLowerCase());
          if (emotion) list = list.filter((v) => v.emotion.toLowerCase() === emotion.toLowerCase());
          if (style) list = list.filter((v) => v.style.toLowerCase() === style.toLowerCase());

          const limit = Math.min(Math.max(Number(u.searchParams.get("limit") || 50), 1), 200);
          const page = Math.max(Number(u.searchParams.get("page") || 1), 1);
          const total = list.length;
          const items = list.slice((page - 1) * limit, page * limit).map(decorate);

          return json({
            success: true,
            api: meta.api,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            ageRange: meta.ageRange,
            voices: items,
          });
        } catch (e) {
          return json(
            {
              success: false,
              error: "VOICE_LIBRARY_ERROR",
              message: e instanceof Error ? e.message : "Unknown error",
            },
            500,
          );
        }
      },
    },
  },
});
