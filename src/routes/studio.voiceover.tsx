import { Link, createFileRoute } from '@tanstack/react-router';
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, Volume2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Button } from '@/components/ui/button';
import { StudioSteps } from '@/components/StudioSteps';
import { authHeaders, useAuth, useRefreshProfile } from '@/lib/auth';
import { useStudioSession } from '@/lib/studio-session';
import { generateVoiceAudio } from '@/lib/voice-client';
import { mergeWavUrls } from '@/lib/wav';
import { orderedComplete, castIsDistinct } from '@/lib/studio-policy';
import { loadAudio, saveAudio, type SavedSegment } from '@/lib/studio-storage';
import { isVoiceRefusal, voiceFailureAction } from '@/lib/voice-failure-policy';

export const Route = createFileRoute('/studio/voiceover')({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: 'Voiceover Studio — Modern Nova AI' },
    { name: 'description', content: 'Generate the complete story voiceover with AI-detected emotions, live progress and a single ordered MP3/WAV export.' },
    { property: 'og:title', content: 'Voiceover Studio — Modern Nova AI' },
    { property: 'og:description', content: 'Real parallel dialogue generation and one complete voiceover export.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: VoiceoverPage,
});

type Segment = SavedSegment & { url?: string };

/** Bounded parallel dialogue generation: fast, but never a request storm. */
const CONCURRENCY = 20;
/** One automatic retry per failed dialogue; further retries are explicit. */
const MAX_ATTEMPTS = 2;

function probeDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = url;
  });
}

function fmtDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')} min`;
}

function VoiceoverPage() {
  const { state, ready } = useStudioSession();
  const { session } = useAuth();
  const refreshProfile = useRefreshProfile();
  const userId = session?.user.id;
  const { lines, characters, cast, projectName } = state;
  const fingerprint = JSON.stringify({ lines, cast });
  const [segments, setSegments] = useState<Segment[]>([]);
  const [generating, setGenerating] = useState(false);
  const [restored, setRestored] = useState(false);
  const [combining, setCombining] = useState(false);
  const [finalUrl, setFinalUrl] = useState<string>();
  const [wavUrl, setWavUrl] = useState<string>();
  const [duration, setDuration] = useState<number>(0);
  const [historyId, setHistoryId] = useState<string>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [recoveryWarning, setRecoveryWarning] = useState<string>();
  const segmentsRef = useRef<Segment[]>([]);
  const urls = useRef<string[]>([]);
  const attempts = useRef(new Map<number, number>());
  const stopRequested = useRef(false);
  const lock = useRef(false);
  const combineLock = useRef(false);
  const title = projectName || 'Voice Studio';
  const ok = lines.length > 0 && lines.every(l => l.emotion && cast[l.character]?.voiceId) && castIsDistinct(cast, characters.map(c => c.name));

  const objectUrl = (blob: Blob) => { const url = URL.createObjectURL(blob); urls.current.push(url); return url; };
  const replace = (next: Segment[]) => { segmentsRef.current = next; setSegments(next); };
  async function persist(next: Segment[], final?: Blob, id?: string, finalWav?: Blob) {
    if (!userId) return;
    try { await saveAudio(userId, { fingerprint, segments: next.map(({ url: _url, ...s }) => s), ...(final ? { final } : {}), ...(finalWav ? { finalWav } : {}), ...(id ? { historyId: id } : {}) }); }
    catch { setRecoveryWarning('Device recovery could not be saved. Keep this page open until downloading your audio.'); }
  }

  useEffect(() => {
    if (!ready) return;
    let active = true;
    setRestored(false); setFinalUrl(undefined); setWavUrl(undefined); setDuration(0); setSaved(false); setHistoryId(undefined);
    attempts.current.clear();
    replace(lines.map(l => ({ ...l, status: 'pending' })));
    async function restore() {
      const recovery = userId ? await loadAudio(userId).catch(() => undefined) : undefined;
      if (!active) return;
      if (recovery?.fingerprint === fingerprint) {
        replace(recovery.segments.map(s => ({ ...s, ...(s.status === 'running' ? {status:'error' as const,error:'Previous request was interrupted. Check History before retrying to avoid a duplicate charge.'} : {}), ...(s.blob ? {url:objectUrl(s.blob)} : {}) })));
        if (recovery.final) {
          const url = objectUrl(recovery.final);
          setFinalUrl(url);
          void probeDuration(url).then(setDuration);
        }
        if (recovery.finalWav) setWavUrl(objectUrl(recovery.finalWav));
        setHistoryId(recovery.historyId); setSaved(Boolean(recovery.historyId));
      }
      setRestored(true);
    }
    void restore();
    return () => { active = false; };
  }, [fingerprint, ready, userId]);
  useEffect(() => () => urls.current.forEach(url => URL.revokeObjectURL(url)), []);
  useEffect(() => {
    if (!generating && !combining) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [generating, combining]);

  async function combine(next: Segment[]) {
    if (combineLock.current) return;
    combineLock.current = true;
    setCombining(true); setError(undefined);
    try {
      const ordered = orderedComplete(next, lines.map(l => l.index));
      const wav = await mergeWavUrls(ordered.map(s => { if (!s.url) throw new Error('Dialogue audio is unavailable.'); return s.url; }));
      const { wavToMp3 } = await import('@/lib/studio-audio');
      const mp3 = await wavToMp3(wav);
      const mp3Url = objectUrl(mp3);
      setWavUrl(objectUrl(wav));
      setFinalUrl(mp3Url);
      const [seconds] = await Promise.all([probeDuration(mp3Url), persist(next, mp3, historyId, wav)]);
      setDuration(seconds);
      const form = new FormData();
      form.append('audio', mp3, 'voiceover.mp3'); form.append('title', title);
      form.append('script', ordered.map(s => `${s.character}: ${s.text}`).join('\n'));
      if (historyId) form.append('generationId', historyId);
      const response = await fetch('/api/voice-full', { method: 'POST', headers: await authHeaders(), body: form });
      const result = await response.json() as { success: boolean; id?: string; message?: string };
      if (result.id) { setHistoryId(result.id); await persist(next, mp3, result.id, wav); }
      if (!response.ok || !result.success) throw new Error(result.message || 'Audio is ready, but saving to History failed.');
      setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Final audio export failed.'); }
    finally { setCombining(false); combineLock.current = false; }
  }

  /** Parallel workers: each pulls the next pending dialogue, retries a failure once, never touches completed lines. */
  async function generate(indices: number[]) {
    if (!ok || !userId || lock.current || !restored) return;
    lock.current = true; setGenerating(true); setError(undefined);
    stopRequested.current = false;
    let next = [...segmentsRef.current];
    const queue = indices.filter(index => {
      const segment = next.find(s => s.index === index);
      return segment && segment.status !== 'done' && !isVoiceRefusal(segment.error ?? '');
    });
    const worker = async () => {
      while (queue.length > 0 && !stopRequested.current) {
        const index = queue.shift() as number;
        const segment = next.find(s => s.index === index);
        if (!segment || segment.status === 'done') continue;
        const voice = cast[segment.character];
        if (!voice?.voiceId) continue;
        next = next.map(s => s.index === index ? {...s, status:'running', error:undefined} : s);
        replace(next);
        // A hung request must become a retryable failure, never an endless wait.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120000);
        try {
          const blob = await generateVoiceAudio({voiceId:voice.voiceId,text:segment.text,emotion:segment.emotion,speed:voice.speed,language:state.voiceLanguage ?? 'Hindi',signal:controller.signal});
          next = next.map(s => s.index === index ? {...s, status:'done', blob, url:objectUrl(blob), error:undefined} : s);
          replace(next); await persist(next); void refreshProfile();
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Voice generation failed.';
          const action = voiceFailureAction(e);
          if (action === 'stop') stopRequested.current = true;
          const tries = (attempts.current.get(index) ?? 0) + 1;
          attempts.current.set(index, tries);
          if (action === 'retry' && !stopRequested.current && tries < MAX_ATTEMPTS) {
            next = next.map(s => s.index === index ? {...s, status:'pending', error:undefined} : s);
            replace(next);
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
            queue.push(index);
            continue;
          }
          next = next.map(s => s.index === index ? {...s, status:'error', error:message} : s);
          replace(next); await persist(next);
        } finally { clearTimeout(timer); }
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.max(1, Math.min(CONCURRENCY, queue.length)) }, worker));
      if (next.length && next.every(s => s.status === 'done')) await combine(next);
    } finally { setGenerating(false); lock.current = false; void refreshProfile(); }
  }

  if (ready && !ok) return <div className="mx-auto max-w-3xl space-y-4"><StudioSteps current={2} /><p className="text-sm text-muted-foreground">Pehle har character ki voice select karo — emotions AI khud lagata hai. <Link to="/studio/cast" className="text-primary">Voice Casting →</Link></p></div>;

  const total = segments.length;
  const done = segments.filter(s => s.status === 'done').length;
  const failed = segments.filter(s => s.status === 'error');
  const runningList = segments.filter(s => s.status === 'running');
  const remaining = total - done;
  const refused = segments.some(s => isVoiceRefusal(s.error ?? ''));
  const retryable = segments.filter(s => s.status === 'pending' || s.status === 'error');
  const allDone = total > 0 && done === total;
  const completed = Boolean(finalUrl) && !generating && !combining;
  // 100% only when the final combined voiceover actually exists.
  const pct = total === 0 ? 0 : completed ? 100 : Math.min(99, Math.round((done / total) * 100));

  return <div className="mx-auto max-w-3xl space-y-4">
    <StudioSteps current={2} />
    <h1 className="font-display text-2xl font-bold text-foreground">Voiceover Studio</h1>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display font-semibold text-foreground">{title}</h2><span className="text-sm text-muted-foreground">{lines.length} dialogues</span></div>
    {!userId && <p className="text-sm text-muted-foreground">Sign in to generate audio. <Link to="/auth" className="text-primary">Sign in</Link></p>}

    <Button className="h-auto w-full py-3" disabled={!userId || !restored || generating || combining || refused || !retryable.length} onClick={() => void generate(retryable.map(s => s.index))}>
      {generating ? <Loader2 className="animate-spin" /> : <Volume2 />}
      {generating ? 'Generating…' : completed ? 'Voiceover Complete' : done ? 'Resume Generation' : 'Generate Complete Voiceover'}
    </Button>

    <section aria-live="polite" className="space-y-2 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-sm font-bold text-foreground">
          {completed ? 'Generation Completed' : combining ? 'Merging complete voiceover…' : generating ? 'Generating Voice' : 'Generation Progress'}
        </h2>
        <span className="font-mono text-lg font-bold text-primary">{pct}%</span>
      </div>
      <progress aria-label="Voice generation progress" className="studio-progress h-2 w-full accent-primary" max={100} value={pct} />
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
        <span>{done}/{total} dialogues completed</span>
        <span>{remaining} remaining</span>
      </div>
      {runningList.length > 0 && (
        <div className="space-y-1 text-sm text-foreground">
          {runningList.map(s => <p key={s.index}>Currently generating: Dialogue {s.index + 1} – {s.character}</p>)}
        </div>
      )}
      {combining && <p className="text-sm text-muted-foreground">Combining all dialogues in order and encoding MP3…</p>}
      {completed && <p className="flex items-center gap-1.5 text-sm font-semibold text-primary"><CheckCircle2 className="h-4 w-4" /> Complete voiceover ready{saved ? ' · Saved to History' : ''}</p>}
      {failed.length > 0 && !generating && <p className="text-xs text-destructive">{failed.length} dialogue(s) failed — completed audio is safe; retry only the failed ones.</p>}
    </section>

    {error && <p role="alert" className="flex gap-2 text-sm text-destructive"><AlertCircle className="shrink-0" />{error}</p>}
    {refused && <p role="alert" className="text-sm text-destructive">The voice provider blocked this content. Generation has stopped; completed audio is safe. This story cannot be exported as complete while a dialogue is blocked.</p>}
    {recoveryWarning && <p role="alert" className="text-sm text-destructive">{recoveryWarning}</p>}
    {allDone && !generating && !combining && !saved && <Button variant="outline" onClick={() => void combine(segmentsRef.current)}>Retry final export / save</Button>}

    {finalUrl && <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display font-semibold text-foreground">Complete Voiceover</h2>
        <span className="text-xs text-muted-foreground">Total duration: {fmtDuration(duration)}</span>
      </div>
      <AudioPlayer src={finalUrl} filename={`${title}.mp3`} />
      <div className="flex flex-wrap gap-2">
        <a href={finalUrl} download={`${title}.mp3`} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground transition hover:opacity-90">
          <Download className="h-3.5 w-3.5" /> Download Full Voiceover (MP3)
        </a>
        {wavUrl && <a href={wavUrl} download={`${title}.wav`} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-foreground transition hover:bg-accent">
          <Download className="h-3.5 w-3.5" /> Download WAV
        </a>}
      </div>
    </section>}

    <section className="border-y border-border py-5">
      <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /><h2 className="font-display font-semibold">Story cast</h2><span className="ml-auto text-xs text-muted-foreground">{characters.length} characters</span></div>
      <div className="mt-3 divide-y divide-border">{characters.map(character => {
        const parts = segments.filter(s => s.character === character.name);
        return <div key={character.name} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{character.name}</span><span className="text-muted-foreground">{parts.filter(s => s.status === 'done').length}/{parts.length} ready</span></div>;
      })}</div>
    </section>
    {failed.length > 0 && !generating && <section className="space-y-3 border-l-2 border-destructive pl-4">
      <h2 className="text-sm font-semibold">Generation needs attention</h2>
      {[...new Set(failed.map(s => s.error).filter(Boolean))].map(message => <p key={message} role="alert" className="break-words text-xs text-destructive">{message}</p>)}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={combining || refused} onClick={() => void generate(failed.map(s => s.index))}><RefreshCw />Retry failed parts</Button>
        {failed.some(s => /VOICE_LOCKED/i.test(s.error ?? '')) && <Button asChild variant="outline" size="sm"><Link to="/studio/cast">Review character voices</Link></Button>}
      </div>
    </section>}
  </div>;
}
