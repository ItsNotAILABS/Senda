import { createFileRoute } from "@tanstack/react-router";
import { handleBitsoWebhook } from "../../../services/bitso-business/webhook-http.mjs";

/** Webhook intake only. Senda never signs, converts, or pays out here. */
export const Route = createFileRoute("/api/bitso-webhook")({
  server: {
    handlers: {
      POST: ({ request }) => handleBitsoWebhook(request),
      GET: () => new Response(null, { status: 405, headers: { "cache-control": "no-store" } }),
    },
  },
});
