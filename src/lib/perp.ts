/** Perp mark on a PreStock print. Margin and funding come from that print. */

import { fundingPerHour } from "@/lib/market-math";

const KEY = "senda.perp.v1";

export type PerpPos = {
  id: string;
  stockId: string;
  symbol: string;
  side: "long" | "short";
  notional: number;
  entry: number;
  mark: number;
  margin: number;
  createdAt: string;
};

export function loadPerps(): PerpPos[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PerpPos[];
    return Array.isArray(p) ? p.map((row) => ({ ...row, mark: row.mark || 0, margin: row.margin || 0 })) : [];
  } catch {
    return [];
  }
}

function save(rows: PerpPos[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* quota */
  }
}

export function openPerp(
  rows: PerpPos[],
  stockId: string,
  symbol: string,
  side: "long" | "short",
  notional: number,
  entry: number,
  mark: number,
  margin: number,
): PerpPos[] {
  const next = [
    {
      id: `pp${Date.now().toString(36)}`,
      stockId,
      symbol,
      side,
      notional,
      entry,
      mark,
      margin,
      createdAt: new Date().toISOString(),
    },
    ...rows,
  ];
  save(next);
  return next;
}

export function closePerp(rows: PerpPos[], id: string): PerpPos[] {
  const next = rows.filter((r) => r.id !== id);
  save(next);
  return next;
}

export function perpPnl(p: PerpPos, last: number): number {
  if (!(p.entry > 0) || !(last > 0)) return 0;
  const ret = (last - p.entry) / p.entry;
  return (p.side === "long" ? ret : -ret) * p.notional;
}

/** Longs pay when last is rich to the mark. The rate is the average of entry and now. */
export function fundingPnL(p: PerpPos, last: number, mark: number, now = Date.now()): number {
  const opened = Date.parse(p.createdAt);
  if (!Number.isFinite(opened)) return 0;
  const hours = Math.max(0, (now - opened) / 3_600_000);
  const entryMark = p.mark > 0 ? p.mark : mark;
  const avg = (fundingPerHour(p.entry, entryMark) + fundingPerHour(last, mark)) / 2;
  const paid = p.notional * avg * hours;
  return p.side === "long" ? -paid : paid;
}

export function perpMark(p: PerpPos, last: number, mark: number, now = Date.now()): number {
  return perpPnl(p, last) + fundingPnL(p, last, mark, now);
}
