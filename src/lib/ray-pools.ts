/** Raydium's deepest pools. The buy is still a Jupiter signature. The depth is Raydium's. */

import { createServerFn } from "@tanstack/react-start";

export type RayPool = {
  symbol: string;
  name: string;
  mint: string;
  tvl: number;
  volume: number;
  price: number;
  quote: string;
  decimals: number;
};

const QUOTES = new Set(["USDC", "USDT", "SOL", "WSOL"]);

type Mint = { address?: string; symbol?: string; name?: string; decimals?: number };
type Row = { tvl?: number; price?: number; mintA?: Mint; mintB?: Mint; day?: { volume?: number } };

export const loadRayPools = createServerFn({ method: "GET" }).handler(async (): Promise<RayPool[]> => {
  const res = await fetch(
    "https://api-v3.raydium.io/pools/info/list?poolType=all&poolSortField=liquidity&sortType=desc&pageSize=40&page=1",
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) return [];
  const body = (await res.json()) as { data?: { data?: Row[] } };
  const rows = body.data?.data ?? [];
  const out: RayPool[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const a = row.mintA;
    const b = row.mintB;
    if (!a?.address || !b?.address || !a.symbol || !b.symbol) continue;
    const quote = QUOTES.has(a.symbol) ? a : QUOTES.has(b.symbol) ? b : null;
    const base = quote === a ? b : quote === b ? a : null;
    if (!quote || !base?.address || !base.symbol) continue;
    const baseMint = base.address;
    const baseSymbol = base.symbol;
    if (!baseMint || !baseSymbol || QUOTES.has(baseSymbol) || seen.has(baseMint)) continue;
    if (!((row.tvl || 0) >= 50_000)) continue;
    const raw = Number(row.price) || 0;
    const price = quote === b ? raw : raw > 0 ? 1 / raw : 0;
    seen.add(baseMint);
    out.push({
      symbol: baseSymbol,
      name: base.name || baseSymbol,
      mint: baseMint,
      tvl: row.tvl || 0,
      volume: row.day?.volume || 0,
      price,
      quote: quote.symbol || "USDC",
      decimals: base.decimals && base.decimals > 0 ? base.decimals : 6,
    });
    if (out.length >= 16) break;
  }
  return out;
});
