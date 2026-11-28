import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/telegram/webhook")({
  staticData: { sitemap: false },
  server: { handlers: {
    GET: () => Response.json({ service: "Modern Nova Telegram webhook", available: true }, { headers: { "Cache-Control": "no-store" } }),
    POST: async ({ request }) => {
      const { validTelegramWebhookSecret, telegramUpdateSchema, processTelegramUpdate } = await import("@/lib/telegram-bot.server");
      if (!validTelegramWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token") ?? "")) return new Response("Unauthorized", { status: 401 });
      const length = Number(request.headers.get("content-length") ?? 0);
      if (length > 64000) return new Response("Request too large", { status: 413 });
      let raw: unknown;
      try {
        const body = await request.text();
        if (body.length > 64000) return new Response("Request too large", { status: 413 });
        raw = JSON.parse(body);
      } catch { return new Response("Invalid JSON", { status: 400 }); }
      if (!telegramUpdateSchema.safeParse(raw).success) return new Response("Invalid update", { status: 400 });
      try { await processTelegramUpdate(raw); return Response.json({ ok: true }); }
      catch { return Response.json({ ok: false, error: "PROCESSING_FAILED" }, { status: 503 }); }
    },
  } },
});