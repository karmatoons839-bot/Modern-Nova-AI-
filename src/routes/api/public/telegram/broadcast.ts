import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Owner turned off all bot promotions, posters and generation forwarding (2026-11-27).
// The scheduled callback still authenticates but sends nothing.
export const Route = createFileRoute("/api/public/telegram/broadcast")({
  staticData: { sitemap: false },
  server: { handlers: {
    POST: async ({ request }) => {
      const authFailure = await authenticateCronRequest(request);
      if (authFailure) return authFailure;
      return Response.json({ ok: true, disabled: true });
    },
  } },
});
