import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Clapperboard, Film, Image as ImageIcon, Info, Mic, MonitorPlay, Tag, Server, AudioWaveform, Music } from "lucide-react";
import { ToolArt, type ToolArtKind } from "@/components/ToolArt";
import { useAuth, useProfile } from "@/lib/auth";
import { Button } from '@/components/ui/button';
import { useSiteContent } from "@/lib/site-content";

export const Route = createFileRoute("/tools")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Tools — Modern Nova AI" },
      { name: "description", content: "Choose a tool: Script Studio, Voice Studio, Script to Video, SFX Maker and Music Studio." },
      { property: "og:title", content: "Tools — Modern Nova AI" },
      { property: "og:description", content: "Script, voice-over, story video, SFX and music tools." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Tools,
});

const TOOLS: ReadonlyArray<{ to: string; art: ToolArtKind; icon: typeof BookOpen; title: string; text: string }> = [
  { to: "/story", art: "script", icon: BookOpen, title: "Script Studio", text: "Original horror and moral scripts, with your brief, language and duration." },
  { to: "/studio", art: "voice", icon: Mic, title: "Voice Studio", text: "Analyze a story, lock emotions per line and voice every character from 400 profiles." },
  { to: "/script-video", art: "s2v", icon: Film, title: "Script to Video", text: "Turn your script into a full story video — scenes, characters, voiceover and one final MP4." },
  { to: "/sfx", art: "voice", icon: AudioWaveform, title: "SFX Maker", text: "Create walking, laughing, door, nature or custom sound effects, edit them and build an animation timeline." },
  { to: "/music", art: "voice", icon: Music, title: "Music Studio", text: "Upload music, keep a searchable library, preview tracks and generate AI background music." },
];

function Tools() {
  const { session, ready } = useAuth();
  const { data: profile } = useProfile();
  const c = useSiteContent();
  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-foreground">{c("tools.title")}</h1>
      <p className="mt-1 text-muted-foreground">{c("tools.subtitle")}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t, i) => (
          <Link
            key={t.to}
            to={t.to}
            className="nova-tool-card group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <ToolArt kind={t.art} />
            <div className="flex flex-1 flex-col p-5">
            <h2 className="flex items-center gap-3 font-display text-xl font-bold text-foreground">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-accent text-primary">
                <t.icon className="h-5 w-5" />
              </span>
              {c(`tools.t${i + 1}_title`, t.title)}
            </h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{c(`tools.t${i + 1}_text`, t.text)}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-primary">
              Explore Tool <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </span>
            </div>
          </Link>
        ))}
      </div>
      {ready && !session && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link to="/pricing" className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition hover:border-primary">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><Tag className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block font-display text-lg font-bold text-foreground">Pricing & Plans</span>
              <span className="block text-sm text-muted-foreground">See all plans and credits</span>
            </span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
          <Link to="/about" className="group flex items-center gap-4 rounded-3xl border border-border bg-card p-5 transition hover:border-primary">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary"><Info className="h-5 w-5" /></span>
            <span className="flex-1">
              <span className="block font-display text-lg font-bold text-foreground">About</span>
              <span className="block text-sm text-muted-foreground">Our story, mission and team</span>
            </span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </Link>
        </div>
      )}
    </div>
  );
}
