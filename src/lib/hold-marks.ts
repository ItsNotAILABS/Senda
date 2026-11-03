/** Names, logos, and last prices for the mints a wallet holds. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HoldMark = {
  symbol: string;
  name: string;
  icon: string;
  usd: number;
  chg: number;
};

export const SOL_MINT = "So11111111111111111111111111111111111111112";

export const markHolds = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.array(z.string().min(32).max(48)).max(24).parse(input))
  .handler(async ({ data }): Promise<Record<string, HoldMark>> => {
    const out: Record<string, HoldMark> = {};
    await Promise.all(
      data.map(async (mint) => {
        try {
          const r = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(mint)}`, {
            headers: { accept: "application/json", "user-agent": "Senda" },
            signal: AbortSignal.timeout(8000),
          });
          if (!r.ok) return;
          const body = (await r.json()) as Array<{ id?: string; symbol?: string; name?: string; icon?: string; usdPrice?: number; stats24h?: { priceChange?: number } }>;
          const row = body.find((item) => item.id === mint) ?? body[0];
          if (!row?.symbol) return;
          out[mint] = {
            symbol: row.symbol,
            name: row.name || row.symbol,
            icon: row.icon || "",
            usd: Number(row.usdPrice) || 0,
            chg: Number(row.stats24h?.priceChange) || 0,
          };
        } catch {
          /* The row still shows the chain balance. */
        }
      }),
    );
    return out;
  });
