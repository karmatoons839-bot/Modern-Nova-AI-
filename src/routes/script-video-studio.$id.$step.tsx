import { createFileRoute } from "@tanstack/react-router";
import { S2vStudioPage } from "@/components/S2vStudio";
import { STUDIO_STEPS } from "@/lib/s2v-studio";
export const Route = createFileRoute("/script-video-studio/$id/$step")({
  staticData: { sitemap: false },
  head: ({ params }) => {
    const step = Number(params.step);
    const name = STUDIO_STEPS[step - 1] ?? "Unavailable Studio Page";
    const title = `${name} — Script-to-Video — Modern Nova AI`;
    const description = `${name} for your saved Modern Nova AI story-to-video project.`;
    return { meta: [{ title }, { name: "description", content: description }, { name: "robots", content: "noindex" }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] };
  },
  component: StudioStep,
});
function StudioStep() {
  const { id, step } = Route.useParams();
  return <S2vStudioPage id={id} step={Number(step)} />;
}