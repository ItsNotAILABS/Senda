/**
 * Per-minute peg of PreStocks last vs private mark.
 *
 * EL = 1-minute σ-move on last, times a thin-book multiplier.
 * Spread is the house take (how Senda makes money).
 * Premium / min / share = EL + spread.
 * Pays if |last − mark| widens over the 60s window.
 */

import { annualSigma } from "@/lib/option-chain";
import { dexHalfSpread } from "@/lib/wrap-quote";
import type { HouseListing } from "@/lib/sol-house";

const MINUTES_YEAR = 365 * 24 * 60;
const SPREAD_TAKE = 0.31;

export type PegQuote = {
  last: number;
  mark: number;
  premium: number | null;
  sigma1m: number;
  thin: number;
  expectedLoss: number;
  spread: number;
  premiumMin: number;
  floor: number;
  how: string;
};

export function thinMult(stock: HouseListing): number {
  const prem = Math.abs(stock.premium ?? 0);
  const liq = stock.liquidity > 0 ? stock.liquidity : 80;
  return Math.min(4.2, Math.max(2.1, 2 + prem * 12 + 350 / liq));
}

export function quotePeg(stock: HouseListing): PegQuote | null {
  const last = stock.last;
  const mark = stock.mark;
  if (!(last > 0) || !(mark > 0)) return null;
  const sig = annualSigma(stock.change24h);
  const sigma1m = sig / Math.sqrt(MINUTES_YEAR);
  const thin = thinMult(stock);
  const expectedLoss = last * sigma1m * thin;
  const dx = dexHalfSpread(stock.liquidity) * last;
  const spread = Math.max(expectedLoss * SPREAD_TAKE, dx * 0.15);
  const premiumMin = expectedLoss + spread;
  const floor = Math.min(last, mark) * (1 - 2 * sigma1m * thin);
  return {
    last,
    mark,
    premium: stock.premium,
    sigma1m,
    thin,
    expectedLoss,
    spread,
    premiumMin,
    floor,
    how: `Fair 1-minute move on the SPL is $${expectedLoss.toFixed(2)}/share. Senda keeps $${spread.toFixed(2)} as spread on a ${thin.toFixed(1)}× thin PreStocks book (Meteora/Raydium depth). Peg pays if token−mark widens. Live size is Jupiter USDC.`,
  };
}

export function protectCost(q: PegQuote, spend: number, last: number): number {
  if (!(spend > 0) || !(last > 0)) return 0;
  return (spend / last) * q.premiumMin;
}

export function formatUsdTiny(n: number): string {
  if (!(n > 0)) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
