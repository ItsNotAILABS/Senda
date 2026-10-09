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
  if (res.status === 429) return "";
  if (!res.ok) throw new Error(`Pools ${res.status}`);
  const json = (await res.json()) as { data?: { attributes?: { address?: string } }[] };
  const pool = json.data?.[0]?.attributes?.address ?? "";
  if (pool) poolCache.set(mint, { at: Date.now(), pool });
  return pool;
}

async function pullCandles(mint: string, tf: PrintTf): Promise<{ bars: PrintBar[]; note: string }> {
  const key = `${mint}:${tf}`;
  const hit = candleCache.get(key);
  if (hit && Date.now() - hit.at < 90_000) return { bars: hit.bars, note: hit.note };
  const pending = inflight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const pool = await topPool(mint);
    if (!pool) return { bars: [], note: "Candle feed is busy. The last price is still live." };
    const q = tfQuery(tf);
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
    if (!res.ok) return { bars: [], note: res.status === 429 ? "Candle feed is busy. The last price is still live." : `Print ${res.status}` };
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
    const out = { bars, note: bars.length ? "Pool candles." : "The pool returned no candles." };
    if (bars.length) candleCache.set(key, { at: Date.now(), ...out });
    return out;
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
        tf: z.enum(["15m", "1H", "4H", "1D"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => pullCandles(data.mint, data.tf));
