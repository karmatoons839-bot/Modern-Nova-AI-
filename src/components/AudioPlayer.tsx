import { Download, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  filename,
  autoPlay = false,
}: {
  src: string;
  filename: string;
  autoPlay?: boolean;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
    if (autoPlay) void ref.current?.play().catch(() => setPlaying(false));
  }, [src, autoPlay]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-secondary/60 p-3">
      <button
        type="button"
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
        aria-label={playing ? t("pause") : t("play")}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={time}
        onChange={(e) => {
          const el = ref.current;
          if (el) el.currentTime = Number(e.target.value);
        }}
        className="h-1.5 min-w-[140px] flex-1 cursor-pointer appearance-none rounded-full bg-border accent-primary"
        aria-label="Seek"
      />

      <span className="font-mono text-xs text-muted-foreground">
        {fmt(time)} / {fmt(duration)}
      </span>

      <a
        href={src}
        download={filename}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-accent"
      >
        <Download className="h-3.5 w-3.5" /> {t("download")}
      </a>

      <audio
        ref={ref}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        className="hidden"
      />
    </div>
  );
}
