/** Open peg tickets. Settle when the 60s window rolls. */

import { minuteId } from "@/lib/minute-book";

const KEY = "senda.peg.v1";

export type PegTicket = {
  id: string;
  stockId: string;
  symbol: string;
  minute: number;
  shares: number;
  spend: number;
  premiumPaid: number;
  elPerShare: number;
  entryLast: number;
  entryMark: number;
  settled: boolean;
  pnl: number;
};

function read(): PegTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PegTicket[];
    return Array.isArray(p) ? p.slice(-48) : [];
  } catch {
    return [];
  }
}

function write(rows: PegTicket[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-48)));
  } catch {
    /* quota */
  }
}

export function loadPegs(): PegTicket[] {
  return read();
}

export function openPeg(input: Omit<PegTicket, "id" | "minute" | "settled" | "pnl">): PegTicket {
  const row: PegTicket = {
    ...input,
    id: `pg${Math.random().toString(36).slice(2, 9)}`,
    minute: minuteId(),
    settled: false,
    pnl: 0,
  };
  write([...read(), row]);
  return row;
}

export function settlePegs(prices: Record<string, { last: number; mark: number }>): PegTicket[] {
  const now = minuteId();
  const done: PegTicket[] = [];
  const next = read().map((t) => {
    if (t.settled || t.minute >= now) return t;
    const px = prices[t.stockId];
    let pnl = 0;
    if (px && px.last > 0 && px.mark > 0 && t.entryMark > 0) {
      const g0 = Math.abs(t.entryLast - t.entryMark) / t.entryMark;
      const g1 = Math.abs(px.last - px.mark) / px.mark;
      if (g1 > g0 + 1e-6) pnl = t.elPerShare * t.shares;
    }
    const settled = { ...t, settled: true, pnl };
    done.push(settled);
    return settled;
  });
  write(next);
  return done;
}
