import { createFileRoute } from "@tanstack/react-router";
import { MusicSystem } from "@/components/MusicSystem";

export const Route = createFileRoute("/music")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Music Studio — Upload, Library & AI Music | Modern Nova AI" },
      { name: "description", content: "Upload your music, build a searchable library, preview tracks and generate AI background music for your videos." },
      { property: "og:title", content: "Music Studio — Modern Nova AI" },
      { property: "og:description", content: "Your music library with upload, search, preview and AI music generation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MusicSystem,
});
