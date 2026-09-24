/**
 * Double-entry cage. Every chip move posts two (or more) legs.
 * Invariant: Σ Dr = Σ Cr. If variance ≠ 0, the pit freezes.
 *
 * Chart of accounts:
 *   1000 House float (asset)
 *   1100 Player chips outstanding (liability)
 *   1200 Market YES inventory (liability at par)
 *   1210 Market NO inventory (liability at par)
 *   4000 LMSR surplus
 *   5000 Resolution payouts
 */

import type { Side } from "@/lib/lmsr";

export const ACCOUNTS = {
  HOUSE_FLOAT: "1000",
  PLAYER_CHIPS: "1100",
  YES_INV: "1200",
  NO_INV: "1210",
  LMSR_SURPLUS: "4000",
  RESOLUTION: "5000",
} as const;

export type AccountCode = (typeof ACCOUNTS)[keyof typeof ACCOUNTS];

export const ACCOUNT_LABEL: Record<AccountCode, string> = {
  "1000": "House float",
  "1100": "Player chips",
  "1200": "YES inventory",
  "1210": "NO inventory",
  "4000": "LMSR surplus",
  "5000": "Resolution payouts",
};

export type LedgerLeg = {
  account: AccountCode;
  dr: number;
  cr: number;
  ref: string;
};

export const VARIANCE_EPS = 0.005;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function round4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

export function sumDrCr(legs: { dr: number; cr: number }[]): {
  dr: number;
  cr: number;
  variance: number;
} {
  const dr = round2(legs.reduce((s, l) => s + Number(l.dr || 0), 0));
  const cr = round2(legs.reduce((s, l) => s + Number(l.cr || 0), 0));
  return { dr, cr, variance: round2(dr - cr) };
}

export function assertBalanced(legs: { dr: number; cr: number }[]): number {
  const { variance } = sumDrCr(legs);
  if (Math.abs(variance) > VARIANCE_EPS) {
    throw new Error(`unbalanced posting: variance ${variance.toFixed(2)}`);
  }
  return variance;
}

export function isFrozen(variance: number): boolean {
  return Math.abs(round2(variance)) > VARIANCE_EPS;
}

/** Buy-in: Dr 1000 / Cr 1100. */
export function buyInLegs(chips: number, ref: string): LedgerLeg[] {
  const amt = round2(chips);
  if (!(amt > 0)) throw new Error("buy-in must be positive");
  const legs: LedgerLeg[] = [
    { account: ACCOUNTS.HOUSE_FLOAT, dr: amt, cr: 0, ref },
    { account: ACCOUNTS.PLAYER_CHIPS, dr: 0, cr: amt, ref },
  ];
  assertBalanced(legs);
  return legs;
}

/** Cash-out: reverse the buy-in for remaining chips. */
export function cashOutLegs(chips: number, ref: string): LedgerLeg[] {
  const amt = round2(chips);
  if (!(amt > 0)) throw new Error("cash-out must be positive");
  const legs: LedgerLeg[] = [
    { account: ACCOUNTS.PLAYER_CHIPS, dr: amt, cr: 0, ref },
    { account: ACCOUNTS.HOUSE_FLOAT, dr: 0, cr: amt, ref },
  ];
  assertBalanced(legs);
  return legs;
}

/**
 * Buy YES/NO from the LMSR dealer.
 * Player chips down at cost; inventory up at par (1 chip / share);
 * remainder to 4000 LMSR surplus (signed either way).
 */
export function tradeLegs(
  side: Side,
  cost: number,
  shares: number,
  ref: string,
): LedgerLeg[] {
  const c = round2(cost);
  const s = round2(shares);
  if (!(c > 0) || !(s > 0)) throw new Error("trade must have positive cost and shares");
  const inv = side === "yes" ? ACCOUNTS.YES_INV : ACCOUNTS.NO_INV;
  const surplus = round2(c - s);
  const legs: LedgerLeg[] = [
    { account: ACCOUNTS.PLAYER_CHIPS, dr: c, cr: 0, ref },
    { account: inv, dr: 0, cr: s, ref },
  ];
  if (surplus >= 0) {
    legs.push({ account: ACCOUNTS.LMSR_SURPLUS, dr: 0, cr: surplus, ref });
  } else {
    legs.push({ account: ACCOUNTS.LMSR_SURPLUS, dr: round2(-surplus), cr: 0, ref });
  }
  assertBalanced(legs);
  return legs;
}

/**
 * Resolve YES: winning shares pay 1 into player chips via 5000;
 * YES inventory clears; NO inventory written off to surplus.
 */
export function resolveYesLegs(
  yesShares: number,
  noShares: number,
  ref: string,
): LedgerLeg[] {
  const y = round2(yesShares);
  const n = round2(noShares);
  const legs: LedgerLeg[] = [];
  if (y > 0) {
    legs.push({ account: ACCOUNTS.RESOLUTION, dr: y, cr: 0, ref });
    legs.push({ account: ACCOUNTS.PLAYER_CHIPS, dr: 0, cr: y, ref });
    legs.push({ account: ACCOUNTS.YES_INV, dr: y, cr: 0, ref });
    legs.push({ account: ACCOUNTS.RESOLUTION, dr: 0, cr: y, ref });
  }
  if (n > 0) {
    legs.push({ account: ACCOUNTS.NO_INV, dr: n, cr: 0, ref });
    legs.push({ account: ACCOUNTS.LMSR_SURPLUS, dr: 0, cr: n, ref });
  }
  if (legs.length) assertBalanced(legs);
  return legs;
}

export function resolveNoLegs(
  yesShares: number,
  noShares: number,
  ref: string,
): LedgerLeg[] {
  const y = round2(yesShares);
  const n = round2(noShares);
  const legs: LedgerLeg[] = [];
  if (n > 0) {
    legs.push({ account: ACCOUNTS.RESOLUTION, dr: n, cr: 0, ref });
    legs.push({ account: ACCOUNTS.PLAYER_CHIPS, dr: 0, cr: n, ref });
    legs.push({ account: ACCOUNTS.NO_INV, dr: n, cr: 0, ref });
    legs.push({ account: ACCOUNTS.RESOLUTION, dr: 0, cr: n, ref });
  }
  if (y > 0) {
    legs.push({ account: ACCOUNTS.YES_INV, dr: y, cr: 0, ref });
    legs.push({ account: ACCOUNTS.LMSR_SURPLUS, dr: 0, cr: y, ref });
  }
  if (legs.length) assertBalanced(legs);
  return legs;
}
