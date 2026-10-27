/**
 * Stripe fiat-to-crypto onramp. The secret key stays on the server.
 * Stripe is the merchant of record: they take the card and deliver USDC.
 * Docs: https://docs.stripe.com/api/crypto/onramp_sessions/create
 */

import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

function onrampUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    const host = url.hostname;
    if (host === "crypto.link.com" || host === "stripe.com" || host.endsWith(".stripe.com")) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export const stripeOnramp = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        address: z.string().min(32).max(48),
        usd: z.number().min(1).max(10000).optional(),
        source: z.enum(["usd", "eur"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    let address = "";
    try {
      address = new PublicKey(data.address).toBase58();
    } catch {
      return { ok: false as const, error: "That is not a Solana address." };
    }
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return {
        ok: false as const,
        error: "Card funding is not on. Stripe has to approve the onramp, and STRIPE_SECRET_KEY has to be set on the server.",
      };
    }
    const body = new URLSearchParams();
    body.set("wallet_addresses[solana]", address);
    body.set("destination_currency", "usdc");
    body.set("destination_network", "solana");
    body.append("destination_currencies[]", "usdc");
    body.append("destination_networks[]", "solana");
    body.set("source_currency", data.source || "usd");
    if (data.usd) body.set("source_amount", data.usd.toFixed(2));
    body.set("lock_wallet_address", "true");
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      const ip = getRequest()?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
      if (ip) body.set("customer_ip_address", ip);
    } catch {
      /* the IP is optional */
    }
    const res = await fetch("https://api.stripe.com/v1/crypto/onramp_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = (await res.json()) as { redirect_url?: string | null; error?: { message?: string } };
    if (!res.ok) return { ok: false as const, error: json.error?.message || "Stripe did not open the checkout." };
    const url = json.redirect_url ? onrampUrl(json.redirect_url) : null;
    if (!url) {
      return {
        ok: false as const,
        error: "Stripe did not return a checkout link. The onramp application may still be in review.",
      };
    }
    return { ok: true as const, url };
  });
