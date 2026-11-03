/**
 * Outside-book math. Pure. No network.
 *
 * A pair can exist as three different objects at once:
 * a print (bid/ask on Arbitrum), a perp (margin on Base), and a hold (a mint on Solana).
 * The router prices the first two in basis points. It does not pretend they are the same trade.
 */

export type BookSide = "long" | "short";

/** Half-spread you pay to cross, in basis points of the mid. */
export function crossBps(side: BookSide, bid: number | null, ask: number | null, mid: number | null): number | null {
  if (bid == null || ask == null || mid == null) return null;
  if (!(bid > 0) || !(ask >= bid) || !(mid > 0)) return null;
  const px = side === "long" ? ask : bid;
  return (Math.abs(px - mid) / mid) * 10_000;
}

/**
 * Avantis publishes openFeeP in percent. 0.02 is 0.02%, which is 2 basis points.
 */
export function openFeeBps(openFeePercent: number | null): number | null {
  if (openFeePercent == null || !Number.isFinite(openFeePercent) || openFeePercent < 0) return null;
  return openFeePercent * 100;
}

/** What it costs to get on, ignoring funding. Spread you cross plus the open fee. */
export function allInBps(spread: number | null, fee: number | null): number | null {
  if (spread == null && fee == null) return null;
  return (spread ?? 0) + (fee ?? 0);
}

/**
 * Isolated preview. Maintenance is half the posted margin.
 * A 5x long previews a liquidation 10% under the entry (0.5 / 5).
 * The venue contract is the authority. This number is what we show before the signature.
 */
export function previewLiq(entry: number | null, leverage: number, side: BookSide): number | null {
  if (entry == null || !(entry > 0) || !(leverage > 0)) return null;
  const move = 0.5 / leverage;
  if (side === "long" && move >= 1) return null;
  return side === "long" ? entry * (1 - move) : entry * (1 + move);
}

/** Spot hold minus the perp mid, in basis points of the perp. Positive means the token is rich. */
export function basisBps(spot: number | null, perp: number | null): number | null {
  if (spot == null || perp == null || !(spot > 0) || !(perp > 0)) return null;
  return ((spot - perp) / perp) * 10_000;
}

/** EUR/JPY from EUR/USD and USD/JPY. */
export function productCross(left: number | null, right: number | null): number | null {
  if (left == null || right == null || !(left > 0) || !(right > 0)) return null;
  return left * right;
}

/** GBP/EUR from GBP/USD and EUR/USD. */
export function ratioCross(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !(num > 0) || !(den > 0)) return null;
  return num / den;
}

export type Door = {
  name: "Base" | "Arbitrum" | "Solana";
  kind: "perp" | "print" | "hold";
  bps: number | null;
  signs: boolean;
};

/** Rank the doors we can actually describe. Solana is a hold, so it is not scored against a perp. */
export function doors(input: {
  side: BookSide;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  openFee: number | null;
  hasPerp: boolean;
  hasPrint: boolean;
  hasHold: boolean;
}): Door[] {
  const spread = crossBps(input.side, input.bid, input.ask, input.mid);
  const fee = openFeeBps(input.openFee);
  const out: Door[] = [];
  if (input.hasPrint) out.push({ name: "Arbitrum", kind: "print", bps: spread, signs: false });
  if (input.hasPerp) out.push({ name: "Base", kind: "perp", bps: allInBps(spread, fee), signs: true });
  if (input.hasHold) out.push({ name: "Solana", kind: "hold", bps: null, signs: true });
  return out;
}
