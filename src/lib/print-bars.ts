/** Pool candles for a Solana mint. Dexscreener names the pool. GeckoTerminal prints the bars. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";
import type { DerivBar } from "@/lib/deriv-book";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

async function geckoBars(mint: string, span: string): Promise<DerivBar[]> {
  const dex = await cachedJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, 60_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  const pairs = ((dex.body as { pairs?: Array<{ chainId?: string; pairAddress?: string; liquidity?: { usd?: number } }> })?.pairs || [])
    .filter((p) => p.chainId === "solana" && p.pairAddress)
    .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const pool = pairs[0]?.pairAddress;
  if (!pool) return [];
  const spec =
    span === "5" ? ["ohlcv/minute?aggregate=5&limit=160", 20_000]
    : span === "15" ? ["ohlcv/minute?aggregate=15&limit=160", 20_000]
    : span === "hour" || span === "60" ? ["ohlcv/hour?aggregate=1&limit=160", 60_000]
    : span === "240" ? ["ohlcv/hour?aggregate=4&limit=160", 60_000]
    : span === "1D" ? ["ohlcv/day?aggregate=1&limit=180", 120_000]
    : ["ohlcv/minute?aggregate=1&limit=160", 20_000];
  const g = await cachedJson(
    `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/${spec[0]}`,
    spec[1] as number,
    { headers: { accept: "application/json", "user-agent": UA } },
  );
  const list = (g.body as { data?: { attributes?: { ohlcv_list?: number[][] } } })?.data?.attributes?.ohlcv_list || [];
  const bars = list
    .map((row) => ({
      time: Math.floor(row[0]),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5] > 0 ? row[5] : undefined,
    }))
    .filter((b) => b.time > 0 && b.close > 0)
    .sort((a, b) => a.time - b.time);
  const out: DerivBar[] = [];
  let last = -1;
  for (const bar of bars) {
    if (bar.time <= last) continue;
    last = bar.time;
    out.push(bar);
  }
  return out;
}

/** Daily closes for a small line. Empty when the pool did not print. */
export async function dayLine(mint: string): Promise<number[]> {
  const bars = await geckoBars(mint, "1D");
  return bars.map((bar) => bar.close).filter((n) => n > 0).slice(-32);
}

export const printBars = createServerFn({ method: "GET" })
  .validator(z.object({ mint: z.string().min(32).max(48), span: z.enum(["minute", "hour", "1", "5", "15", "60", "240", "1D"]).optional() }))
  .handler(async ({ data }): Promise<DerivBar[]> => geckoBars(data.mint, data.span || "1"));

export async function poolMatrixBars(mint: string) {
  const rows = await geckoBars(mint, "15");
  const bars = rows.map((row) => ({
    t: row.time,
    o: row.open,
    h: row.high,
    l: row.low,
    c: row.close,
    v: row.volume && row.volume > 0 ? row.volume : 0,
  }));
  const pool = bars.length >= 30 && bars.slice(-21).every((row) => row.v > 0);
  return { bars, pool };
}
