/** Tokens Jupiter is trading. One list, one price. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type TapeCoin = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  icon: string;
  /** Jupiter 24h buy volume plus sell volume, in USD. */
  volume?: number;
  liquidity?: number;
  mcap?: number;
  holders?: number;
};

export function bookStat(n?: number) {
  if (!(n && n > 0)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const LISTS = [
  "https://lite-api.jup.ag/tokens/v2/tag?query=verified",
  "https://lite-api.jup.ag/tokens/v2/tag?query=lst",
  "https://lite-api.jup.ag/tokens/v2/tag?query=stocks",
  "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptraded/6h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/recent",
];

type RawToken = {
  id?: string;
  symbol?: string;
  name?: string;
  icon?: string;
  usdPrice?: number;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
  liquidity?: number;
  mcap?: number;
  holderCount?: number;
};

function asCoin(row: RawToken, seen: Set<string>): TapeCoin | null {
  if (!row.id || !row.symbol || seen.has(row.id)) return null;
  seen.add(row.id);
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name || row.symbol,
    price: Number(row.usdPrice) || 0,
    change: Number(row.stats24h?.priceChange) || 0,
    icon: row.icon || "",
    volume: Number(row.stats24h?.buyVolume || 0) + Number(row.stats24h?.sellVolume || 0),
    liquidity: Number(row.liquidity) || 0,
    mcap: Number(row.mcap) || 0,
    holders: Number(row.holderCount) || 0,
  };
}

function rowsOf(body: unknown): RawToken[] {
  if (Array.isArray(body)) return body as RawToken[];
  if (!body || typeof body !== "object") return [];
  for (const value of Object.values(body as Record<string, unknown>)) {
    if (Array.isArray(value)) return value as RawToken[];
  }
  return [];
}

export const loadTape = createServerFn({ method: "GET" }).handler(async (): Promise<TapeCoin[]> => {
  const seen = new Set<string>();
  const rows: TapeCoin[] = [];
  const pages = await Promise.all(
    LISTS.map(async (url) => {
      try {
        const r = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(20000) });
        if (!r.ok) return [];
        return rowsOf(await r.json());
      } catch {
        return [];
      }
    }),
  );
  for (const body of pages) {
    for (const row of body) {
      const coin = asCoin(row, seen);
      if (coin) rows.push(coin);
    }
  }
  return rows;
});

/** Last price and the day move for the mints on screen. Called on a timer, not once. */
export const liveMarks = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.array(z.string().min(32).max(48)).max(40).parse(input))
  .handler(async ({ data }) => {
    const r = await fetch(`https://lite-api.jup.ag/price/v3?ids=${data.join(",")}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return {} as Record<string, { usd: number; chg: number }>;
    const raw = (await r.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
    const out: Record<string, { usd: number; chg: number }> = {};
    for (const mint of data) {
      const usd = Number(raw[mint]?.usdPrice);
      if (usd > 0) out[mint] = { usd, chg: Number(raw[mint]?.priceChange24h) || 0 };
    }
    return out;
  });

/** Any coin Jupiter can name, not only the top lists. */
export const searchTape = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ q: z.string().trim().min(1).max(32) }).parse(input))
  .handler(async ({ data }): Promise<TapeCoin[]> => {
    const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(data.q)}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const body = rowsOf(await r.json());
    const seen = new Set<string>();
    const rows: TapeCoin[] = [];
    for (const row of body) {
      const coin = asCoin(row, seen);
      if (coin) rows.push(coin);
      if (rows.length >= 40) break;
    }
    return rows;
  });
