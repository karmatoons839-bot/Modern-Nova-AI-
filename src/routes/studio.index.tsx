import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Copy, FilePlus2, Loader2, Upload, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { StudioSteps } from "@/components/StudioSteps";
import { addEmotions, analyzeStory, translateLines } from "@/lib/story.functions";
import { SCRIPT_LANGUAGES } from '@/lib/script-config';
import { readSession, writeSession, useStudioSession, type CastEntry } from "@/lib/studio-session";
import { MAX_STORY_CHARS, MAX_STORY_IMPORT_BYTES } from '@/lib/story-processing';
import { processStory, type StoryProgress } from '@/lib/story-workflow';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute("/studio/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Voice Studio — Script Studio | Modern Nova AI" },
      {
        name: "description",
        content:
          "Write or import a Hindi story script, detect characters and emotions per line, then cast voices and generate expressive voiceovers.",
      },
      { property: "og:title", content: "Voice Studio — Script Studio | Modern Nova AI" },
      {
        property: "og:description",
        content: "Write a script, detect characters and emotions, and create expressive Hindi voiceovers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScriptStudioPage,
});

function ScriptStudioPage() {
  const { t } = useI18n();
  const { session } = useAuth();
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeStory);
  const emotionAdd = useServerFn(addEmotions);
  const translate = useServerFn(translateLines);
  const { state, ready } = useStudioSession();
  const [projectName, setProjectName] = useState("");
  const [script, setScript] = useState("");
  const [voiceLanguage, setVoiceLanguage] = useState<string>('Hindi');
  const [storyType, setStoryType] = useState<'horror' | 'moral' | 'other'>('other');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState<StoryProgress | null>(null);
  const running = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!ready || loaded.current) return;
    loaded.current = true;
    // Script Studio (story generator) hand-off: "Title\nName\nDialogue" blocks → [Name] tags.
    const incoming = sessionStorage.getItem("mn-story-to-voice");
    if (incoming) {
      sessionStorage.removeItem("mn-story-to-voice");
      const [title, ...rest] = incoming.split("\n");
      const blocks = rest.join("\n").trim().split(/\n\s*\n/).filter(Boolean);
      setProjectName((title || "").trim());
      setScript(
        blocks
          .map((b) => {
            const [name, ...txt] = b.split("\n");
            const who = name?.trim() === "नैरेटर" ? "Narrator" : (name ?? "Narrator").trim();
            return `[${who}]\n${txt.join("\n").trim()}`;
          })
          .join("\n\n"),
      );
      return;
    }
    setProjectName(state.projectName);
    setScript(state.script);
    setVoiceLanguage(state.voiceLanguage ?? 'Hindi');
    setStoryType(state.storyType ?? 'other');
  }, [ready, state]);

  useEffect(() => {
    if (loaded.current) writeSession({ projectName, script, voiceLanguage, storyType });
  }, [projectName, script, voiceLanguage, storyType]);

  async function handleAnalyze() {
    if (running.current) return;
    setError(null);
    if (!session) { setError('Please sign in to analyze your script.'); return; }
    if (script.trim().length < 2) {
      setError("Pehle script likho. / Please write a script first.");
      return;
    }
    running.current = true;
    setBusy("analyze");
    try {
      // Emotions are always AI-detected; there is no manual emotion control.
      const res = await processStory(script, true,
        data => analyze({ data }), data => emotionAdd({ data }),
        value => { setBusy(value.phase); setProgress(value); });
      let { lines } = res;
      // Translate every line into the chosen voiceover language so audio never mixes languages.
      if (needsTranslation(lines.map(l => l.text), voiceLanguage)) {
        const out = [...lines];
        const batches: number[][] = [];
        let cur: number[] = [], size = 0;
        lines.forEach((l, i) => { if (cur.length >= 40 || size + l.text.length > 12000) { batches.push(cur); cur = []; size = 0; } cur.push(i); size += l.text.length; });
        if (cur.length) batches.push(cur);
        for (let b = 0; b < batches.length; b++) {
          setBusy('translate'); setProgress({ phase: 'emotions', completed: b, total: batches.length, detail: `Translating to ${voiceLanguage}…` } as StoryProgress);
          const idx = batches[b]!;
          const r = await translate({ data: { language: voiceLanguage, lines: idx.map(i => lines[i]!.text) } });
          idx.forEach((i, k) => { out[i] = { ...out[i]!, text: r.lines[k]! }; });
        }
        lines = out;
      }
      // Keep existing voice choices for characters that are still in the script.
      const prev = readSession().cast;
      const cast: Record<string, CastEntry> = {};
      const key = `${voiceLanguage}|${storyType}`;
      const same = readSession().castKey === key;
      for (const c of res.characters) cast[c.name] = (same ? prev[c.name] : undefined) ?? { gender: "any", age: "Adult", speed: 1 };
      writeSession({ lines, characters: res.characters, cast, castKey: key });
      void navigate({ to: "/studio/cast" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      running.current = false;
      setBusy(null);
      setProgress(null);
    }
  }

  const tool =
    "inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:bg-accent";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <StudioSteps current={0} />
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Script Studio</h1>

      <input
        disabled={!ready || busy !== null}
        value={projectName}
        onChange={(e) => setProjectName(e.target.value)}
        placeholder="Project name (optional)"
        aria-label="Project name"
        className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
      />
      <textarea
        disabled={!ready || busy !== null}
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={14}
        aria-label="Script"
        placeholder={"[Narrator]\nरात के बारह बजे थे...\n\n[Rohan]\nकौन है वहाँ?"}
        className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-[15px] leading-relaxed text-foreground outline-none focus:border-primary"
      />

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
        <span>{script.length.toLocaleString('en-IN')} {t('characterCount')}</span>
        {script.length > MAX_STORY_CHARS && <span className="text-destructive">{t('storyProcessingLimit')}: {MAX_STORY_CHARS.toLocaleString('en-IN')}</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button disabled={!ready || busy !== null} variant="outline" size="sm" type="button" className={tool} onClick={() => { setScript(""); setProjectName(""); setError(null); writeSession({ lines: [], characters: [], cast: {} }); }}>
          <FilePlus2 className="h-3.5 w-3.5" /> New Story
        </Button>
        <Button disabled={!ready || busy !== null} variant="outline" size="sm" type="button" className={tool} onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Import
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > MAX_STORY_IMPORT_BYTES) return setError(t('storyImportLimit'));
            try {
              const text = await f.text();
              setScript(text); setError(null);
              if (!projectName) setProjectName(f.name.replace(/\.[^.]+$/, ""));
            } catch { setError(t('storyImportFailed')); }
          }}
        />
        <Button variant="outline" size="sm"
          type="button"
          className={tool}
          disabled={!script}
          onClick={async () => {
            try { await navigator.clipboard.writeText(script); } catch { setError('Copy failed. Please select and copy your script.'); return; }
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {progress && progress.total > 0 && <div role="status" className="space-y-2 text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-between gap-2"><span>{progress.phase === 'analyze' ? t('analyzing') : t('emotionAdding')}</span><span>{progress.completed} / {progress.total} {t('storySections')}</span></div>
        <progress aria-label={t('storyProgress')} value={progress.completed} max={progress.total} className="h-2 w-full accent-primary" />
        {progress.detail && <p className="truncate text-xs text-muted-foreground">▶ {progress.detail}</p>}
      </div>}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">Voiceover language
          <select aria-label="Voiceover language" disabled={busy !== null} value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary">
            {SCRIPT_LANGUAGES.map(l => <option key={l.name} value={l.name}>{l.native === l.name ? l.name : `${l.native} (${l.name})`}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-muted-foreground">Story type (narrator voice)
          <select aria-label="Story type" disabled={busy !== null} value={storyType} onChange={(e) => setStoryType(e.target.value as 'horror' | 'moral' | 'other')} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary">
            <option value="horror">Horror — male narrator</option>
            <option value="moral">Moral — female narrator</option>
            <option value="other">Other — AI decides</option>
          </select>
        </label>
      </div>

      <Button
        type="button"
        onClick={handleAnalyze}
        disabled={!ready || busy !== null || script.length > MAX_STORY_CHARS}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        {busy === "analyze" ? "Analyzing…" : busy === "emotions" ? "AI detecting emotions…" : busy === "translate" ? `Translating to ${voiceLanguage}…` : "Analyze Script"}
      </Button>
    </div>
  );
}

/** Skip translation only when the script already clearly matches Hindi (Devanagari) or English (Latin). */
function needsTranslation(texts: string[], language: string) {
  const all = texts.join(' ');
  const deva = (all.match(/[\u0900-\u097F]/g) ?? []).length;
  const latin = (all.match(/[A-Za-z]/g) ?? []).length;
  if (language === 'Hindi') return latin > deva * 0.05;
  if (language === 'English') return deva > 0;
  return true;
}
