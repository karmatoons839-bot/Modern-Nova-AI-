import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

// Public Developer API: authenticated by the developer's own API key inside the handler.
export const Route = createFileRoute("/api/public/v1/$service/generate")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
        const { handleApiRequest } = await import("@/lib/devapi.server");
        const res = await handleApiRequest(request, params.service);
        Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
        return res;
      },
    },
  },
});
