/** Logo and a short hourly line for any mint Jupiter can chart. No drawn series. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

export type TokenMark = { mint: string; icon: string; name: string; symbol: string; line: number[]; volume: number[]; vol24: number; poolVol: number; poolDex: string };

async function faceOf(mint: string): Promise<{ icon: string; name: string; symbol: string }> {
  const r = await cachedJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, 300_000);
  if (!r.ok || !Array.isArray(r.body)) return { icon: "", name: "", symbol: "" };
  const hit = (r.body as Array<{ id?: string; icon?: string; name?: string; symbol?: string }>).find((row) => row.id === mint);
  return { icon: hit?.icon || "", name: hit?.name || "", symbol: hit?.symbol || "" };
}

/** Last 24 hourly closes and their USD volume. Empty when Jupiter has no chart. */
async function shortLine(mint: string): Promise<{ line: number[]; volume: number[]; vol24: number }> {
  const to = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const r = await cachedJson(
    `https://datapi.jup.ag/v2/charts/${mint}?interval=1_HOUR&to=${to}&candles=24`,
    120_000,
  );
  if (!r.ok) return { line: [], volume: [], vol24: 0 };
  const candles = (r.body as { candles?: Array<{ close?: number; volume?: number }> }).candles || [];
  const line: number[] = [];
  const volume: number[] = [];
  for (const c of candles) {
    const close = Number(c.close);
    if (!(close > 0)) continue;
    line.push(close);
    volume.push(Number(c.volume) > 0 ? Number(c.volume) : 0);
  }
  const vol24 = volume.reduce((s, n) => s + n, 0);
  return { line, volume, vol24 };
}

async function poolPrint(mint: string): Promise<{ poolVol: number; poolDex: string }> {
  const r = await cachedJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, 180_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok) return { poolVol: 0, poolDex: "" };
  const pairs = ((r.body as { pairs?: Array<{ chainId?: string; dexId?: string; volume?: { h24?: number }; liquidity?: { usd?: number } }> }).pairs || [])
    .filter((p) => p.chainId === "solana")
    .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const top = pairs[0];
  return { poolVol: Number(top?.volume?.h24) || 0, poolDex: top?.dexId || "" };
}

export const loadMarks = createServerFn({ method: "POST" })
  .validator(z.object({ mints: z.array(z.string().min(32).max(48)).max(40), lines: z.boolean().optional() }))
  .handler(async ({ data }): Promise<TokenMark[]> => {
    const mints = [...new Set(data.mints)].slice(0, 40);
    const rows = await Promise.all(
      mints.map(async (mint) => {
        const [face, line, pool] = await Promise.all([
          faceOf(mint).catch(() => ({ icon: "", name: "", symbol: "" })),
          data.lines === false ? Promise.resolve({ line: [] as number[], volume: [] as number[], vol24: 0 }) : shortLine(mint).catch(() => ({ line: [] as number[], volume: [] as number[], vol24: 0 })),
          data.lines === false ? Promise.resolve({ poolVol: 0, poolDex: "" }) : poolPrint(mint).catch(() => ({ poolVol: 0, poolDex: "" })),
        ]);
        return { mint, icon: face.icon, name: face.name, symbol: face.symbol, line: line.line, volume: line.volume, vol24: line.vol24, poolVol: pool.poolVol, poolDex: pool.poolDex };
      }),
    );
    return rows;
  });
