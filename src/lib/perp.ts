/** Perps on PreStocks last. Funding from premium-to-mark. Paper. */

const KEY = "senda.perp.v1";

export type PerpPos = {
  id: string;
  stockId: string;
  symbol: string;
  side: "long" | "short";
  notional: number;
  entry: number;
  createdAt: string;
};

export function loadPerps(): PerpPos[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PerpPos[];
    return Array.isArray(p) ? p : [];
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
): PerpPos[] {
  const next = [
    {
      id: `pp${Math.random().toString(36).slice(2, 8)}`,
      stockId,
      symbol,
      side,
      notional,
      entry,
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
  if (!(p.entry > 0)) return 0;
  const ret = (last - p.entry) / p.entry;
  return (p.side === "long" ? ret : -ret) * p.notional;
}

export function fundingRate(premium: number | null): number {
  if (premium == null) return 0;
  return premium / 24;
}
