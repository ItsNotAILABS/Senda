/** A pass over a book already in memory. No quote, no signature. */

import { basisBps } from "@/lib/market-engine";

export type BotName = { symbol: string; mint: string; last: number; mark: number };

export type BotHit = BotName & { bps: number };

/** Cheap is last under the mark. Rich is last over it. Inside 20 bps is noise. */
export function readBook(rows: BotName[]): { cheap: BotHit | null; rich: BotHit | null; moved: BotName | null } {
  const scored: BotHit[] = [];
  for (const row of rows) {
    if (!(row.last > 0) || !(row.mark > 0)) continue;
    const bps = basisBps(row.last, row.mark);
    if (bps == null) continue;
    scored.push({ ...row, bps });
  }
  scored.sort((a, b) => a.bps - b.bps);
  const cheap = scored[0] && scored[0].bps <= -20 ? scored[0] : null;
  const richEnd = scored[scored.length - 1];
  const rich = richEnd && richEnd.bps >= 20 && richEnd.mint !== cheap?.mint ? richEnd : null;
  return { cheap, rich, moved: null };
}
