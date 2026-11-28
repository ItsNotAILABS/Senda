/** Cash into the wallet. Secrets stay in server env. A missing key is a missing key, not a pretend buy. */

import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

function solana(address: string): string {
  return new PublicKey(address).toBase58();
}

export const moonpayBuy = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ address: z.string().min(32).max(48), currency: z.enum(["usdc_sol", "usdc_base"]).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const currency = data.currency || "usdc_sol";
    let address = data.address.trim();
    if (currency === "usdc_sol") {
      try {
        address = solana(address);
      } catch {
        return { ok: false as const, error: "That is not a Solana address." };
      }
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return { ok: false as const, error: "That is not a Base address." };
    }
    const pk = process.env.MOONPAY_PUBLISHABLE_KEY?.trim();
    const secret = process.env.MOONPAY_SECRET_KEY?.trim();
    if (!pk) return { ok: false as const, error: "MOONPAY_PUBLISHABLE_KEY is not set." };
    const params = new URLSearchParams({ apiKey: pk, currencyCode: currency, baseCurrencyCode: "usd" });
    if (!secret) {
      return { ok: true as const, url: `https://buy.moonpay.com?${params.toString()}`, locked: false };
    }
    params.set("walletAddress", address);
    const query = `?${params.toString()}`;
    const signature = createHmac("sha256", secret).update(query).digest("base64");
    return { ok: true as const, url: `https://buy.moonpay.com${query}&signature=${encodeURIComponent(signature)}`, locked: true };
  });

export const helioCharge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ paymentRequestId: z.string().min(8).max(80), amount: z.string().regex(/^\d+(\.\d{1,2})?$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const key = process.env.HELIO_PUBLIC_KEY?.trim();
    const secret = process.env.HELIO_SECRET_KEY?.trim();
    if (!key || !secret) return { ok: false as const, error: "HELIO_PUBLIC_KEY and HELIO_SECRET_KEY are not set." };
    const res = await fetch(`https://api.hel.io/v1/charge/api-key?apiKey=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ paymentRequestId: data.paymentRequestId, requestAmount: data.amount }),
    });
    const text = await res.text();
    let body: { pageUrl?: string; message?: string; error?: string } = {};
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      body = {};
    }
    if (!res.ok || !body.pageUrl) return { ok: false as const, error: body.message || body.error || `Helio ${res.status}` };
    if (!body.pageUrl.startsWith("https://app.hel.io/")) return { ok: false as const, error: "Helio returned a page that is not theirs." };
    return { ok: true as const, url: body.pageUrl };
  });

export const flexaReady = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.FLEXA_API_KEY?.trim() || "";
  return { ready: key.startsWith("secret_test_") || key.startsWith("secret_live_") };
});
