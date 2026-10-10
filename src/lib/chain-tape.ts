/** Live prices for markets that are not PreStocks. Nothing here is a position. */

import { createServerFn } from "@tanstack/react-start";
import { CHAINS, SOLANA_MORE, mapChains, mapSolana, type TapeRow } from "@/lib/chain-tape-map.mjs";

const JUP = "https://lite-api.jup.ag/price/v3?ids=";
const LLAMA = "https://coins.llama.fi";

export type ChainTape = {
  ok: boolean;
  rows: TapeRow[];
  note: string;
  jupiter: boolean;
  defillama: boolean;
};

async function getJson(url: string, ms = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "Senda" },
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchChainTape(): Promise<ChainTape> {
  const mints = SOLANA_MORE.map((row) => row[2]).join(",");
  const ids = CHAINS.map((row) => `coingecko:${row[3]}`).join(",");
  let jupiter = false;
  let defillama = false;
  let solana: TapeRow[] = [];
  let chains: TapeRow[] = [];
  try {
    const quotes = (await getJson(`${JUP}${mints}`)) as Record<string, { usdPrice?: number; priceChange24h?: number }>;
    solana = mapSolana(quotes);
    jupiter = solana.length > 0;
  } catch {
    solana = [];
  }
  try {
    const [prices, changes] = await Promise.all([
      getJson(`${LLAMA}/prices/current/${ids}`) as Promise<{ coins?: Record<string, { price?: number }> }>,
      getJson(`${LLAMA}/percentage/${ids}`) as Promise<{ coins?: Record<string, number> }>,
    ]);
    chains = mapChains(prices, changes);
    defillama = chains.length > 0;
  } catch {
    chains = [];
  }
  return {
    ok: solana.length + chains.length > 0,
    rows: [...solana, ...chains],
    note: "Solana rows can be signed on Jupiter. Listed EVM rows can be signed on LI.FI. Every other row is a price.",
    jupiter,
    defillama,
  };
}

export const getChainTape = createServerFn({ method: "GET" }).handler(async () => fetchChainTape());
