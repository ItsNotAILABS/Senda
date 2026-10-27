/** The coins Jupiter is actually trading. One list, one price. */

import { createServerFn } from "@tanstack/react-start";
import { cachedJson } from "@/lib/net-cache";

export type LiveCoin = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  icon: string;
  decimals: number;
  /** Pool liquidity in USD, when Jupiter sent it. */
  liq?: number;
};

const URL = "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100";

export const loadCoins = createServerFn({ method: "GET" }).handler(async (): Promise<LiveCoin[]> => {
  const r = await cachedJson(URL, 12_000);
  if (!r.ok || !Array.isArray(r.body)) throw new Error("The coin tape did not come back.");
  const rows: LiveCoin[] = [];
  for (const raw of r.body) {
    const row = raw as {
      id?: string;
      symbol?: string;
      name?: string;
      icon?: string;
      usdPrice?: number;
      decimals?: number;
      liquidity?: number;
      stats24h?: { priceChange?: number };
    };
    const price = Number(row.usdPrice) || 0;
    if (!row.id || !row.symbol || !(price > 0)) continue;
    rows.push({
      id: row.id,
      symbol: row.symbol,
      name: row.name || row.symbol,
      price,
      change: Number(row.stats24h?.priceChange) || 0,
      icon: row.icon || "",
      decimals: Number.isFinite(Number(row.decimals)) ? Number(row.decimals) : 6,
      liq: Number(row.liquidity) || 0,
    });
  }
  return rows;
});

export type WideRow = {
  mint: string;
  symbol: string;
  price: number;
  change: number;
  liq: number;
  venue: "Jupiter" | "Trending" | "Organic";
};

const WIDE = [
  ["Jupiter", "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=50"],
  ["Trending", "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=40"],
  ["Organic", "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=40"],
] as const;

/** Jupiter's own books, not the short house list. Deduped. Prices are Jupiter's. */
export const loadWide = createServerFn({ method: "GET" }).handler(async (): Promise<WideRow[]> => {
  const batches = await Promise.all(
    WIDE.map(async ([venue, url]) => {
      const r = await cachedJson(url, 12_000);
      if (!r.ok || !Array.isArray(r.body)) return [] as WideRow[];
      const rows: WideRow[] = [];
      for (const raw of r.body as Array<{ id?: string; symbol?: string; usdPrice?: number; liquidity?: number; stats24h?: { priceChange?: number } }>) {
        const price = Number(raw.usdPrice) || 0;
        if (!raw.id || !raw.symbol || !(price > 0)) continue;
        rows.push({
          mint: raw.id,
          symbol: raw.symbol,
          price,
          change: Number(raw.stats24h?.priceChange) || 0,
          liq: Number(raw.liquidity) || 0,
          venue,
        });
      }
      return rows;
    }),
  );
  const seen = new Set<string>();
  const out: WideRow[] = [];
  for (const row of batches.flat()) {
    if (seen.has(row.mint)) continue;
    seen.add(row.mint);
    out.push(row);
  }
  return out;
});
