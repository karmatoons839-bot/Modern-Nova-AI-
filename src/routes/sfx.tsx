import { createFileRoute } from "@tanstack/react-router";
import { SfxMaker } from "@/components/SfxMaker";

export const Route = createFileRoute("/sfx")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "SFX Maker — AI Sound Effects | Modern Nova AI" },
      { name: "description", content: "Generate walking, running, laughing, door, nature and custom sound effects with AI, then edit and place them on a timeline." },
      { property: "og:title", content: "SFX Maker — Modern Nova AI" },
      { property: "og:description", content: "Create, edit and export real AI sound effects for your animation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SfxMaker,
});
