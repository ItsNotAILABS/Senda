/**
 * Revolut Merchant hosted checkout. Optional.
 * Money lands in the merchant Revolut account named by the secret, not in the user's Solana wallet.
 * With no secret, this returns that fact and does not invent an order.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VERSION = "2024-09-01";

function merchantBase(): string {
  return process.env.REVOLUT_MERCHANT_ENV === "sandbox"
    ? "https://sandbox-merchant.revolut.com/api"
    : "https://merchant.revolut.com/api";
}

function merchantKey(): string {
  return process.env.REVOLUT_MERCHANT_SECRET?.trim() || process.env.REVOLUT_API_SECRET?.trim() || "";
}

export const revolutReady = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({}).parse(input ?? {}))
  .handler(async (): Promise<{ merchant: boolean }> => {
    return { merchant: Boolean(merchantKey()) };
  });

export const revolutCheckout = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        amount: z.number().positive().max(5000),
        currency: z.enum(["USD", "EUR", "GBP", "MXN"]),
        description: z.string().max(140).optional(),
        redirectUrl: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; url: string; id: string } | { ok: false; error: string }> => {
    const key = merchantKey();
    if (!key) {
      return {
        ok: false,
        error:
          "Revolut checkout needs a merchant secret on the server. Your own Revolut still withdraws SOL, or USDC on Solana, to the address on this page.",
      };
    }
    const redirect = data.redirectUrl && data.redirectUrl.startsWith("https://") ? data.redirectUrl : undefined;
    const amount = Math.round(data.amount * 100);
    if (!(amount >= 1)) return { ok: false, error: "Amount is below one cent." };
    let res: Response;
    try {
      res = await fetch(`${merchantBase()}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Revolut-Api-Version": VERSION,
        },
        body: JSON.stringify({
          amount,
          currency: data.currency,
          description: (data.description || "Senda").slice(0, 140),
          ...(redirect ? { redirect_url: redirect } : {}),
        }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      return { ok: false, error: "Revolut did not answer." };
    }
    const body = (await res.json().catch(() => ({}))) as {
      id?: string;
      token?: string;
      checkout_url?: string;
      message?: string;
      code?: string;
    };
    if (!res.ok || !body.checkout_url) {
      return { ok: false, error: body.message || body.code || `Revolut declined the order (${res.status}).` };
    }
    return { ok: true, url: body.checkout_url, id: body.id || body.token || "" };
  });
