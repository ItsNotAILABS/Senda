/** Live Jupiter quotes. Senda is agent — we do not warehouse the other side. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";

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
  const url = `${QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100&restrictIntermediateTokens=true`;
  try {
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) return { error: `Jupiter ${r.status}` };
    const j = (await r.json()) as Record<string, unknown>;
    if (!j.outAmount) return { error: "No route." };
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
    return { error: "Jupiter unreachable." };
  }
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

export function impactPct(q: JupQuote): number {
  return Math.abs(Number(q.priceImpactPct) || 0) * (Number(q.priceImpactPct) > 1 ? 1 : 100);
}
