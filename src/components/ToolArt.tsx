import { BookOpen, Clapperboard, Film, Image as ImageIcon, Mic, MonitorPlay, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ToolArtKind = "script" | "voice" | "image" | "thumbnail" | "video" | "s2v" | "hero";

const ICONS: Record<ToolArtKind, LucideIcon> = {
  script: BookOpen,
  voice: Mic,
  image: ImageIcon,
  thumbnail: MonitorPlay,
  video: Clapperboard,
  s2v: Film,
  hero: Sparkles,
};

/** Pure CSS/SVG artwork for tool cards and the home hero — no image files. */
export function ToolArt({ kind, festive = false, className = "" }: { kind: ToolArtKind; festive?: boolean; className?: string }) {
  const Icon = ICONS[kind];
  return (
    <div className={`tool-art tool-art-${kind}${festive ? " tool-art-festive" : ""} ${className}`} aria-hidden="true">
      <span className="tool-art-grid" />
      <span className="tool-art-orb tool-art-orb-one" />
      <span className="tool-art-orb tool-art-orb-two" />
      <span className="tool-art-badge">
        <Icon className="h-7 w-7" />
      </span>
      <span className="tool-art-bars">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

/** Pure CSS artwork for Script-to-Video style picker tiles. */
export function StyleArt({ id, className = "" }: { id: string; className?: string }) {
  return (
    <span className={`style-art style-art-${id} ${className}`} aria-hidden="true">
      <span className="style-art-shine" />
    </span>
  );
}
