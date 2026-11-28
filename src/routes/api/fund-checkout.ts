import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

/** Card-network checkout for a dollar amount. Separate from the Studio placeholder session. */
const METHODS = ["apple", "debit", "credit", "venmo", "paypal", "revolut"] as const;
type Method = (typeof METHODS)[number];

const MIN_CENTS: Record<Method, number> = {
  apple: 50,
  debit: 50,
  credit: 50,
  venmo: 100,
  paypal: 100,
  revolut: 100,
};

const LABEL: Record<Method, string> = {
  apple: "Apple Pay",
  debit: "Debit card",
  credit: "Credit card",
  venmo: "Venmo",
  paypal: "PayPal",
  revolut: "Revolut Pay",
};

function isMethod(v: string): v is Method {
  return (METHODS as readonly string[]).includes(v);
}

export const Route = createFileRoute("/api/fund-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
          return Response.json(
            { error: "STRIPE_SECRET_KEY is not set. Card, Apple Pay, PayPal, Venmo, and Revolut Pay need it. Crypto and Robinhood still work." },
            { status: 500 },
          );
        }
        let body: { usd?: unknown; method?: unknown; receive?: unknown; wallet?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Send an amount and a method." }, { status: 400 });
        }
        const method = typeof body.method === "string" ? body.method : "";
        if (!isMethod(method)) return Response.json({ error: "That method is not on this rail." }, { status: 400 });
        const usd = typeof body.usd === "number" ? body.usd : Number(body.usd);
        const cents = Math.round(usd * 100);
        if (!Number.isFinite(cents) || cents < MIN_CENTS[method]) {
          return Response.json(
            { error: `Minimum for ${LABEL[method]} is $${(MIN_CENTS[method] / 100).toFixed(2)}.`, minimum: MIN_CENTS[method] / 100 },
            { status: 400 },
          );
        }
        if (cents > 1_000_000) return Response.json({ error: "Maximum on this rail is $10,000." }, { status: 400 });
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
        const receive = body.receive === "SOL" ? "SOL" : "USDC";
        const wallet = typeof body.wallet === "string" ? body.wallet.slice(0, 80) : "";
        const stripe = new Stripe(key, { apiVersion: "2026-09-30.endive" });
        const base = {
          mode: "payment" as const,
          success_url: `${origin}/wallets?deposit=paid&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/wallets?deposit=cancel`,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: cents,
                product_data: {
                  name: `Senda · ${LABEL[method]}`,
                  description: "Stripe collects this payment. It does not send USDC or SOL to a wallet.",
                },
              },
            },
          ],
          metadata: {
            desk: "fund",
            method,
            receive,
            wallet,
            settles: "stripe",
          },
        };
        const card = ["card"] as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];
        const paypal = ["paypal"] as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];
        const revolut = ["revolut_pay"] as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];
        const primary = method === "paypal" || method === "venmo" ? paypal : method === "revolut" ? revolut : card;
        let note = "";
        if (method === "venmo") {
          note = "Venmo is not its own Stripe method. This opens PayPal Checkout, which is the live rail.";
        }
        if (method === "apple") {
          note = "Apple Pay shows on the card page when this phone has a card in the wallet.";
        }
        if (method === "debit" || method === "credit") {
          note = "Debit and credit both open the card page. The network decides the card.";
        }
        try {
          const session = await stripe.checkout.sessions.create({
            ...base,
            allowed_payment_method_types: primary,
          });
          if (!session.url) return Response.json({ error: "Stripe did not return a checkout page." }, { status: 502 });
          return Response.json({ url: session.url, note });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Stripe refused the session.";
          return Response.json({ error: message }, { status: 400 });
        }
      },
    },
  },
});
