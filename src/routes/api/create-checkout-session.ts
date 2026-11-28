import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
          return Response.json(
            { error: "STRIPE_SECRET_KEY is not set. The publishable key can open Stripe.js. It cannot create a charge." },
            { status: 500 },
          );
        }
        let body: { usd?: unknown; name?: unknown; wallet?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send an amount." }, { status: 400 });
        }
        const usd = typeof body.usd === "number" ? body.usd : Number(body.usd);
        const cents = Math.round(usd * 100);
        if (!Number.isFinite(cents) || cents < 50 || cents > 1_000_000) {
          return Response.json({ error: "A card buy is $0.50 to $10,000." }, { status: 400 });
        }
        const name = typeof body.name === "string" ? body.name.replace(/\s+/g, " ").trim().slice(0, 80) : "";
        if (name.length < 2) return Response.json({ error: "Name what this payment is for." }, { status: 400 });
        const wallet = typeof body.wallet === "string" ? body.wallet.trim().slice(0, 80) : "";
        const originHeader = request.headers.get("origin");
        let origin = "";
        if (originHeader) {
          try {
            const u = new URL(originHeader);
            if (u.protocol === "https:" || u.protocol === "http:") origin = u.origin;
          } catch {
            origin = "";
          }
        }
        if (!origin) return Response.json({ error: "Missing origin." }, { status: 400 });
        const stripe = new Stripe(key, { apiVersion: "2026-09-30.endive" });
        try {
          const session = await stripe.checkout.sessions.create({
            ui_mode: "form",
            mode: "payment",
            billing_address_collection: "auto",
            phone_number_collection: { enabled: false },
            automatic_tax: { enabled: false },
            submit_type: "pay",
            return_url: `${origin}/cards?session_id={CHECKOUT_SESSION_ID}`,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: cents,
                  product_data: {
                    name,
                    description: "Stripe charges the card. This payment does not send USDC.",
                  },
                },
              },
            ],
            metadata: { desk: "card", wallet, name },
          });
          if (!session.client_secret || !session.id) {
            return Response.json({ error: "Stripe did not return a form secret." }, { status: 502 });
          }
          return Response.json({ client_secret: session.client_secret, id: session.id });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stripe refused the session.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
