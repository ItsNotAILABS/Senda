/** Logo and a short hourly line for any mint Jupiter can chart. No drawn series. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";

export type TokenMark = { mint: string; icon: string; line: number[] };

async function iconOf(mint: string): Promise<string> {
  const r = await cachedJson(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, 300_000);
  if (!r.ok || !Array.isArray(r.body)) return "";
  const hit = (r.body as Array<{ id?: string; icon?: string }>).find((row) => row.id === mint);
  return hit?.icon || "";
}

/** Last 24 hourly closes. Empty when Jupiter has no chart for the mint. */
async function shortLine(mint: string): Promise<number[]> {
  const to = Math.floor(Date.now() / 3_600_000) * 3_600_000;
  const r = await cachedJson(
    `https://datapi.jup.ag/v2/charts/${mint}?interval=1_HOUR&to=${to}&candles=24`,
    120_000,
  );
  if (!r.ok) return [];
  const candles = (r.body as { candles?: Array<{ close?: number }> }).candles || [];
  return candles.map((c) => Number(c.close)).filter((n) => n > 0);
}

export const loadMarks = createServerFn({ method: "POST" })
  .validator(z.object({ mints: z.array(z.string().min(32).max(48)).max(40), lines: z.boolean().optional() }))
  .handler(async ({ data }): Promise<TokenMark[]> => {
    const mints = [...new Set(data.mints)].slice(0, 40);
    const rows = await Promise.all(
      mints.map(async (mint) => {
        const [icon, line] = await Promise.all([
          iconOf(mint).catch(() => ""),
          data.lines === false ? Promise.resolve([] as number[]) : shortLine(mint).catch(() => [] as number[]),
        ]);
        return { mint, icon, line };
      }),
    );
    return rows;
  });
