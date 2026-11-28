/** Live Jupiter quotes. Senda is agent — we do not warehouse the other side. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const QUOTE_URLS = [
  (qs: string) => `https://public.jupiterapi.com/quote?${qs}`,
  (qs: string) => `https://lite-api.jup.ag/swap/v1/quote?${qs}`,
  (qs: string) => `https://api.jup.ag/swap/v1/quote?${qs}`,
];

export type JupQuote = {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  slippageBps: number;
  route: string[];
  swapUsdValue: string | null;
  inMint: string;
  outMint: string;
  side: "buy" | "sell";
};

function routeLabels(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return [];
  const plan = (raw as { routePlan?: Array<{ swapInfo?: { label?: string } }> }).routePlan;
  if (!Array.isArray(plan)) return [];
  return plan.map((p) => p.swapInfo?.label || "DEX").filter(Boolean);
}

export async function fetchQuote(mint: string, usd: number, side: "buy" | "sell"): Promise<JupQuote | { error: string }> {
  const amount = Math.max(1, Math.round(usd * 1e6));
  const inputMint = side === "buy" ? USDC : mint;
  const outputMint = side === "buy" ? mint : USDC;
  const qs = `inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100&restrictIntermediateTokens=true`;
  let last = "Jupiter unreachable.";
  for (const url of QUOTE_URLS) {
    try {
      const r = await fetch(url(qs), { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
      const text = await r.text();
      if (!r.ok) {
        last = r.status === 429 ? "Jupiter is busy. Wait a moment." : `Jupiter ${r.status}`;
        continue;
      }
      const j = JSON.parse(text) as Record<string, unknown>;
      if (!j.outAmount) {
        last = "No route.";
        continue;
      }
      return {
        inAmount: String(j.inAmount ?? amount),
        outAmount: String(j.outAmount),
        otherAmountThreshold: String(j.otherAmountThreshold ?? j.outAmount),
        priceImpactPct: String(j.priceImpactPct ?? "0"),
        slippageBps: Number(j.slippageBps ?? 100),
        route: routeLabels(j),
        swapUsdValue: j.swapUsdValue != null ? String(j.swapUsdValue) : null,
        inMint: String(j.inputMint ?? inputMint),
        outMint: String(j.outputMint ?? outputMint),
        side,
      };
    } catch {
      last = "Jupiter unreachable.";
    }
  }
  return { error: last };
}

export const quoteJup = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        mint: z.string().min(32).max(48),
        usd: z.number().positive().max(1_000_000),
        side: z.enum(["buy", "sell"]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<JupQuote | { error: string }> => fetchQuote(data.mint, data.usd, data.side));

/** Same quote, fetched here, so a browser that cannot reach Jupiter still gets the route. The body is a string because the raw Jupiter object is not a typed serializable map. */
export const relayQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        inputMint: z.string().min(32).max(48),
        outputMint: z.string().min(32).max(48),
        amount: z.number().positive().max(1e18),
        slippageBps: z.number().int().min(1).max(5_000).optional(),
        onlyDirect: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true; quote: string } | { ok: false; error: string }> => {
    const slip = data.slippageBps ?? 100;
    const direct = data.onlyDirect ? "&onlyDirectRoutes=true" : "";
    const base = `inputMint=${data.inputMint}&outputMint=${data.outputMint}&amount=${Math.floor(data.amount)}&slippageBps=${slip}`;
    let last = "Jupiter did not quote.";
    for (const restrict of [true, false]) {
      const qs = `${base}${restrict ? "&restrictIntermediateTokens=true" : ""}${direct}`;
      for (const url of QUOTE_URLS) {
        try {
          const res = await fetch(url(qs), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
          const text = await res.text();
          let quote: { outAmount?: string; error?: string } = {};
          try {
            quote = JSON.parse(text) as { outAmount?: string; error?: string };
          } catch {
            last = res.status === 429 ? "Jupiter is busy. Wait a moment." : "Jupiter did not quote.";
            continue;
          }
          if (!res.ok || !quote.outAmount) {
            last = res.status === 429 ? "Jupiter is busy. Wait a moment." : quote.error || `Jupiter quote ${res.status}`;
            continue;
          }
          return { ok: true, quote: text };
        } catch {
          last = "Jupiter did not quote.";
        }
      }
    }
    return { ok: false, error: last };
  });

export function outUi(q: JupQuote, decimals = 6): number {
  return Number(q.outAmount) / 10 ** decimals;
}

export function inUi(q: JupQuote, decimals = 6): number {
  return Number(q.inAmount) / 10 ** decimals;
}

export function jupFillUrl(mint: string, side: "buy" | "sell"): string {
  return side === "buy"
    ? `https://jup.ag/swap/${USDC}-${mint}`
    : `https://jup.ag/swap/${mint}-${USDC}`;
}

/** Jupiter sends a fraction at or under 1, and a percent when the number is already above 1. */
export function impactFromRaw(priceImpactPct: string | number | undefined | null): number {
  const n = Math.abs(Number(priceImpactPct) || 0);
  return n > 1 ? n : n * 100;
}

export function impactPct(q: JupQuote): number {
  return impactFromRaw(q.priceImpactPct);
}
