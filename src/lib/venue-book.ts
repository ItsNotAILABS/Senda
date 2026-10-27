/** Every Solana pool DexScreener lists for a mint. Logos and names come from the same read. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

export type Venue = { dex: string; vol: number; liq: number; price: number };
export type VenueBook = {
  mint: string;
  name: string;
  symbol: string;
  icon: string;
  venues: Venue[];
  vol: number;
};

type Pair = {
  chainId?: string;
  dexId?: string;
  priceUsd?: string;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { address?: string; name?: string; symbol?: string };
};

function side(pair: Pair, mint: string) {
  if (pair.baseToken?.address === mint) return pair.baseToken;
  if (pair.quoteToken?.address === mint) return pair.quoteToken;
  return null;
}

export async function facesOf(mints: string[]): Promise<Map<string, { icon: string; name: string; symbol: string }>> {
  const out = new Map<string, { icon: string; name: string; symbol: string }>();
  const unique = [...new Set(mints)].filter((mint) => mint.length >= 32);
  for (let i = 0; i < unique.length; i += 30) {
    const ids = unique.slice(i, i + 30);
    const r = await cachedJson(`https://api.dexscreener.com/tokens/v1/solana/${ids.join(",")}`, 180_000, {
      headers: { accept: "application/json", "user-agent": "Senda" },
    });
    const rows = Array.isArray(r.body) ? (r.body as Pair[]) : [];
    for (const pair of rows) {
      const token = ids.map((mint) => side(pair, mint)).find(Boolean);
      const mint = token?.address || "";
      if (!mint || out.has(mint)) continue;
      out.set(mint, { icon: pair.info?.imageUrl || "", name: token?.name || "", symbol: token?.symbol || "" });
    }
  }
  return out;
}

export async function venuesOf(mint: string): Promise<VenueBook> {
  const empty: VenueBook = { mint, name: "", symbol: "", icon: "", venues: [], vol: 0 };
  const r = await cachedJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, 60_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok) return empty;
  const pairs = ((r.body as { pairs?: Pair[] }).pairs || []).filter((pair) => pair.chainId === "solana" && side(pair, mint));
  const bags = new Map<string, Venue>();
  let icon = "";
  let name = "";
  let symbol = "";
  let bestLiq = -1;
  for (const pair of pairs) {
    const dex = pair.dexId || "pool";
    const vol = Number(pair.volume?.h24) || 0;
    const liq = Number(pair.liquidity?.usd) || 0;
    const price = Number(pair.priceUsd) || 0;
    const cur = bags.get(dex) || { dex, vol: 0, liq: 0, price: 0 };
    cur.vol += vol;
    cur.liq += liq;
    if (price > 0 && !(cur.price > 0)) cur.price = price;
    bags.set(dex, cur);
    const token = side(pair, mint);
    if (liq >= bestLiq) {
      bestLiq = liq;
      icon = pair.info?.imageUrl || icon;
      name = token?.name || name;
      symbol = token?.symbol || symbol;
    }
  }
  const venues = [...bags.values()].sort((a, b) => b.vol - a.vol);
  return { mint, name, symbol, icon, venues, vol: venues.reduce((sum, row) => sum + row.vol, 0) };
}

export const loadVenues = createServerFn({ method: "POST" })
  .validator(z.object({ mint: z.string().min(32).max(48) }))
  .handler(async ({ data }) => venuesOf(data.mint));
