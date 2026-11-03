/**
 * Read the pools that already price a PreStock.
 * Jupiter names the venue and the pool account. We do not invent either.
 */

import { createServerFn } from "@tanstack/react-start";
import { fetchHouse } from "@/lib/sol-house";
import { USDC_MINT, programForLabel, type SharedBook, type SharedHop } from "@/lib/pools/model";

const QUOTE = "https://api.jup.ag/swap/v1/quote";
const QUOTE_LITE = "https://lite-api.jup.ag/swap/v1/quote";
const PROBE_USD = 25;

type RawHop = {
  percent?: number;
  swapInfo?: { label?: string; ammKey?: string; inputMint?: string; outputMint?: string };
};

let cache: { at: number; rows: SharedBook[] } | null = null;
const CACHE_MS = 20_000;

async function quoteHops(mint: string): Promise<{ hops: SharedHop[]; outAmount: string | null; impact: string | null; error?: string }> {
  const amount = PROBE_USD * 1_000_000;
  const qs = `inputMint=${USDC_MINT}&outputMint=${mint}&amount=${amount}&slippageBps=100`;
  let last = "No route.";
  for (const base of [QUOTE_LITE, QUOTE]) {
    try {
      const r = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
      if (!r.ok) {
        last = r.status === 429 ? "Jupiter is busy." : `Jupiter ${r.status}`;
        continue;
      }
      const j = (await r.json()) as { outAmount?: string; priceImpactPct?: string; routePlan?: RawHop[] };
      if (!j.outAmount) {
        last = "No route.";
        continue;
      }
      const hops: SharedHop[] = (j.routePlan ?? []).map((p) => {
        const label = p.swapInfo?.label || "Pool";
        return {
          label,
          pool: p.swapInfo?.ammKey || "",
          percent: Number(p.percent ?? 0),
          inMint: p.swapInfo?.inputMint || "",
          outMint: p.swapInfo?.outputMint || "",
          programId: programForLabel(label),
        };
      });
      return { hops, outAmount: String(j.outAmount), impact: j.priceImpactPct != null ? String(j.priceImpactPct) : null };
    } catch {
      last = "Jupiter unreachable.";
    }
  }
  return { hops: [], outAmount: null, impact: null, error: last };
}

async function mapLimit<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i;
      i += 1;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, () => worker()));
  return out;
}

export async function fetchSharedBooks(): Promise<SharedBook[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  const house = await fetchHouse();
  const names = house.filter((h) => h.venue === "prestocks" && h.mint && h.last > 0);
  const rows = await mapLimit(names, 3, async (h): Promise<SharedBook> => {
    const q = await quoteHops(h.mint);
    return {
      symbol: h.symbol,
      name: h.name,
      mint: h.mint,
      last: h.last,
      usd: PROBE_USD,
      hops: q.hops,
      outAmount: q.outAmount,
      impact: q.impact,
      error: q.error,
    };
  });
  cache = { at: Date.now(), rows };
  return rows;
}

export const readSharedPools = createServerFn({ method: "GET" }).handler(
  async (): Promise<SharedBook[]> => fetchSharedBooks(),
);
