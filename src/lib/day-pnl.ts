/** Day P&L from marks and from fills this browser already signed. No guessed history. */

import type { TradeFill } from "@/lib/trade-log";

export type DayBook = { day: string; realized: number; sells: number };

function dayKey(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** Dollars the marks moved today. A percent with no value is skipped. */
export function unrealizedToday(rows: Array<{ value: number; day: number | null }>): number {
  return rows.reduce((sum, row) => {
    if (row.day == null || !(row.value > 0)) return sum;
    return sum + (row.value * row.day) / 100;
  }, 0);
}

/**
 * Average cost. A sell only counts when this browser recorded both a quantity and a buy before it.
 * A fill without a quantity is left out rather than invented.
 */
export function realizedDays(fills: TradeFill[]): DayBook[] {
  const ordered = fills
    .filter((fill) => fill.side === "buy" || fill.side === "sell")
    .sort((a, b) => a.at - b.at);
  const lots = new Map<string, { qty: number; cost: number }>();
  const days = new Map<string, DayBook>();
  for (const fill of ordered) {
    const key = fill.mint || fill.symbol;
    const lot = lots.get(key) || { qty: 0, cost: 0 };
    const qty = fill.qty && fill.qty > 0 ? fill.qty : fill.executed && fill.executed > 0 ? fill.usd / fill.executed : 0;
    if (!(qty > 0) || !(fill.usd > 0)) continue;
    if (fill.side === "buy") {
      lot.qty += qty;
      lot.cost += fill.usd;
      lots.set(key, lot);
      continue;
    }
    if (!(lot.qty > 0)) continue;
    const sold = Math.min(qty, lot.qty);
    const avg = lot.cost / lot.qty;
    const proceeds = fill.usd * (sold / qty);
    const realized = proceeds - avg * sold;
    lot.qty -= sold;
    lot.cost = Math.max(0, lot.cost - avg * sold);
    lots.set(key, lot);
    const day = dayKey(fill.at);
    const book = days.get(day) || { day, realized: 0, sells: 0 };
    book.realized += realized;
    book.sells += 1;
    days.set(day, book);
  }
  return [...days.values()].sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 8);
}
