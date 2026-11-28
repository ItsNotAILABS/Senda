/** Pool candles for a Solana mint. GeckoTerminal OHLCV. Empty if the mint has no pool. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PrintBar = { t: number; o: number; h: number; l: number; c: number; v: number };
export type PrintTf = "1m" | "3m" | "5m" | "15m" | "30m" | "1H" | "2H" | "4H" | "8H" | "12H" | "1D";

const poolCache = new Map<string, { at: number; pool: string }>();
const candleCache = new Map<string, { at: number; bars: PrintBar[]; note: string }>();
const inflight = new Map<string, Promise<{ bars: PrintBar[]; note: string }>>();

function tfQuery(tf: PrintTf): { frame: string; aggregate: number; limit: number } {
  if (tf === "1m") return { frame: "minute", aggregate: 1, limit: 180 };
  if (tf === "3m") return { frame: "minute", aggregate: 3, limit: 180 };
  if (tf === "5m") return { frame: "minute", aggregate: 5, limit: 160 };
  if (tf === "15m") return { frame: "minute", aggregate: 15, limit: 160 };
  if (tf === "30m") return { frame: "minute", aggregate: 30, limit: 160 };
  if (tf === "2H") return { frame: "hour", aggregate: 2, limit: 120 };
  if (tf === "4H") return { frame: "hour", aggregate: 4, limit: 120 };
  if (tf === "8H") return { frame: "hour", aggregate: 8, limit: 90 };
  if (tf === "12H") return { frame: "hour", aggregate: 12, limit: 90 };
  if (tf === "1D") return { frame: "day", aggregate: 1, limit: 120 };
  return { frame: "hour", aggregate: 1, limit: 160 };
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
  if (tf === "1m") return { period: "1m", step: 60, limit: 180 };
  if (tf === "5m") return { period: "5m", step: 300, limit: 160 };
  if (tf === "15m") return { period: "15m", step: 15 * 60, limit: 160 };
  if (tf === "30m") return { period: "30m", step: 1800, limit: 160 };
  if (tf === "4H") return { period: "4h", step: 4 * 3600, limit: 120 };
  if (tf === "1D") return { period: "1d", step: 86400, limit: 120 };
  return { period: "1h", step: 3600, limit: 160 };
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

async function pullCandles(mint: string, tf: PrintTf, source: "pool" | "mark" = "pool"): Promise<{ bars: PrintBar[]; note: string }> {
  const key = `${mint}:${tf}:${source}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 90_000) return { bars: hit.bars, note: hit.note };
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    if (source === "mark") {
      try {
        const fromLlama = await llamaCandles(mint, tf);
        if (fromLlama.length >= 2) {
          const out = { bars: fromLlama, note: "DefiLlama mark. Not the pool, and not Phantom’s chart." };
          candleCache.set(key, { at: Date.now(), ...out });
          return out;
        }
      } catch {
        /* The mark feed did not answer. */
      }
      return { bars: [], note: "The mark feed did not answer." };
    }
    const pool = await topPool(mint);
    const q = tfQuery(tf);
    if (pool) {
      let res = await fetch(
        `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${q.frame}?aggregate=${q.aggregate}&limit=${q.limit}&currency=usd`,
        { headers: { accept: "application/json", "user-agent": "Senda" } },
      );
      if (res.status === 429) {
        await sleep(900);
        res = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/solana/pools/${pool}/ohlcv/${q.frame}?aggregate=${q.aggregate}&limit=${q.limit}&currency=usd`,
          { headers: { accept: "application/json", "user-agent": "Senda" } },
        );
      }
      if (res.ok) {
        const json = (await res.json()) as { data?: { attributes?: { ohlcv_list?: number[][] } } };
        const raw = json.data?.attributes?.ohlcv_list ?? [];
        const bars: PrintBar[] = raw
          .map((row) => ({
            t: Number(row[0]) * 1000,
            o: Number(row[1]),
            h: Number(row[2]),
            l: Number(row[3]),
            c: Number(row[4]),
            v: Number(row[5]),
          }))
          .filter((b) => b.t > 0 && b.h > 0 && b.l > 0)
          .sort((a, b) => a.t - b.t);
        if (bars.length >= 2 && bars.some((b) => b.v > 0)) {
          const out = { bars, note: "Pool candles." };
          candleCache.set(key, { at: Date.now(), ...out });
          return out;
        }
      }
    }
    try {
      const fromLlama = await llamaCandles(mint, tf);
      if (fromLlama.length >= 2) {
        const out = { bars: fromLlama, note: "Price history. This feed has no volume." };
        candleCache.set(key, { at: Date.now(), ...out });
        return out;
      }
    } catch {
      /* The pool print already ran. */
    }
    return { bars: [], note: "Candle feed is busy. The last price is still live." };
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, job);
  return job;
}

export const getPrint = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        mint: z.string().min(32).max(48),
        tf: z.enum(["1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "8H", "12H", "1D"]),
        source: z.enum(["pool", "mark"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => pullCandles(data.mint, data.tf, data.source ?? "pool"));
