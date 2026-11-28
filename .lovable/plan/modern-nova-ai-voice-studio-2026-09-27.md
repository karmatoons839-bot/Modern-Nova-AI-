# Modern Nova AI — Voice Studio

A light, white-background voice studio app named **Modern Nova AI**, built from your uploaded studio layout, with the Zorvexa 400-voice library wired to a real voice engine.

## What you get

**Voice Library (400 profiles)**
- All 400 profiles from your ZIP, unchanged: voiceId, name, age (6–80), gender, language, accent, style, tone, emotion.
- Search box + filters: age (exact or range), gender, language, emotion, style.
- Each card shows an honest badge saying whether a real engine voice backs it, and which shared base timbre it uses — no fake "400 unique voices" claim.
- Click a voice to select it; click Preview to hear it.

**Real preview, no fake audio**
- Preview speaks a short story line out loud in that profile's emotion (e.g. a sad line delivered sadly, an angry line delivered angrily), generated live by the real voice engine.
- Audio plays in a player with play/pause and download.
- If a profile has no real engine voice behind it, you get a clear API error message instead of any sound. Nothing is faked or simulated.

**Story Studio with two separate buttons**
- **Analyze** — reads the whole story, detects every character and narrator, and builds a list below with line count and word count per character. Each character row gets its own voice picker (search the 400-voice library from inside the row) plus speed control.
- **Emotion Add** — a separate action that tags each line with one emotion, shown line by line so you can correct any of them. Once a line has an emotion it is locked to that one emotion, and generation uses exactly that emotion for that line — nothing else gets mixed in.
- Generate builds the audio line by line using each line's own character voice and locked emotion, then plays the assembled result. Real progress per line, real failures reported per line.

**Look and feel**
- White background, light theme throughout, Modern Nova AI branding.
- Language toggle so the interface can be read in English or Hinglish.
- Works on phone and desktop: single-column stacked studio on mobile, side-by-side script + character panel on desktop.

## Honest limits

The real voice engine offers around 30 genuinely distinct natural voices. All 400 profiles work, but several profiles share the same underlying base voice with different age/emotion/style/tone delivery. Every card states this plainly.

## Technical notes

- ZIP contents copied in as-is: `api/voices.json` (400 records) and the `voice-library.js` query contract. The same query behaviour (voiceId lookup, search, age 6–80 validation, gender/language/emotion filters, pagination, and its exact response shape including `AGE_MUST_BE_BETWEEN_6_AND_80` and `VOICE_NOT_FOUND`) is exposed through a TanStack server route so the API structure is unchanged.
- voiceId → real engine voice mapping lives server-side only, never in the browser.
- Text-to-speech through the Lovable AI Gateway (`google/gemini-3.1-flash-tts-preview`) with emotion/age/style instructions per line; `LOVABLE_API_KEY` stays in the backend environment. Gateway errors (402/403/429/5xx) surface as real status messages, never silent fallback audio.
- Routes: `/` studio, `/voices` library, `/projects`, `/settings`, each with its own page metadata.
- Story analysis and emotion tagging run server-side over the script text; emotion tags are stored per line and passed verbatim into generation.
