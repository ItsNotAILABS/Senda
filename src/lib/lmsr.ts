/**
 * Binary LMSR (Hanson logarithmic market scoring rule).
 *
 * C(q) = b * ln(exp(qYes/b) + exp(qNo/b))
 * pYes = exp(qYes/b) / (exp(qYes/b) + exp(qNo/b))
 * cost(Δ) = C(q + Δ e_i) - C(q)
 *
 * Numerically stable: subtract max before exp (log-sum-exp).
 */

export const PHI = 1.618033988749895;
export const DEFAULT_B = 100 * PHI;
export const P_MIN = 0.02;
export const P_MAX = 0.98;

export type Side = "yes" | "no";

export class LmsrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LmsrError";
  }
}

function assertFinite(n: number, label: string): void {
  if (!Number.isFinite(n)) throw new LmsrError(`${label} is not finite`);
}

function logSumExp2(x: number, y: number): number {
  const m = Math.max(x, y);
  return m + Math.log(Math.exp(x - m) + Math.exp(y - m));
}

/** Cost function C(q). */
export function costFn(qYes: number, qNo: number, b: number): number {
  if (!(b > 0)) throw new LmsrError("b must be positive");
  assertFinite(qYes, "qYes");
  assertFinite(qNo, "qNo");
  return b * logSumExp2(qYes / b, qNo / b);
}

/** Implied YES probability in (0, 1). */
export function priceYes(qYes: number, qNo: number, b: number): number {
  if (!(b > 0)) throw new LmsrError("b must be positive");
  const a = qYes / b;
  const n = qNo / b;
  const m = Math.max(a, n);
  const eYes = Math.exp(a - m);
  const eNo = Math.exp(n - m);
  const z = eYes + eNo;
  if (!(z > 0) || !Number.isFinite(z)) return 0.5;
  return eYes / z;
}

export function priceNo(qYes: number, qNo: number, b: number): number {
  return 1 - priceYes(qYes, qNo, b);
}

/** Chip cost to buy `shares` of `side`. */
export function costToBuy(
  qYes: number,
  qNo: number,
  b: number,
  side: Side,
  shares: number,
): number {
  if (!(shares > 0) || !Number.isFinite(shares)) {
    throw new LmsrError("shares must be positive");
  }
  const nYes = side === "yes" ? qYes + shares : qYes;
  const nNo = side === "no" ? qNo + shares : qNo;
  const cost = costFn(nYes, nNo, b) - costFn(qYes, qNo, b);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new LmsrError("cost computation failed");
  }
  return cost;
}

export type TradeQuote = {
  qYes: number;
  qNo: number;
  cost: number;
  shares: number;
  pYes: number;
  pYesAfter: number;
};

/**
 * Apply a share-sized trade. Rejects bets that would push p outside (0.02, 0.98).
 */
export function applyTrade(
  qYes: number,
  qNo: number,
  b: number,
  side: Side,
  shares: number,
): TradeQuote {
  const cost = costToBuy(qYes, qNo, b, side, shares);
  const nYes = side === "yes" ? qYes + shares : qYes;
  const nNo = side === "no" ? qNo + shares : qNo;
  const pYesAfter = priceYes(nYes, nNo, b);
  if (pYesAfter <= P_MIN || pYesAfter >= P_MAX) {
    throw new LmsrError("trade would push price outside (0.02, 0.98)");
  }
  return {
    qYes: nYes,
    qNo: nNo,
    cost,
    shares,
    pYes: priceYes(qYes, qNo, b),
    pYesAfter,
  };
}

/**
 * Invert LMSR cost: largest Δ of `side` whose cost equals `spend`.
 *
 * Closed form, log-sum-exp stable:
 *   Δ_yes = b * ln(exp((C+spend)/b) - exp(qNo/b)) - qYes
 */
export function sharesFromSpend(
  qYes: number,
  qNo: number,
  b: number,
  side: Side,
  spend: number,
): number {
  if (!(spend > 0) || !Number.isFinite(spend)) {
    throw new LmsrError("spend must be positive");
  }
  if (!(b > 0)) throw new LmsrError("b must be positive");

  const C = costFn(qYes, qNo, b);
  const A = (C + spend) / b;

  if (side === "yes") {
    const B = qNo / b;
    if (A <= B + 1e-12) throw new LmsrError("spend too small to size a fill");
    const logDiff = A + Math.log1p(-Math.exp(B - A));
    const delta = b * logDiff - qYes;
    if (!Number.isFinite(delta) || delta <= 0) {
      throw new LmsrError("could not size YES fill");
    }
    return delta;
  }

  const B = qYes / b;
  if (A <= B + 1e-12) throw new LmsrError("spend too small to size a fill");
  const logDiff = A + Math.log1p(-Math.exp(B - A));
  const delta = b * logDiff - qNo;
  if (!Number.isFinite(delta) || delta <= 0) {
    throw new LmsrError("could not size NO fill");
  }
  return delta;
}

/** Quote a chip-sized drop: spend `chips` on `side`. */
export function quoteSpend(
  qYes: number,
  qNo: number,
  b: number,
  side: Side,
  spend: number,
): TradeQuote {
  const shares = sharesFromSpend(qYes, qNo, b, side, spend);
  return applyTrade(qYes, qNo, b, side, shares);
}

/** Seed LMSR inventory so implied pYes ≈ street. */
export function qFromProb(p: number, b: number): { qYes: number; qNo: number } {
  if (!(b > 0)) throw new LmsrError("b must be positive");
  const pClamp = Math.min(P_MAX, Math.max(P_MIN, p));
  return {
    qYes: b * Math.log(pClamp),
    qNo: b * Math.log(1 - pClamp),
  };
}

export function markToMarket(
  yesShares: number,
  noShares: number,
  pYes: number,
): number {
  const p = Math.min(1, Math.max(0, pYes));
  return yesShares * p + noShares * (1 - p);
}

