import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Loader2, Sparkles, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StudioSteps } from "@/components/StudioSteps";
import { VoiceBrowser } from "@/components/VoiceBrowser";
import { AGE_RANGES, useStudioSession, type CastEntry } from "@/lib/studio-session";
import { ageCategory } from "@/lib/voice-cast";
import { suggestCast } from "@/lib/story.functions";
import type { VoiceProfile } from "@/lib/voice-types";
import { Button } from '@/components/ui/button';
import { AudioPlayer } from '@/components/AudioPlayer';
import { generateVoiceAudio } from '@/lib/voice-client';
import { castIsDistinct } from '@/lib/studio-policy';

export const Route = createFileRoute("/studio/cast")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Voice Casting Studio — Modern Nova AI" },
      { name: "description", content: "AI picks a consistent real voice for every character; change any voice before generating the voiceover." },
      { property: "og:title", content: "Voice Casting Studio — Modern Nova AI" },
      { property: "og:description", content: "Automatic character voice casting with manual override." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CastPage,
});

function CastPage() {
  const navigate = useNavigate();
  const { state, ready, update } = useStudioSession();
  const suggest = useServerFn(suggestCast);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);
  const { characters, lines, cast } = state;

  // AI automatically casts every character that has no voice yet. It never
  // overwrites a voice the user already chose.
  useEffect(() => {
    if (!ready || autoTried.current || characters.length === 0) return;
    const missing = characters.filter((c) => !cast[c.name]?.voiceId);
    if (missing.length === 0) return;
    autoTried.current = true;
    setAutoBusy(true);
    setError(null);
    suggest({
      data: {
        characters: characters.map((c) => ({
          name: c.name,
          samples: lines.filter((l) => l.character === c.name).slice(0, 2).map((l) => l.text.slice(0, 240)),
        })),
        language: state.voiceLanguage ?? 'Hindi',
        storyType: state.storyType ?? 'other',
      },
    })
      .then((res) => {
        const next = { ...cast };
        for (const pick of res.cast) {
          if (!pick) continue;
          const prev = next[pick.name] ?? { gender: "any" as const, age: "Adult" as const, speed: 1 };
          if (prev.voiceId) continue;
          next[pick.name] = {
            ...prev,
            gender: pick.gender === "Male" || pick.gender === "Female" ? pick.gender : prev.gender,
            age: ageCategory(pick.age),
            voiceId: pick.voiceId,
            name: pick.displayName,
            engineVoice: pick.engineVoice,
          };
        }
        update({ cast: next });
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "AI voice selection failed. Choose voices manually."))
      .finally(() => setAutoBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, characters, cast, lines]);

  const setCast = (name: string, patch: Partial<CastEntry>) =>
    update({ cast: { ...cast, [name]: { ...(cast[name] ?? { gender: "any", age: "Adult", speed: 1 }), ...patch } } });

  const voicesReady = characters.length > 0 && characters.every((c) => cast[c.name]?.voiceId);
  const emotionsReady = lines.length > 0 && lines.every((l) => l.emotion);
  const distinct = castIsDistinct(cast, characters.map((c) => c.name));
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  async function previewCharacter(name: string) {
    const voice = cast[name];
    if (!voice?.voiceId || previewBusy) return;
    setPreviewBusy(name); setError(null);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    try {
      const line = lines.find((l) => l.character === name);
      const blob = await generateVoiceAudio({
        voiceId: voice.voiceId,
        text: line?.text?.slice(0, 200) ?? 'नमस्ते, आज मैं आपको एक कहानी सुनाऊँगा।',
        emotion: line?.emotion ?? 'Calm',
        speed: voice.speed,
        preview: true,
        language: state.voiceLanguage ?? 'Hindi',
      });
      setPreview({ name, url: URL.createObjectURL(blob) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Preview failed.'); }
    finally { setPreviewBusy(null); }
  }

  if (ready && characters.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <StudioSteps current={1} />
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Pehle script analyze karo. <Link to="/studio" className="font-semibold text-primary">Script Studio →</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <StudioSteps current={1} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Voice Casting</h1>
        <span className="text-xs text-muted-foreground">AI har character ke liye voice chunta hai · emotions automatic hain</span>
      </div>

      {autoBusy && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> AI characters samajhkar voices select kar raha hai…
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {characters.map((c) => {
          const v = cast[c.name] ?? { gender: "any" as const, age: "Adult" as const, speed: 1 };
          return (
            <article key={c.name} className="space-y-2 rounded-lg border border-border bg-card p-3 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-sm font-bold text-foreground">{c.name}</h2>
                <span className="text-[11px] text-muted-foreground">{c.lines} dialogues</span>
              </div>
              <Button variant="outline"
                type="button"
                onClick={() => setPickerFor(c.name)}
                aria-label={`Select character voice for ${c.name}`} aria-haspopup="dialog"
                className={`h-auto w-full whitespace-normal rounded-lg border px-3 py-2 text-left text-xs font-semibold transition hover:bg-accent ${v.voiceId ? "border-primary text-primary" : "border-dashed border-border text-muted-foreground"}`}
              >
                {v.voiceId ? (
                  <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5" /> {v.name} · {v.voiceId}</span>
                ) : (
                  <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Select Character Voice</span>
                )}
              </Button>
              <Button variant="outline" size="sm" disabled={!v.voiceId || Boolean(previewBusy)} onClick={() => void previewCharacter(c.name)}>
                {previewBusy === c.name ? <Loader2 className="animate-spin" /> : <Volume2 />} Preview
              </Button>
              {preview?.name === c.name && <AudioPlayer src={preview.url} filename={`${c.name}-preview.wav`} />}
            </article>
          );
        })}
      </section>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {voicesReady && !distinct && <p role="alert" className="text-sm text-destructive">Choose a different real voice for each character.</p>}
      {!emotionsReady && lines.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          AI emotions abhi sabhi dialogues par nahi lage. <Link to="/studio" className="font-semibold text-primary">Script dobara analyze karo →</Link>
        </p>
      )}
      <Button
        type="button"
        disabled={!voicesReady || !emotionsReady || !distinct || autoBusy}
        onClick={() => void navigate({ to: "/studio/voiceover" })}
        className="inline-flex h-auto w-full whitespace-normal items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        Continue to Voiceover Studio <ArrowRight className="h-4 w-4" />
      </Button>
      {!voicesReady && !autoBusy && (
        <p className="text-center text-[11px] text-muted-foreground">Har character ki voice select karo — AI ne pehle se choose ki hai, badalna ho to tap karo.</p>
      )}

      {pickerFor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-3 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-label={`Choose voice for ${pickerFor}`} className="my-6 w-full max-w-5xl rounded-lg border border-border bg-background p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-foreground">Voice: <span className="text-primary">{pickerFor}</span></h2>
              <Button variant="outline" size="icon" type="button" onClick={() => setPickerFor(null)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <VoiceBrowser
              selectedId={cast[pickerFor]?.voiceId ?? null}
              pageSize={12}
              hideEmotionFilter
              initialFilters={{
                gender: cast[pickerFor]?.gender ?? "any",
                language: state.voiceLanguage === 'English' ? 'English' : 'Hindi',
                ...AGE_RANGES[cast[pickerFor]?.age ?? "Adult"],
              }}
              onSelect={(v: VoiceProfile) => {
                if (characters.some(c => c.name !== pickerFor && cast[c.name]?.engineVoice === v.engineVoice)) {
                  setError('This real voice is already assigned to another character. Choose another voice.'); return;
                }
                setError(null);
                setCast(pickerFor, { voiceId: v.voiceId, name: v.displayName ?? v.name, engineVoice: v.engineVoice ?? null });
                setPickerFor(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
