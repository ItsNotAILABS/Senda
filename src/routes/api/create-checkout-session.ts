import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/create-checkout-session")({
  server: {
    handlers: {
      POST: async () => {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
          return Response.json({ error: "STRIPE_SECRET_KEY is not set." }, { status: 500 });
        }
        const stripe = new Stripe(key, { apiVersion: "2026-09-30.endive" });
        const mode = "payment" as const;
        const session = await stripe.checkout.sessions.create({
          ui_mode: "form",
          billing_address_collection: "auto",
          phone_number_collection: { enabled: false },
          automatic_tax: { enabled: false },
          submit_type: "auto",
          integration_identifier: "custom_embedded_web_0001",
          mode,
          line_items: [{ price: "price_...", quantity: 1 }],
        });
        return Response.json({ client_secret: session.client_secret });
      },
    },
  },
});
