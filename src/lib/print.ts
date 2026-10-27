/** Pool candles for a Solana mint. GeckoTerminal OHLCV. Empty if the mint has no pool. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PrintBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type PrintTf = "15m" | "1H" | "4H" | "1D";

const poolCache = new Map<string, { at: number; pool: string }>();
const candleCache = new Map<string, { at: number; bars: PrintBar[]; note: string }>();
const inflight = new Map<string, Promise<{ bars: PrintBar[]; note: string }>>();

function tfQuery(tf: PrintTf): { frame: string; aggregate: number; limit: number } {
  if (tf === "15m") return { frame: "minute", aggregate: 15, limit: 96 };
  if (tf === "4H") return { frame: "hour", aggregate: 4, limit: 60 };
  if (tf === "1D") return { frame: "day", aggregate: 1, limit: 90 };
  return { frame: "hour", aggregate: 1, limit: 72 };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function topPool(mint: string): Promise<string> {
  const hit = poolCache.get(mint);
  if (hit && Date.now() - hit.at < 120_000) return hit.pool;
  const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}/pools?page=1`, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (res.status === 429 || !res.ok) return "";
  const json = (await res.json()) as { data?: { attributes?: { address?: string } }[] };
  const pool = json.data?.[0]?.attributes?.address ?? "";
  if (pool) poolCache.set(mint, { at: Date.now(), pool });
  return pool;
}

function llamaPeriod(tf: PrintTf): { period: string; step: number; limit: number } {
  if (tf === "15m") return { period: "15m", step: 15 * 60, limit: 96 };
  if (tf === "4H") return { period: "4h", step: 4 * 3600, limit: 60 };
  if (tf === "1D") return { period: "1d", step: 86400, limit: 90 };
  return { period: "1h", step: 3600, limit: 72 };
}

async function llamaCandles(mint: string, tf: PrintTf): Promise<PrintBar[]> {
  const q = llamaPeriod(tf);
  const now = Math.floor(Date.now() / 1000);
  const res = await fetch(
    `https://coins.llama.fi/chart/solana:${mint}?start=${now - q.step * (q.limit + 2)}&span=${q.limit}&period=${q.period}`,
    { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { coins?: Record<string, { prices?: Array<{ timestamp?: number; price?: number }> }> };
  const prices = Object.values(json.coins ?? {})[0]?.prices ?? [];
  const bars: PrintBar[] = [];
  for (const point of prices) {
    const px = Number(point.price);
    const t = Number(point.timestamp) * 1000;
    if (!(px > 0) || !(t > 0)) continue;
    const prev = bars.length ? bars[bars.length - 1].c : px;
    bars.push({ t, o: prev, h: Math.max(prev, px), l: Math.min(prev, px), c: px, v: 0 });
  }
  return bars;
}

async function pullCandles(mint: string, tf: PrintTf): Promise<{ bars: PrintBar[]; note: string }> {
  const key = `${mint}:${tf}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 90_000) return { bars: hit.bars, note: hit.note };
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    // Real USD-denominated pool OHLCV first. A price-only provider cannot supply volume.
    const pool = await topPool(mint).catch(() => "");
    if (pool) {
      const q = tfQuery(tf);
      // Request OHLC for the exact selected mint, not the other token in its pool.
      const endpoint = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${q.frame}?aggregate=${q.aggregate}&limit=${q.limit}&currency=usd&token=${encodeURIComponent(mint)}`;
      try {
        let res = await fetch(endpoint, { headers: { accept: "application/json", "user-agent": "Senda" } });
        if (res.status === 429) {
          await sleep(900);
          res = await fetch(endpoint, { headers: { accept: "application/json", "user-agent": "Senda" } });
        }
        if (res.ok) {
          const json = (await res.json()) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
          const bars: PrintBar[] = (json.data?.attributes?.ohlcv_list ?? [])
            .map((row) => ({
              t: Number(row[0]) * 1000, o: Number(row[1]), h: Number(row[2]),
              l: Number(row[3]), c: Number(row[4]), v: Number(row[5]),
            }))
            .filter((v) => Number.isFinite(v.t) && v.t > 0 && [v.o,v.h,v.l,v.c,v.v].every(Number.isFinite) &&
              v.o > 0 && v.c > 0 && v.h >= Math.max(v.o,v.c) && v.l > 0 &&
              v.l <= Math.min(v.o,v.c) && v.v >= 0)
            .sort((a,b) => a.t-b.t);
          if (bars.length >= 2) {
            const out = { bars, note: "Pool OHLCV · GeckoTerminal · USD volume" };
            candleCache.set(key, { at: Date.now(), ...out });
            return out;
          }
        }
      } catch { /* The fallback is explicitly price-only, never volume. */ }
    }
    try {
      const fromLlama = await llamaCandles(mint, tf);
      if (fromLlama.length >= 2) {
        const out = { bars: fromLlama, note: "Price-only proxy · DefiLlama · derived intervals · NO traded volume" };
        candleCache.set(key, { at: Date.now(), ...out });
        return out;
      }
    } catch { /* Nothing to show rather than synthetic candles. */ }
    return { bars: [], note: "No verified historical OHLCV available. Volume strategies disabled." };
  })().finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

export const getPrint = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        mint: z.string().min(32).max(48),
        tf: z.enum(["15m", "1H", "4H", "1D"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => pullCandles(data.mint, data.tf));
