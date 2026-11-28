/** Western Union USDPT on Solana. Jupiter marks this mint verified. The pump.fun name is a different coin. */

export const USDPT = "HVWf8JmLoHs99Lw8Psf3fyqAtA4crWxCPkrmSdNjhNH3";

export type UsdptLive = {
  supply: number;
  holders: number;
  price: number;
  liquidity: number;
};

export function pickUsdpt(rows: unknown): UsdptLive | null {
  if (!Array.isArray(rows)) return null;
  const hit = rows.find((row) => {
    if (!row || typeof row !== "object") return false;
    const coin = row as { id?: string; symbol?: string; isVerified?: boolean };
    return coin.id === USDPT && coin.symbol === "USDPT" && coin.isVerified === true;
  }) as { circSupply?: number; holderCount?: number; usdPrice?: number; liquidity?: number } | undefined;
  if (!hit) return null;
  const supply = Number(hit.circSupply);
  const price = Number(hit.usdPrice);
  const holders = Number(hit.holderCount);
  const liquidity = Number(hit.liquidity);
  if (!(supply > 0) || !(price > 0)) return null;
  return {
    supply,
    price,
    holders: Number.isFinite(holders) && holders >= 0 ? holders : 0,
    liquidity: Number.isFinite(liquidity) && liquidity >= 0 ? liquidity : 0,
  };
}

/** The issuer peg is one dollar. This is the public pool, which is a different number. */
export function poolNote(liquidity: number): string {
  if (!(liquidity > 0)) return "Jupiter did not show a public pool.";
  const shown = liquidity >= 1000 ? `$${Math.round(liquidity).toLocaleString("en-US")}` : `$${Math.round(liquidity)}`;
  if (liquidity < 1000) return `The public pool is ${shown}. A large swap will not clear there.`;
  return `The public pool is ${shown}.`;
}
