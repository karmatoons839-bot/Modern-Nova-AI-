import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  staticData: { sitemap: false },
  component: StudioLayout,
});

function StudioLayout() {
  return <Outlet />;
}
