/** Paper option tickets. Cash-or-nothing on last vs strike at expiry. */

import type { OptKind, OptTenor } from "@/lib/option-chain";

const KEY = "the-pit.opts.v1";

export type OptTicket = {
  id: string;
  underlyingId: string;
  symbol: string;
  kind: OptKind;
  strike: number;
  tenor: OptTenor;
  expiryAt: number;
  spend: number;
  ask: number;
  settled: boolean;
  pnl: number;
};

function read(): OptTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OptTicket[];
    return Array.isArray(parsed) ? parsed.slice(-48) : [];
  } catch {
    return [];
  }
}

function write(rows: OptTicket[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-48)));
  } catch {
    /* ignore */
  }
}

export function openOptions(): OptTicket[] {
  return read().filter((t) => !t.settled);
}

export function placeOption(t: Omit<OptTicket, "id" | "settled" | "pnl">): OptTicket | { error: string } {
  if (!(t.spend > 0)) return { error: "Set a size first." };
  if (!(t.ask > 0) || t.ask >= 1) return { error: "No quote." };
  const ticket: OptTicket = {
    ...t,
    id: `opt:${t.underlyingId}:${Date.now()}`,
    settled: false,
    pnl: 0,
  };
  write([...read(), ticket]);
  return ticket;
}

export function settleOptions(prices: Record<string, number>, now = Date.now()): OptTicket[] {
  const rows = read();
  const done: OptTicket[] = [];
  const next = rows.map((t) => {
    if (t.settled || t.expiryAt > now) return t;
    const last = prices[t.underlyingId] ?? 0;
    let pnl = -t.spend;
    if (last > 0) {
      const itm = t.kind === "call" ? last > t.strike : last < t.strike;
      if (itm) pnl = t.spend / t.ask - t.spend;
    } else {
      pnl = 0;
    }
    const settled = { ...t, settled: true, pnl: Math.round(pnl * 100) / 100 };
    done.push(settled);
    return settled;
  });
  write(next);
  return done;
}
