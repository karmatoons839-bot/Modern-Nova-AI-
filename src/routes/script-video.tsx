import { createFileRoute } from "@tanstack/react-router";
import { S2vStudioHome } from "@/components/S2vStudio";

export const Route = createFileRoute("/script-video")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Script to Video — Modern Nova AI" },
      { name: "description", content: "Create and save stories, AI character and location references, voice settings and real animation clips in Modern Nova AI." },
      { property: "og:title", content: "Script to Video — Modern Nova AI" },
      { property: "og:description", content: "Your saved story-to-video projects, visual references, voices and generated clips." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: S2vStudioHome,
});
