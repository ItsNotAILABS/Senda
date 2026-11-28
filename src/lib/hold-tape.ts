/** Hour, day, and week moves for mints this wallet already holds. A missing print stays null. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HoldMove = {
  mint: string;
  price: number;
  hour: number | null;
  day: number | null;
  week: number | null;
};

type GeckoToken = {
  attributes?: {
    address?: string;
    price_usd?: string;
    price_change_percentage?: { h1?: string; h24?: string; d7?: string };
  };
};

function num(raw: string | number | undefined | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export const loadHoldTape = createServerFn({ method: "POST" })
  .validator(z.object({ mints: z.array(z.string().min(32).max(48)).max(30) }))
  .handler(async ({ data }): Promise<HoldMove[]> => {
    const mints = [...new Set(data.mints)];
    if (!mints.length) return [];
    const [priceRes, geckoRes] = await Promise.all([
      fetch(`https://lite-api.jup.ag/price/v3?ids=${mints.join(",")}`, { headers: { accept: "application/json" } }),
      fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/multi/${mints.join(",")}`, {
        headers: { accept: "application/json" },
      }),
    ]);
    const prices = priceRes.ok
      ? ((await priceRes.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>)
      : {};
    const gecko = geckoRes.ok ? ((await geckoRes.json()) as { data?: GeckoToken[] }) : {};
    const byMint = new Map<string, GeckoToken["attributes"]>();
    for (const row of gecko.data ?? []) {
      const mint = row.attributes?.address;
      if (mint) byMint.set(mint, row.attributes);
    }
    return mints.map((mint) => {
      const px = prices[mint];
      const g = byMint.get(mint);
      const day = num(g?.price_change_percentage?.h24) ?? num(px?.priceChange24h);
      return {
        mint,
        price: Number(px?.usdPrice) || Number(g?.price_usd) || 0,
        hour: num(g?.price_change_percentage?.h1),
        day,
        week: num(g?.price_change_percentage?.d7),
      };
    });
  });
