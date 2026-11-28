/** Senda's own option math. The premium is this model, not a market-maker bid. */

export type StackSide = "call" | "put";

export type Deal = {
  side: StackSide;
  spot: number;
  size: number;
  liftPct: number;
  days: number;
  strike: number;
  sol: number;
  usdc: number;
};

export function deal(input: {
  side: StackSide;
  spot: number;
  size: number;
  liftPct: number;
  days: number;
}): Deal | null {
  if (!(input.spot > 0) || !(input.size > 0) || !(input.liftPct >= 0) || input.liftPct >= 80) return null;
  if (![7, 14, 28].includes(input.days)) return null;
  const strike = input.side === "call" ? input.spot * (1 + input.liftPct / 100) : input.spot * (1 - input.liftPct / 100);
  if (!(strike > 0)) return null;
  if (input.side === "call") return { ...input, strike, sol: input.size, usdc: input.size * strike };
  return { ...input, strike, sol: input.size / strike, usdc: input.size };
}

/** A call is assigned only above the strike. A put is assigned only below it. Equals keeps the collateral. */
export function assigned(side: StackSide, finish: number, strike: number): boolean {
  if (!(finish > 0) || !(strike > 0)) return false;
  return side === "call" ? finish > strike : finish < strike;
}

/** One day's percent move, annualized. A flat day is not a volatility. */
export function annualVol(dayMovePct: number): number | null {
  if (!Number.isFinite(dayMovePct) || dayMovePct === 0) return null;
  const vol = (Math.abs(dayMovePct) / 100) * Math.sqrt(365);
  if (!(vol > 0) || vol > 5) return null;
  return vol;
}

function cdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t) * Math.exp(-a * a);
  return 0.5 * (1 + sign * y);
}

/** Black-Scholes, zero rates. Dollars for the SOL size on the deal. */
export function modelPremium(input: { side: StackSide; spot: number; strike: number; sol: number; days: number; vol: number }): number | null {
  if (!(input.spot > 0) || !(input.strike > 0) || !(input.sol > 0) || !(input.days > 0) || !(input.vol > 0)) return null;
  const t = input.days / 365;
  const root = input.vol * Math.sqrt(t);
  if (!(root > 0)) return null;
  const d1 = (Math.log(input.spot / input.strike) + (input.vol * input.vol * 0.5) * t) / root;
  const d2 = d1 - root;
  const per = input.side === "call"
    ? input.spot * cdf(d1) - input.strike * cdf(d2)
    : input.strike * cdf(-d2) - input.spot * cdf(-d1);
  if (!(per > 0)) return null;
  return per * input.sol;
}

export function windowAverage(prints: number[]): number | null {
  const rows = prints.filter((n) => n > 0 && Number.isFinite(n));
  if (rows.length < 2) return null;
  return rows.reduce((sum, n) => sum + n, 0) / rows.length;
}
