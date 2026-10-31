/** DFlow quote. The wallet signs the transaction DFlow built. Senda does not hold it. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { USDC } from "@/lib/jup-exec";

const DEV = "https://dev-quote-api.dflow.net/order";
const PROD = "https://quote-api.dflow.net/order";

export type DflowQuote = {
  ok: true;
  outAmount: string;
  inAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  venue: string;
  transaction: string | null;
  inputMint: string;
  outputMint: string;
};

function atoms(usd: number, side: "buy" | "sell", price: number, decimals: number) {
  if (side === "sell" && price > 0) return Math.max(1, Math.round((usd / price) * 10 ** decimals));
  return Math.max(1, Math.round(usd * 1e6));
}

async function order(input: {
  mint: string;
  usd: number;
  side: "buy" | "sell";
  price: number;
  decimals: number;
  owner?: string;
}): Promise<DflowQuote | { ok: false; reason: string }> {
  const amount = atoms(input.usd, input.side, input.price, input.decimals);
  const inputMint = input.side === "buy" ? USDC : input.mint;
  const outputMint = input.side === "buy" ? input.mint : USDC;
  const q = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: "50",
  });
  if (input.owner) q.set("userPublicKey", input.owner);
  const key = process.env.DFLOW_API_KEY;
  const headers: Record<string, string> = { accept: "application/json" };
  const hosts = key ? [PROD, DEV] : [DEV];
  if (key) headers["x-api-key"] = key;
  let last = "DFlow did not answer.";
  for (const host of hosts) {
    const res = await fetch(`${host}?${q}`, { headers, signal: AbortSignal.timeout(8000) }).catch(() => null);
    if (!res) continue;
    if (!res.ok) {
      last = `DFlow ${res.status}`;
      continue;
    }
    const json = (await res.json()) as {
      outAmount?: string;
      inAmount?: string;
      otherAmountThreshold?: string;
      priceImpactPct?: string;
      transaction?: string;
      routePlan?: Array<{ venue?: string }>;
    };
    if (!json.outAmount) {
      last = "DFlow had no route.";
      continue;
    }
    const impact = Math.abs(Number(json.priceImpactPct || 0));
    if (impact > 5) return { ok: false, reason: `DFlow impact is ${impact.toFixed(1)}%. The wallet was not asked to sign.` };
    return {
      ok: true,
      outAmount: json.outAmount,
      inAmount: json.inAmount || String(amount),
      otherAmountThreshold: json.otherAmountThreshold || json.outAmount,
      priceImpactPct: json.priceImpactPct || "0",
      venue: json.routePlan?.[0]?.venue || "DFlow",
      transaction: json.transaction || null,
      inputMint,
      outputMint,
    };
  }
  return { ok: false, reason: last };
}

export const dflowQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      mint: z.string().min(32).max(48),
      usd: z.number().positive().max(1_000_000),
      side: z.enum(["buy", "sell"]),
      price: z.number().nonnegative().optional(),
      decimals: z.number().int().min(0).max(12).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => order({ ...data, price: data.price ?? 0, decimals: data.decimals ?? 6 }));

export const dflowOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({
      owner: z.string().min(32).max(48),
      mint: z.string().min(32).max(48),
      usd: z.number().positive().max(1_000_000),
      side: z.enum(["buy", "sell"]),
      price: z.number().nonnegative().optional(),
      decimals: z.number().int().min(0).max(12).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => order(data.price == null ? { ...data, price: 0, decimals: data.decimals ?? 6 } : { ...data, price: data.price, decimals: data.decimals ?? 6 }));
