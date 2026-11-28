import { createFileRoute, Link } from "@tanstack/react-router";
import { useSiteContent } from "@/lib/site-content";
import { ArrowRight, Mic } from "lucide-react";
import { PLANS } from "@/lib/plans";
import { AmbientSparkles } from "@/components/AmbientSparkles";
import { ToolArt, type ToolArtKind } from "@/components/ToolArt";
import { Button } from "@/components/ui/button";

const SITE = "https://modernnova.in/";
const TITLE = "Modern Nova AI — AI Tools for Stories, Voice, Video, SFX & Music";
const DESC =
  "Modern Nova AI is an AI creative platform for writing scripts, voiceovers, story videos, sound effects and music in one place.";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: SITE },
      { property: "og:site_name", content: "Modern Nova AI" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: SITE }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${SITE}#organization`, name: "Modern Nova AI", url: SITE },
            {
              "@type": "WebSite",
              "@id": `${SITE}#website`,
              name: "Modern Nova AI",
              url: SITE,
              description: DESC,
              publisher: { "@id": `${SITE}#organization` },
            },
          ],
        }),
      },
    ],
  }),
  component: Home,
});

const FEATURES: ReadonlyArray<{ art: ToolArtKind; title: string; text: string }> = [
  { art: "script", title: "Script Studio", text: "Original scripts in your language." },
  { art: "voice", title: "Voice Studio", text: "400 voices, one emotion per line." },
  { art: "s2v", title: "Script to Video", text: "Script to one final MP4." },
  { art: "voice", title: "SFX & Music", text: "Sound effects and background music." },
];

const STEPS = [
  { title: "Sign in", text: "Free with Google or email." },
  { title: "Pick a tool", text: "Enter your idea." },
  { title: "Download", text: "Saved in History." },
] as const;

function Home() {
  const c = useSiteContent();
  const paid = PLANS.filter((p) => p.priceInr > 0);
  return (
    <div>
      <section className="nova-hero relative isolate grid items-center gap-8 py-8 text-center md:grid-cols-2 md:text-left">
        <AmbientSparkles hero />
        <div className="flex flex-col items-center md:items-start">
          <span className="rounded-full border border-border bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
            {c("home.badge")}
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            {c("home.title")}
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">{c("home.subtitle")}</p>
          <Button asChild className="nova-explore mt-7 h-auto w-full rounded-2xl px-8 py-4 font-display text-base font-bold sm:w-auto">
            <Link to="/tools">{c("home.cta")} <ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
          </Button>
          <div className="nova-icon-row mt-8 flex gap-5">
            <span className="nova-icon nova-mic" title="Voice Studio">
              <span className="nova-wave nova-wave-one" aria-hidden="true" />
              <span className="nova-wave nova-wave-two" aria-hidden="true" />
              <Mic className="relative h-6 w-6" aria-label="Voice Studio" />
            </span>
          </div>
        </div>
        <ToolArt kind="hero" className="mx-auto w-full max-w-xl" />
      </section>

      <section className="py-10">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">{c("home.tools_title")}</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {FEATURES.map((f, i) => (
            <article key={f.title} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <ToolArt kind={f.art} />
              <div className="p-3 md:p-5">
                <h3 className="font-display text-sm font-bold text-foreground md:text-lg">{c(`home.f${i + 1}_title`, f.title)}</h3>
                <p className="mt-1 text-xs text-muted-foreground md:text-sm">{f.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className="font-display text-2xl font-bold text-foreground md:text-3xl">{c("home.steps_title")}</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary font-display font-bold text-primary-foreground">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="font-display font-bold text-foreground">{c(`home.s${i + 1}_title`, s.title)}</h3>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-10">
        <div className="rounded-3xl border border-border bg-accent p-6 md:p-8">
          <h2 className="font-display text-2xl font-bold text-foreground">Simple credit plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start free with 5,000 credits. Upgrade any time.</p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {paid.map((p) => (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-3 text-center">
                <div className="font-display text-lg font-bold text-foreground md:text-2xl">₹{p.priceInr}</div>
                <div className="text-xs text-muted-foreground">{p.credits.toLocaleString("en-IN")} credits</div>
              </div>
            ))}
          </div>
          <Button asChild variant="outline" className="mt-5 w-full rounded-2xl sm:w-auto">
            <Link to="/pricing">See pricing <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

    </div>
  );
}
