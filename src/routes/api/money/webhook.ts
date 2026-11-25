import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import { handleMoneyWebhook } from "@/lib/money-webhook.mjs";

/** Provider settlement webhooks. Raw body is HMAC-verified before parsing; see src/lib/money-webhook.mjs. */
export const Route = createFileRoute("/api/money/webhook")({
  server: {
    handlers: {
      POST: ({ request }) =>
        handleMoneyWebhook(request, {
          env: process.env,
          getQuery: async () => {
            const sql = await getSql();
            return (text: string, params: unknown[]) => sql.query(text, params);
          },
        }),
    },
  },
});
