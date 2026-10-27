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

const JUP_SPAN: Record<string, string> = {
  "1": "1_MINUTE",
  minute: "1_MINUTE",
  "5": "5_MINUTE",
  "15": "15_MINUTE",
  "60": "1_HOUR",
  hour: "1_HOUR",
  "240": "4_HOUR",
  "1D": "1_DAY",
};

/** Jupiter's own candles, including USD volume. Empty when that interval is not published. */
export async function jupBars(mint: string, span: string): Promise<DerivBar[]> {
  const interval = JUP_SPAN[span] || "15_MINUTE";
  const to = Math.floor(Date.now() / 60_000) * 60_000;
  const r = await cachedJson(
    `https://datapi.jup.ag/v2/charts/${mint}?interval=${interval}&to=${to}&candles=160`,
    60_000,
  );
  if (!r.ok) return [];
  const candles = (r.body as { candles?: Array<{ time?: number; open?: number; high?: number; low?: number; close?: number; volume?: number }> }).candles || [];
  const out: DerivBar[] = [];
  let last = -1;
  for (const row of candles) {
    const time = Math.floor(Number(row.time) || 0);
    const close = Number(row.close) || 0;
    if (!(time > last) || !(close > 0)) continue;
    last = time;
    const volume = Number(row.volume) || 0;
    out.push({
      time,
      open: Number(row.open) || close,
      high: Number(row.high) || close,
      low: Number(row.low) || close,
      close,
      ...(volume > 0 ? { volume } : {}),
    });
  }
  return out;
}

function hasVolume(rows: DerivBar[]): boolean {
  return rows.filter((row) => (row.volume || 0) > 0).length >= 8;
}

/** Pool bars when they carry volume. Jupiter's chart when the pool print does not. */
export async function loadBars(mint: string, span: string): Promise<{ bars: DerivBar[]; source: "gecko-pool" | "jup-chart" | "none" }> {
  const pool = await geckoBars(mint, span).catch(() => [] as DerivBar[]);
  if (hasVolume(pool)) return { bars: pool, source: "gecko-pool" };
  const jup = await jupBars(mint, span).catch(() => [] as DerivBar[]);
  if (jup.length > 1 && hasVolume(jup)) return { bars: jup, source: "jup-chart" };
  if (pool.length > 1) return { bars: pool, source: "none" };
  if (jup.length > 1) return { bars: jup, source: "none" };
  return { bars: [], source: "none" };
}

/** Daily closes for a small line. Empty when the pool did not print. */
export async function dayLine(mint: string): Promise<number[]> {
  const bars = await geckoBars(mint, "1D");
  return bars.map((bar) => bar.close).filter((n) => n > 0).slice(-32);
}

export const printBook = createServerFn({ method: "GET" })
  .validator(z.object({ mint: z.string().min(32).max(48), span: z.enum(["minute", "hour", "1", "5", "15", "60", "240", "1D"]).optional() }))
  .handler(async ({ data }) => loadBars(data.mint, data.span || "1"));

export const printBars = createServerFn({ method: "GET" })
  .validator(z.object({ mint: z.string().min(32).max(48), span: z.enum(["minute", "hour", "1", "5", "15", "60", "240", "1D"]).optional() }))
  .handler(async ({ data }): Promise<DerivBar[]> => (await loadBars(data.mint, data.span || "1")).bars);

export async function poolMatrixBars(mint: string) {
  const loaded = await loadBars(mint, "15");
  const bars = loaded.bars.map((row) => ({
    t: row.time,
    o: row.open,
    h: row.high,
    l: row.low,
    c: row.close,
    v: row.volume && row.volume > 0 ? row.volume : 0,
  }));
  const pool = loaded.source !== "none" && bars.length >= 30 && bars.slice(-21).every((row) => row.v > 0);
  return { bars, pool, source: loaded.source === "none" ? "price-only" : loaded.source };
}
