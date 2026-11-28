import { createFileRoute } from "@tanstack/react-router";
import { ScriptVideoTool } from "@/components/ScriptVideoTool";
export const Route = createFileRoute("/script-video-legacy")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "Previous Video Projects — Modern Nova AI" },
    { name: "description", content: "Open and download your previous Modern Nova AI Script-to-Video projects." },
    { property: "og:title", content: "Previous Video Projects — Modern Nova AI" },
    { property: "og:description", content: "Previously saved Script-to-Video clips and downloads." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: ScriptVideoTool,
});