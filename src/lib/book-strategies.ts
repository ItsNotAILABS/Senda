/** Same cuts as chain/python/senda/strategies.py. A signal is not a fill. */

import type { HouseListing } from "@/lib/sol-house";

export const DISCOUNT = -0.02;
export const RICH = 0.02;

export type BookSignal = {
  symbol: string;
  mint: string;
  side: "buy" | "sell";
  why: "discount" | "rich";
  premium: number;
  last: number;
};

export function bookSignals(names: HouseListing[]): BookSignal[] {
  const priced = names.filter((n) => n.mint && n.last > 0 && n.premium != null);
  const cheap = priced
    .filter((n) => (n.premium ?? 0) <= DISCOUNT)
    .sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))
    .slice(0, 4);
  const rich = priced
    .filter((n) => (n.premium ?? 0) >= RICH)
    .sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))
    .slice(0, 4);
  return [
    ...cheap.map((n) => ({ symbol: n.symbol, mint: n.mint, side: "buy" as const, why: "discount" as const, premium: n.premium ?? 0, last: n.last })),
    ...rich.map((n) => ({ symbol: n.symbol, mint: n.mint, side: "sell" as const, why: "rich" as const, premium: n.premium ?? 0, last: n.last })),
  ];
}

export function sized(usd: number, cap: number): number {
  if (!(usd > 0)) return 0;
  if (!(cap > 0)) return usd;
  return Math.min(usd, cap);
}
