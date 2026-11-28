import { AlertCircle, Check, Loader2, Search, Volume2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { useI18n } from "@/lib/i18n";
import { useProfile } from "@/lib/auth";
import { voiceAllowed } from "@/lib/plans";
import { Link } from "@tanstack/react-router";
import { fetchVoices, generateVoiceAudio, previewLineFor } from "@/lib/voice-client";
import { EMOTIONS, type VoiceProfile } from "@/lib/voice-types";

const GENDERS = ["Female", "Male", "Neutral"];
const LANGUAGES = ["Hindi", "English"];
const STYLES = [
  "Natural",
  "Storytelling",
  "Dramatic",
  "Calm",
  "Energetic",
  "Cinematic",
  "Narrative",
  "Conversational",
];

type Filters = {
  search: string;
  gender: string;
  language: string;
  emotion: string;
  style: string;
  minAge: string;
  maxAge: string;
};

const EMPTY: Filters = {
  search: "",
  gender: "any",
  language: "any",
  emotion: "any",
  style: "any",
  minAge: "6",
  maxAge: "80",
};

export function VoiceBrowser({
  selectedId,
  onSelect,
  pageSize = 24,
  initialFilters,
  hideEmotionFilter = false,
}: {
  selectedId?: string | null;
  onSelect?: (voice: VoiceProfile) => void;
  pageSize?: number;
  initialFilters?: Partial<Filters>;
  /** Voice Studio casting hides the emotion filter: dialogue emotions are AI-detected, never user-picked. */
  hideEmotionFilter?: boolean;
}) {
  const { t, lang } = useI18n();
  const { data: me } = useProfile();
  const plan = me?.is_admin ? "premium" : (me?.plan ?? "free");
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initialFilters });
  const [debounced, setDebounced] = useState<Filters>({ ...EMPTY, ...initialFilters });
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(filters);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchVoices({ ...debounced, page, limit: pageSize })
      .then((res) => {
        if (cancelled) return;
        setVoices((prev) => (page === 1 ? res.voices : [...prev, ...res.voices]));
        setTotal(res.total);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "VOICE_LIBRARY_ERROR");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, page, pageSize]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const hasMore = voices.length < total;

  const ageLabel = useMemo(() => `${filters.minAge}-${filters.maxAge}`, [filters]);

  async function preview(voice: VoiceProfile) {
    setPreviewError(null);
    setPreviewId(voice.voiceId);
    setPreviewLoading(voice.voiceId);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setPreviewUrl(null);
    try {
      const blob = await generateVoiceAudio({
        voiceId: voice.voiceId,
        text: previewLineFor(voice, lang),
        emotion: voice.emotion,
        preview: true,
      });
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreviewUrl(url);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : "VOICE_ENGINE_ERROR");
    } finally {
      setPreviewLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder={`${t("search")} — voiceId, name, style, tone...`}
            className="w-full rounded-2xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["gender", t("gender"), GENDERS],
              ["language", t("language"), LANGUAGES],
              ...(hideEmotionFilter ? [] : [["emotion", t("emotion"), [...EMOTIONS]] as const]),
              ["style", t("style"), STYLES],
            ] as const
          ).map(([key, label, options]) => (
            <label key={key} className="block text-xs font-semibold text-muted-foreground">
              {label}
              <select
                value={filters[key]}
                onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-border bg-background px-2.5 py-2 text-sm font-normal text-foreground outline-none focus:border-primary"
              >
                <option value="any">{t("any")}</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="min-w-[220px] flex-1">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>{t("age")}</span>
              <span className="font-mono text-foreground">{ageLabel}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="range"
                min={6}
                max={80}
                value={filters.minAge}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minAge: String(Math.min(Number(e.target.value), Number(f.maxAge))),
                  }))
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                aria-label="Minimum age"
              />
              <input
                type="range"
                min={6}
                max={80}
                value={filters.maxAge}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxAge: String(Math.max(Number(e.target.value), Number(f.minAge))),
                  }))
                }
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
                aria-label="Maximum age"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              <strong className="font-mono text-foreground">{total}</strong> {t("resultsCount")}
            </span>
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition hover:bg-accent"
            >
              {t("reset")}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {voices.map((v) => {
          const isSelected = selectedId === v.voiceId;
          return (
            <article
              key={v.voiceId}
              className={`flex flex-col gap-3 rounded-3xl border bg-card p-4 shadow-sm transition ${
                isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">{v.displayName ?? v.name}</h3>
                  <p className="font-mono text-[11px] text-muted-foreground">{v.voiceId}</p>
                </div>
                <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-bold text-accent-foreground">
                  {v.age} yrs
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {[v.gender, v.language, v.accent, v.style, v.tone, v.emotion].map((chip, i) => (
                  <span
                    key={`${v.voiceId}-${i}`}
                    className="rounded-full border border-border px-2 py-0.5 text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {v.engineConnected ? (
                  <>
                    {t("sharedBase")}:{" "}
                    <span className="font-mono text-foreground">{v.engineVoice}</span> — real engine
                    voice, shared by several profiles with different age, style and emotion delivery.
                  </>
                ) : (
                  <span className="font-semibold text-destructive">{t("engineOff")}</span>
                )}
              </p>

              <div className="mt-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void preview(v)}
                  disabled={previewLoading === v.voiceId || !v.engineConnected}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
                >
                  {previewLoading === v.voiceId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  {previewLoading === v.voiceId ? t("previewing") : t("preview")}
                </button>
                {onSelect && !voiceAllowed(v.voiceId, plan) ? (
                  <Link to="/upgrade" className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground">
                    Locked · Upgrade
                  </Link>
                ) : onSelect && (
                  <button
                    type="button"
                    onClick={() => onSelect(v)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                    {isSelected ? t("selected") : t("select")}
                  </button>
                )}
              </div>

              {previewId === v.voiceId && previewError && (
                <p className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {previewError}
                </p>
              )}
              {previewId === v.voiceId && previewUrl && (
                <AudioPlayer src={previewUrl} filename={`${v.voiceId}.wav`} autoPlay />
              )}
            </article>
          );
        })}
      </div>

      {loading && (
        <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading voices...
        </p>
      )}

      {!loading && voices.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>
      )}

      {hasMore && !loading && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
          >
            {t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}
