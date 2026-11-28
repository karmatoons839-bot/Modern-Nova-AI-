import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { z } from "zod";

export const Route = createFileRoute("/api/public/telegram/deliveries")({
  staticData: { sitemap: false },
  server: { handlers: { POST: async ({ request }) => {
    const refused = await authenticateCronRequest(request);
    if (refused) return refused;
    const body = z.object({ kind: z.literal("telegram-delivery") }).safeParse(await request.json().catch(() => null));
    if (!body.success) return new Response("Invalid request", { status: 400 });
    const { drainTelegramDeliveries } = await import("@/lib/telegram-delivery.server");
    return Response.json(await drainTelegramDeliveries());
  } } },
});