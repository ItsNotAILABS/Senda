import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/checkout-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) return Response.json({ error: "STRIPE_SECRET_KEY is not set." }, { status: 500 });
        const id = new URL(request.url).searchParams.get("id") || "";
        if (!/^cs_[A-Za-z0-9_]+$/.test(id) || id.length > 120) {
          return Response.json({ error: "That is not a checkout session." }, { status: 400 });
        }
        try {
          const stripe = new Stripe(key, { apiVersion: "2026-09-30.endive" });
          const session = await stripe.checkout.sessions.retrieve(id);
          return Response.json({
            id: session.id,
            paid: session.payment_status === "paid",
            status: session.status,
            amount: session.amount_total,
            currency: session.currency,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stripe did not return the session.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
