import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Scheduled driver so Script-to-Video scenes keep progressing when nobody has the page open.
export const Route = createFileRoute("/api/public/s2v-tick")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { tickActiveProjects } = await import("@/lib/s2v.server");
        const { tickStudioTasks } = await import("@/lib/s2v-studio.server");
        try {
          const legacy = await tickActiveProjects();
          const studio = await tickStudioTasks();
          return Response.json({ ...legacy, studio });
        } catch {
          return Response.json({ ok: false, error: "TICK_FAILED" }, { status: 500 });
        }
      },
    },
  },
});
