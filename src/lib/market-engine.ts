/**
 * Outside-book math. Pure. No network.
 *
 * A pair can exist as three objects at once: a print (bid and ask on Arbitrum),
 * a perp (USDC margin on Base), and a hold (a mint on Solana).
 * The router prices the first two in basis points. It does not treat them as the same trade.
 */

export type BookSide = "long" | "short";

/** Distance from the mid to the price you cross, in basis points. */
export function crossBps(side: BookSide, bid: number | null, ask: number | null, mid: number | null): number | null {
  if (bid == null || ask == null || mid == null) return null;
  if (!(bid > 0) || !(ask >= bid) || !(mid > 0)) return null;
  const px = side === "long" ? ask : bid;
  return (Math.abs(px - mid) / mid) * 10_000;
}

/** Avantis openFeeP is in percent. 0.02 is 0.02 percent, which is 2 basis points. */
export function openFeeBps(openFeePercent: number | null): number | null {
  if (openFeePercent == null || !Number.isFinite(openFeePercent) || openFeePercent < 0) return null;
  return openFeePercent * 100;
}

/** Cost to get on, before funding. Spread you cross, plus the open fee. */
export function allInBps(spread: number | null, fee: number | null): number | null {
  if (spread == null && fee == null) return null;
  return (spread ?? 0) + (fee ?? 0);
}

/**
 * Isolated preview. Maintenance is half the margin you post.
 * At 5x, half the margin is 10 percent of notional.
 * Their contract liquidates. This is the number shown before the signature.
 */
export function previewLiq(entry: number | null, leverage: number, side: BookSide): number | null {
  if (entry == null || !(entry > 0) || !(leverage > 0)) return null;
  const move = 0.5 / leverage;
  if (side === "long" && move >= 1) return null;
  return side === "long" ? entry * (1 - move) : entry * (1 + move);
}

/** Hold minus the print, in basis points of the print. Positive means the token is rich. */
export function basisBps(spot: number | null, perp: number | null): number | null {
  if (spot == null || perp == null || !(spot > 0) || !(perp > 0)) return null;
  return ((spot - perp) / perp) * 10_000;
}

/** Euro-yen from euro-dollar and dollar-yen. */
export function productCross(left: number | null, right: number | null): number | null {
  if (left == null || right == null || !(left > 0) || !(right > 0)) return null;
  return left * right;
}

/** Pound-euro from pound-dollar over euro-dollar. */
export function ratioCross(num: number | null, den: number | null): number | null {
  if (num == null || den == null || !(num > 0) || !(den > 0)) return null;
  return num / den;
}

/** Open interest they still have room for. Null when either figure is missing. */
export function roomUsd(oi: number | null, maxOi: number | null): number | null {
  if (oi == null || maxOi == null || !Number.isFinite(oi) || !Number.isFinite(maxOi)) return null;
  return Math.max(0, maxOi - oi);
}

/** Null when the size can be built. Otherwise the sentence that blocks the signature. */
export function sizeBlock(notional: number, minNotional: number | null, room: number | null): string | null {
  if (!(notional > 0)) return "Set a margin and a leverage.";
  if (minNotional != null && notional + 1e-6 < minNotional) return `Base wants at least $${minNotional} of position.`;
  if (room != null && notional > room) return "That size is larger than the room left on their book.";
  return null;
}

/**
 * Dollar carry over a stated number of hours, from their hourly funding in percent.
 * The field is fundingFeePerHourP. Who pays is their contract. This is the magnitude.
 */
export function fundingUsd(notional: number, pctPerHour: number | null, hours: number): number | null {
  if (pctPerHour == null || !Number.isFinite(pctPerHour) || !(notional > 0) || !(hours > 0)) return null;
  return Math.abs(notional * (pctPerHour / 100) * hours);
}

/** Open pnl if the print moved from the entry. Long gains when the mark is higher. */
export function markPnl(side: BookSide, entry: number | null, mark: number | null, notional: number): number | null {
  if (entry == null || mark == null || !(entry > 0) || !(mark > 0) || !(notional > 0)) return null;
  const ret = (mark - entry) / entry;
  return (side === "long" ? ret : -ret) * notional;
}

/** How far the print is from the preview liquidation, in basis points of the print. */
export function liqGapBps(mark: number | null, liq: number | null): number | null {
  if (mark == null || liq == null || !(mark > 0) || !(liq > 0)) return null;
  return (Math.abs(mark - liq) / mark) * 10_000;
}

