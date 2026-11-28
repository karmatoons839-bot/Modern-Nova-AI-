import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Film, Mail, Mic, Music, Youtube } from "lucide-react";

const TITLE = "About Modern Nova AI — Our Story, Mission & Team";
const DESC =
  "Learn about Modern Nova AI: our story, mission, team and vision for making AI creation tools for voices, scripts, story videos, sound effects and music accessible to everyone.";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://modernnova.in/about" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://modernnova.in/about" }],
  }),
  component: About,
});

const OFFER = [
  { icon: BookOpen, title: "Script Writing", text: "Create scripts and written content with AI." },
  { icon: Mic, title: "Voice Generation", text: "Turn text into natural-sounding AI voiceovers." },
  { icon: Film, title: "Script to Video", text: "Turn your script into a full story video." },
  { icon: Music, title: "SFX & Music", text: "Create sound effects and background music." },
] as const;

const TEAM = [
  { name: "Akshat Tyagi", role: "CEO", text: "Leads the overall vision, direction, and development of Modern Nova AI." },
  { name: "Goga Ram", role: "Manager", text: "Manages operations and helps coordinate the platform's activities." },
  { name: "Ayush", role: "Developer", text: "Works on the development, technology, and technical implementation of the platform." },
  { name: "Ravikant", role: "Guide", text: "Provides guidance and support in the platform's development and direction." },
  { name: "Arun Joti", role: "Digital Manager", text: "Handles digital management and supports the platform's online growth and presence." },
] as const;

const h2 = "font-display text-2xl font-bold text-foreground md:text-3xl";
const p = "mt-4 text-muted-foreground";

function About() {
  return (
    <div className="mx-auto max-w-4xl">
      <header className="py-10 text-center md:py-14">
        <span className="rounded-full border border-border bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">
          About
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">About Modern Nova AI</h1>
      </header>

      <section className="border-t border-border py-10">
        <h2 className={h2}>Our Story</h2>
        <p className={p}>Modern Nova AI began with a simple idea: make powerful AI creation tools accessible to everyone.</p>
        <p className={p}>
          Before Modern Nova AI, we created modern.ai.info, which helped us explore and understand the possibilities of
          AI-powered tools. We later started Modern Nova AI in collaboration with Nova Forge AI, building a broader
          platform focused on AI-powered creativity and content creation.
        </p>
        <p className={p}>
          Modern Nova AI officially launched in September 2026 and continues to grow with a focus on making AI tools
          simple, affordable, and accessible.
        </p>
      </section>

      <section className="py-10">
        <h2 className={h2}>Our Mission</h2>
        <p className={p}>
          Our mission is to bring useful AI creation tools together in one place and make them affordable — or as close
          to free as possible — for creators, students, businesses, and everyday users.
        </p>
        <p className={p}>
          We want users to be able to create voices, scripts, story videos, sound effects, music and other digital content without
          needing multiple expensive platforms.
        </p>
      </section>

      <section className="py-10">
        <h2 className={h2}>What We Offer</h2>
        <p className={p}>Modern Nova AI brings multiple AI-powered creation tools together in one platform:</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {OFFER.map((o) => (
            <article key={o.title} className="rounded-3xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-primary" aria-hidden="true">
                <o.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">{o.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{o.text}</p>
            </article>
          ))}
        </div>
        <p className={p}>We are continuously working to expand the platform with more creative AI tools and features.</p>
      </section>

      <section className="py-10">
        <h2 className={h2}>Our Team</h2>
        <p className={p}>Modern Nova AI is built by a dedicated team with different skills and responsibilities:</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM.map((m) => (
            <article key={m.name} className="rounded-3xl border border-border bg-card p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary font-display text-base font-bold text-primary-foreground" aria-hidden="true">
                {m.name.charAt(0)}
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-foreground">{m.name}</h3>
              <p className="text-sm font-semibold text-primary">{m.role}</p>
              <p className="mt-2 text-sm text-muted-foreground">{m.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="py-10">
        <h2 className={h2}>Our Vision</h2>
        <p className={p}>We believe AI should be useful, accessible, and easy to use.</p>
        <p className={p}>
          Our vision is to build a platform where anyone can access powerful creative AI tools from one place — without
          needing technical expertise or multiple complicated services.
        </p>
      </section>

      <section className="py-10">
        <div className="rounded-3xl border border-border bg-card p-6 md:p-8">
          <h2 className={h2}>Get in Touch</h2>
          <p className={p}>Have a question, suggestion, or partnership idea? We'd love to hear from you.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="mailto:MODERNNOVAAI@gmail.com" className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent break-all">
              <Mail className="h-4 w-4 text-primary" /> Official Email: MODERNNOVAAI@gmail.com
            </a>
            <a href="https://youtube.com/@maimodernai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-accent">
              <Youtube className="h-4 w-4 text-primary" /> YouTube: @maimodernai
            </a>
          </div>
        </div>
      </section>

      <section className="py-12 text-center">
        <p className="font-display text-2xl font-bold text-foreground">Modern Nova AI</p>
        <p className="mt-2 font-display text-lg font-semibold text-primary">Create. Imagine. Innovate.</p>
        <p className="mt-2 text-muted-foreground">One platform for your AI-powered creativity.</p>
      </section>
    </div>
  );
}
