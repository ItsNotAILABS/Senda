/**
 * Rules for a five-dollar Jupiter account.
 * A round trip on that size usually costs the spread plus the fee, so the
 * agent only buys a liquid name already down on the day, and it sells on a
 * wider win than the loss. Most hours it does nothing. A rule is not a profit.
 */

export const DIP_LO = -0.08;
export const DIP_HI = -0.02;
export const DIP_MID = -0.04;
export const TAKE = 0.04;
export const STOP = -0.025;
export const HOLD_MS = 36 * 60 * 60 * 1000;
export const MAX_USD = 5;
export const MIN_USD = 1;
export const MIN_LIQ = 250_000;
export const MAX_IMPACT = 0.5;

const CASH = new Set(["USDC", "USDT", "USD1", "PYUSD", "CASH", "USDS", "UXD"]);

export type DipTick = {
  id: string;
  symbol: string;
  price: number;
  /** Fractional day change. −0.03 is down 3%. */
  change: number;
  liq?: number;
};

export function inDipBand(change: number): boolean {
  return change >= DIP_LO && change <= DIP_HI;
}

/** The liquid name closest to a 4% down day. Crashes and stables are skipped. */
export function pickDip(rows: DipTick[]): DipTick | null {
  const band = rows.filter((row) => row.price > 0 && !CASH.has(row.symbol.toUpperCase()) && (row.liq ?? 0) >= MIN_LIQ && inDipBand(row.change));
  if (!band.length) return null;
  return [...band].sort((a, b) => Math.abs(a.change - DIP_MID) - Math.abs(b.change - DIP_MID))[0];
}

export function clipUsd(balance: number): number {
  if (!(balance >= MIN_USD)) return 0;
  return Math.min(MAX_USD, Math.floor(balance * 100) / 100);
}

export function exitReason(entry: number, last: number, openedAt: number, now: number): "take" | "stop" | "time" | null {
  if (!(entry > 0) || !(last > 0) || !(openedAt > 0)) return null;
  const pnl = last / entry - 1;
  if (pnl >= TAKE) return "take";
  if (pnl <= STOP) return "stop";
  if (now - openedAt >= HOLD_MS) return "time";
  return null;
}
