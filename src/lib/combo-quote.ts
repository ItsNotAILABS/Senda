/**
 * Quote for a 60-second digital rainbow on tokenized pre-IPO names.
 *
 * Leg i: P(last finishes the minute on the chosen side of minute-open).
 * Two-leg joint: Bernoulli copula with signed ρ (opposite sides flip sign).
 * n-leg, same side: 1-factor Gaussian copula.
 * Same-name Tessera/PreStocks is a wrapper stack (ρ = 0.82), not two names.
 *
 * ρ is a structural prior, not a rolling estimate. Paper quote. Not a CLOB.
 */

import type { MinuteSide } from "@/lib/minute-book";
import type { HouseListing } from "@/lib/sol-house";

export type QuoteLeg = {
  marketId: string;
  symbol: string;
  sector: string;
  side: MinuteSide;
  last: number;
  open: number;
  change24h: number | null;
};

export type ComboQuote = {
  n: number;
  pIndep: number;
  pJoint: number;
  rho: number;
  naivePays: number;
  fairPays: number;
  warnings: string[];
  legs: Array<QuoteLeg & { p: number }>;
};

const VIG = 0.03;
const NAIVE = 1.9;
const RHO_FAMILY = 0.82;
const RHO_SECTOR = 0.4;
const RHO_CROSS = 0.12;

export function familyOf(symbol: string): string {
  const s = symbol.toUpperCase().replace(/^T-/, "").replace(/[^A-Z]/g, "");
  if (s.includes("KALSHI")) return "kalshi";
  if (s.includes("POLY")) return "polymarket";
  if (s.includes("OPENAI")) return "openai";
  if (s.includes("ANTHROP")) return "anthropic";
  if (s.includes("SPACE")) return "spacex";
  if (s.includes("ANDURIL")) return "anduril";
  if (s.includes("NEURAL")) return "neuralink";
  if (s.includes("FIGURE")) return "figure";
  return s || "other";
}

export function pairRho(a: { family: string; sector: string }, b: { family: string; sector: string }): number {
  if (a.family && a.family === b.family) return RHO_FAMILY;
  if (a.sector && a.sector === b.sector) return RHO_SECTOR;
  return RHO_CROSS;
}

function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function invNorm(p: number): number {
  const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
  if (q === 0.5) return 0;
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  let x: number;
  if (q < plow) {
    const t = Math.sqrt(-2 * Math.log(q));
    x = (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) / ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
  } else if (q > phigh) {
    const t = Math.sqrt(-2 * Math.log(1 - q));
    x =
      -(((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) /
      ((((d[0] * t + d[1]) * t + d[2]) * t + d[3]) * t + 1);
  } else {
    const t = q - 0.5;
    const r = t * t;
    x =
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      t /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  return x;
}

/** P(finish above open | now). Digital, remaining time of this minute. */
export function pFinishUp(last: number, open: number, change24h: number | null, remainingMs: number): number {
  if (!(last > 0) || !(open > 0)) return 0.5;
  const tau = Math.max(remainingMs / 60_000, 1 / 60);
  const daily = Math.max(Math.abs(change24h ?? 0), 0.015);
  const sig = (daily / Math.sqrt(1440)) * Math.sqrt(tau) * last;
  const z = (last - open) / Math.max(sig, last * 1e-8);
  return Math.min(0.98, Math.max(0.02, normCdf(z)));
}

function bernoulliJoint(p: number, q: number, rho: number): number {
  const cov = rho * Math.sqrt(Math.max(0, p * (1 - p) * q * (1 - q)));
  const lo = Math.max(0, p + q - 1);
  const hi = Math.min(p, q);
  return Math.min(hi, Math.max(lo, p * q + cov));
}

function meanPairRho(legs: Array<{ family: string; sector: string }>): number {
  if (legs.length < 2) return 0;
  let s = 0;
  let n = 0;
  for (let i = 0; i < legs.length; i += 1) {
    for (let j = i + 1; j < legs.length; j += 1) {
      s += pairRho(legs[i], legs[j]);
      n += 1;
    }
  }
  return n ? s / n : 0;
}

/** E[f(Z)] for Z ~ N(0,1) via Riemann on [-4, 4]. */
function expectNorm(f: (z: number) => number): number {
  const n = 24;
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const z = -4 + (8 * (i + 0.5)) / n;
    s += Math.exp(-0.5 * z * z) * f(z);
  }
  return (s * (8 / n)) / Math.sqrt(2 * Math.PI);
}

function copulaAll(ps: number[], rho: number): number {
  if (ps.length === 0) return 0;
  if (ps.length === 1) return ps[0];
  const r = Math.min(0.95, Math.max(0, rho));
  if (r < 0.02) return ps.reduce((a, b) => a * b, 1);
  const a = Math.sqrt(r);
  const b = Math.sqrt(1 - r);
  const zs = ps.map(invNorm);
  const joint = expectNorm((z) => {
    let p = 1;
    for (let i = 0; i < zs.length; i += 1) {
      p *= normCdf((zs[i] - a * z) / b);
    }
    return p;
  });
  const indep = ps.reduce((x, y) => x * y, 1);
  const lo = Math.max(0, ps.reduce((s, p) => s + p, 0) - (ps.length - 1));
  const hi = Math.min(...ps);
  return Math.min(hi, Math.max(lo, Math.max(joint, indep)));
}

export function quoteCombo(legs: QuoteLeg[], remainingMs: number): ComboQuote | null {
  if (legs.length === 0) return null;
  const tagged = legs.map((l) => ({
    ...l,
    family: familyOf(l.symbol),
    pUp: pFinishUp(l.last, l.open, l.change24h, remainingMs),
  }));
  const priced = tagged.map((l) => ({
    ...l,
    p: l.side === "up" ? l.pUp : 1 - l.pUp,
  }));
  const pIndep = priced.reduce((a, l) => a * l.p, 1);
  const rho = meanPairRho(priced);
  let pJoint: number;
  if (priced.length === 2) {
    const signed =
      pairRho(priced[0], priced[1]) * (priced[0].side === priced[1].side ? 1 : -1);
    pJoint = bernoulliJoint(priced[0].p, priced[1].p, signed);
  } else {
    const same = priced.every((l) => l.side === priced[0].side);
    pJoint = copulaAll(
      priced.map((l) => l.p),
      same ? rho : Math.max(0, rho * 0.25),
    );
  }
  const naivePays = Math.round(NAIVE ** legs.length * 100) / 100;
  const fairPays = Math.round((1 / Math.max(pJoint, 0.02)) * (1 - VIG) * 100) / 100;
  const warnings: string[] = [];
  const families = new Map<string, string[]>();
  for (const l of priced) {
    const arr = families.get(l.family) ?? [];
    arr.push(l.symbol);
    families.set(l.family, arr);
  }
  for (const [fam, syms] of families) {
    if (syms.length >= 2) {
      warnings.push(
        `${syms.join(" + ")} share ${fam}. Tessera is a loan-participation right; PreStocks is SPV exposure. Wrapper stack — last units are not comparable. ρ is a structural prior.`,
      );
    }
  }
  const sectors = new Map<string, number>();
  for (const l of priced) sectors.set(l.sector, (sectors.get(l.sector) ?? 0) + 1);
  for (const [sec, n] of sectors) {
    if (n >= 2 && ![...families.values()].some((s) => s.length >= 2 && priced.find((p) => p.sector === sec))) {
      warnings.push(`${sec} names co-move. Joint probability is tighter than the independence product.`);
    }
  }
  if (rho >= 0.35 && warnings.length === 0) {
    warnings.push("Positive correlation. The fair multiplier is below naive 1.9× stacking.");
  }
  return {
    n: legs.length,
    pIndep,
    pJoint,
    rho,
    naivePays,
    fairPays: Math.min(48, Math.max(1.05, fairPays)),
    warnings,
    legs: priced,
  };
}

export function listingToQuoteLeg(
  stock: HouseListing,
  side: MinuteSide,
  open: number,
): QuoteLeg {
  return {
    marketId: stock.id,
    symbol: stock.symbol,
    sector: stock.sector,
    side,
    last: stock.last,
    open: open || stock.last,
    change24h: stock.change24h,
  };
}

export function formatProb(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatRho(r: number): string {
  return r.toFixed(2);
}
