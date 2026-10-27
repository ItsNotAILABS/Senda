/** Prices from the live print. No flat multiple, no flat margin. */

import { normCdf } from "@/lib/combo-quote";

export const VIG = 0.04;

/** What $1 returns if this side wins and the book keeps the vig. */
export function fairMultiple(p: number): number {
  if (!(p > 0) || p > 1) return 0;
  return Math.round(((1 - VIG) / p) * 100) / 100;
}

/** Median absolute 24h move on the book. Zero when the book has no moves. */
export function bookDaily(changes: Array<number | null | undefined>): number {
  const xs = changes.map((c) => Math.abs(c ?? NaN)).filter((n) => n > 0 && n < 5).sort((a, b) => a - b);
  if (!xs.length) return 0;
  return xs[Math.floor((xs.length - 1) / 2)];
}

/** Initial margin as a fraction of notional. Three times the name's day move, else the book's. */
export function marginRate(change24h: number | null | undefined, book: number): number {
  const daily = Math.abs(change24h ?? 0) || book;
  if (!(daily > 0)) return 0.05;
  return Math.min(0.5, Math.max(0.05, daily * 3));
}

/** (last − mark) / mark, spread across an 8-hour funding window, per hour. */
export function fundingPerHour(last: number, mark: number): number {
  if (!(last > 0) || !(mark > 0)) return 0;
  const prem = (last - mark) / mark;
  return Math.max(-0.005, Math.min(0.005, prem / 8));
}

/** Chance the next minute continues today's direction. */
export function pNextUp(change24h: number | null, remainMs: number, book: number): number {
  const daily = Math.max(Math.abs(change24h ?? 0), book);
  if (!(daily > 0)) return 0.5;
  const tau = Math.max(remainMs / 86_400_000, 1 / 1440);
  const drift = (change24h ?? 0) * Math.sqrt(tau);
  const sig = daily * Math.sqrt(tau);
  const z = drift / Math.max(sig, 1e-8);
  return Math.min(0.92, Math.max(0.08, normCdf(z)));
}

export function wheelMultiple(names: number): number {
  return fairMultiple(names > 0 ? 1 / names : 0);
}

/** Half the fair return on a triple, half on a pair. Three uniform reels. */
export function slotMultiples(names: number): { triple: number; pair: number } {
  if (names < 2) return { triple: 0, pair: 0 };
  const pTriple = 1 / (names * names);
  const pPair = (3 * (names - 1)) / (names * names);
  return { triple: fairMultiple(pTriple) * 0.5, pair: fairMultiple(pPair) * 0.5 };
}

/** Two fair dice. Over and under are 21/36. Seven is 6/36. */
export function diceMultiple(call: "over" | "under" | "seven"): number {
  return fairMultiple(call === "seven" ? 6 / 36 : 21 / 36);
}

/** Three mines on nine tiles. Safe if all three picks land in the six clear ones. */
export function minesMultiple(): number {
  return fairMultiple(20 / 84);
}

/** Bust level from the cents of the print. A round price busts sooner. */
export function crashAt(last: number): number {
  if (!(last > 0)) return 1.05;
  const cents = Math.abs(last * 100 - Math.trunc(last * 100));
  const u = cents > 0 ? cents : 0.37;
  return Math.round(Math.max(1.05, (1 - VIG) / Math.max(0.05, u)) * 100) / 100;
}
