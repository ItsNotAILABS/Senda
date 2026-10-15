/** Live Jupiter quotes. Senda is agent — we do not warehouse the other side. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { FILL_PROBE_USD, fillsAtProductionSlippage, mapPool, weightBook, type WeightLeg } from "@/lib/jup-fill.mjs";
import { mintDecimalsExact } from "@/lib/phantom";

export const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const QUOTE = "https://api.jup.ag/swap/v1/quote";
const QUOTE_LITE = "https://lite-api.jup.ag/swap/v1/quote";

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
  for (const base of [QUOTE, QUOTE_LITE]) {
    try {
      const r = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
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

function asFill(quote: JupQuote | { error: string }) {
  if ("error" in quote) return null;
  return { ...quote, inUsd: Number(quote.inAmount) / 1e6 };
}

const FILL_TTL_MS = 3 * 60_000;
const fillCache = new Map<string, { at: number; ok: boolean }>();

async function probeMint(mint: string, usd: number): Promise<boolean | "busy"> {
  const quote = await fetchQuote(mint, usd, "buy");
  if ("error" in quote) return quote.error.includes("busy") ? "busy" : false;
  return fillsAtProductionSlippage(asFill(quote));
}

/** Mints that Jupiter can fill at production slippage for a retail buy. USDC is not probed. A busy quote is not cached. */
export async function fillableMints(mints: string[], usd = FILL_PROBE_USD): Promise<Set<string>> {
  const unique = [...new Set(mints.filter((mint) => mint && mint !== USDC && mint.length >= 32))];
  const passed = new Set<string>();
  const pending: string[] = [];
  const now = Date.now();
  for (const mint of unique) {
    const hit = fillCache.get(`${usd}:${mint}`);
    if (hit && now - hit.at < FILL_TTL_MS) {
      if (hit.ok) passed.add(mint);
    } else {
      pending.push(mint);
    }
  }
  await mapPool(pending, 3, async (mint) => {
    let result = await probeMint(mint, usd);
    if (result === "busy") {
      await new Promise((resolve) => setTimeout(resolve, 600));
      result = await probeMint(mint, usd);
    }
    if (result === "busy") return;
    fillCache.set(`${usd}:${mint}`, { at: Date.now(), ok: result });
    if (result) passed.add(mint);
  });
  return passed;
}

export const getWeightBook = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        spendUsd: z.number().positive().max(5000),
        legs: z
          .array(
            z.object({
              symbol: z.string().min(1).max(16),
              mint: z.string().min(32).max(48),
              mark: z.number().positive(),
              target: z.number().positive(),
            }),
          )
          .min(1)
          .max(12),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ level: number | null; legs: WeightLeg[] }> => {
    const targetSum = data.legs.reduce((sum, leg) => sum + leg.target, 0);
    const quotes: Record<string, ReturnType<typeof asFill>> = {};
    const decimals = new Map<string, number>();
    await mapPool(data.legs, 4, async (leg) => {
      const share = targetSum > 0 ? leg.target / targetSum : 0;
      const usd = Math.max(1, Math.round(data.spendUsd * share * 100) / 100);
      const places = await mintDecimalsExact(leg.mint);
      if (places != null) decimals.set(leg.mint, places);
      quotes[leg.mint] = asFill(await fetchQuote(leg.mint, usd, "buy"));
    });
    return weightBook(
      data.legs.map((leg) => ({ ...leg, decimals: decimals.get(leg.mint) })),
      quotes,
    );
  });
