/** The xStocks Jupiter is actually trading. Volume is the last 24 hours on their pools. */

import { createServerFn } from "@tanstack/react-start";

const SEARCH = "https://datapi.jup.ag/v1/assets/search?query=";

export type FlowName = {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  liquidity: number;
  decimals: number;
  kind: "etf" | "stock";
};

type Hit = {
  id?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  usdPrice?: number;
  liquidity?: number;
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
};

function kindOf(name: string, symbol: string): "etf" | "stock" {
  if (/ETF|Fund|Trust|Index|iShares|SPDR|Invesco|Vanguard|ProShares|2X|3X|Ultra/i.test(name)) return "etf";
  if (/^(SPY|QQQ|SQQQ|TQQQ|IWM|GLD|SLV|TLT|USO)/.test(symbol.replace(/x$/i, ""))) return "etf";
  return "stock";
}

async function search(q: string): Promise<FlowName[]> {
  const res = await fetch(`${SEARCH}${encodeURIComponent(q)}`, { headers: { accept: "application/json", "user-agent": "Senda" } });
  if (!res.ok) return [];
  const rows = (await res.json()) as Hit[];
  const out: FlowName[] = [];
  for (const row of rows) {
    const price = Number(row.usdPrice) || 0;
    const volume = (Number(row.stats24h?.buyVolume) || 0) + (Number(row.stats24h?.sellVolume) || 0);
    if (!row.id || !row.symbol || !(price > 0) || !(volume > 0)) continue;
    out.push({
      mint: row.id,
      symbol: row.symbol,
      name: row.name || row.symbol,
      price,
      change: Number(row.stats24h?.priceChange) || 0,
      volume,
      liquidity: Number(row.liquidity) || 0,
      decimals: Number.isFinite(Number(row.decimals)) ? Number(row.decimals) : 8,
      kind: kindOf(row.name || "", row.symbol),
    });
  }
  return out;
}

export async function fetchStockFlow(): Promise<FlowName[]> {
  const [shares, funds] = await Promise.all([search("xStock"), search("ETF xStock")]);
  const byMint = new Map<string, FlowName>();
  for (const row of [...shares, ...funds]) {
    const prev = byMint.get(row.mint);
    if (!prev || row.volume > prev.volume) byMint.set(row.mint, row);
  }
  return [...byMint.values()].sort((a, b) => b.volume - a.volume);
}

export const getStockFlow = createServerFn({ method: "GET" }).handler(async () => fetchStockFlow());
