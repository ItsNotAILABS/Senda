/** Valuation-weighted PreStocks index. Base 1000 when last = mark. */

import type { HouseListing } from "@/lib/sol-house";

export function pre8(rows: HouseListing[]) {
  const live = rows.filter((r) => r.venue === "prestocks" && r.valuation > 0 && r.last > 0 && r.mark > 0);
  const tv = live.reduce((s, r) => s + r.valuation, 0);
  if (!(tv > 0) || live.length === 0) return { level: 1000, tv, n: 0, legs: [] as typeof live };
  const level = live.reduce((s, r) => s + (r.last / r.mark) * (r.valuation / tv), 0) * 1000;
  return { level, tv, n: live.length, legs: live };
}
