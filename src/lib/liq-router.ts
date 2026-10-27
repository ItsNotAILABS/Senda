/** Rank a desk by reported pool depth. A rank is not a fill. */

export type PoolRow = { id: string; liquidity: number; last: number };

export function admit(usd: number, liquidity: number) {
  if (!(liquidity > 0)) return { ok: true as const, reason: "Pool size was not reported. The quote is the check." };
  if (!(usd > 0)) return { ok: false as const, reason: "Enter a size." };
  if (usd > liquidity * 0.05) {
    return { ok: false as const, reason: `$${usd.toFixed(0)} is over 5% of the $${Math.round(liquidity).toLocaleString("en-US")} pool.` };
  }
  return { ok: true as const, reason: "" };
}

/** Names that can hold the size come first. Then the deeper pool. */
export function liquidFirst<T extends PoolRow>(rows: T[], usd: number): T[] {
  return [...rows].sort((a, b) => {
    const fit = (row: PoolRow) => (row.liquidity <= 0 || usd <= row.liquidity * 0.05 ? 1 : 0);
    const gap = fit(b) - fit(a);
    if (gap !== 0) return gap;
    return b.liquidity - a.liquidity;
  });
}

export function emptyBook(kind: "bids" | "asks" | "names") {
  if (kind === "names") return "Nothing loaded. This list is not a bid book. A Jupiter pool is a separate market.";
  if (kind === "bids") return "No long margin yet. This is price exposure, not a share. The first USDC you post is the first bid.";
  return "No short margin yet. This is price exposure, not a share. The first USDC you post is the first ask.";
}
