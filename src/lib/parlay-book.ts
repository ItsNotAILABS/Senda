/** Paper parlays on the house board. All legs vs this minute’s open. Not a live order. */

import { MINUTE_PAYS, minuteId, type MinuteSide } from "@/lib/minute-book";

const KEY = "the-pit.parlay.v1";
export const PARLAY_MAX_LEGS = 6;

export type ParlayLeg = {
  marketId: string;
  symbol: string;
  side: MinuteSide;
  open: number;
};

export type ParlayTicket = {
  id: string;
  minute: number;
  spend: number;
  pays: number;
  legs: ParlayLeg[];
  settled: boolean;
  pnl: number;
};

export function parlayPays(n: number): number {
  if (n < 1) return 0;
  return Math.round(MINUTE_PAYS ** Math.min(n, PARLAY_MAX_LEGS) * 100) / 100;
}

export function formatPays(n: number): string {
  if (!(n > 0)) return "—";
  return `${n.toFixed(n >= 10 ? 1 : 2)}×`;
}

function read(): ParlayTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ParlayTicket[];
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

function write(rows: ParlayTicket[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-24)));
  } catch {
    /* ignore */
  }
}

export function openParlaysFor(minute: number): ParlayTicket[] {
  return read().filter((t) => t.minute === minute && !t.settled);
}

export function placeParlay(
  legs: ParlayLeg[],
  spend: number,
  pays?: number,
): ParlayTicket | { error: string } {
  if (legs.length < 1) return { error: "Add a name to the ticket first." };
  if (legs.length > PARLAY_MAX_LEGS) return { error: `Max ${PARLAY_MAX_LEGS} legs.` };
  if (!(spend > 0)) return { error: "Set a size first." };
  const seen = new Set<string>();
  for (const leg of legs) {
    if (seen.has(leg.marketId)) return { error: "Same name twice — pick one side." };
    seen.add(leg.marketId);
    if (!(leg.open > 0)) return { error: `${leg.symbol} has no open yet.` };
  }
  const ticket: ParlayTicket = {
    id: `px:${minuteId()}:${Date.now()}`,
    minute: minuteId(),
    spend,
    pays: pays && pays > 1 ? Math.round(pays * 100) / 100 : parlayPays(legs.length),
    legs,
    settled: false,
    pnl: 0,
  };
  write([...read(), ticket]);
  return ticket;
}

export function settleParlays(prices: Record<string, number>): ParlayTicket[] {
  const now = minuteId();
  const rows = read();
  const done: ParlayTicket[] = [];
  const next = rows.map((t) => {
    if (t.settled || t.minute >= now) return t;
    let hit = 0;
    let miss = 0;
    let push = 0;
    for (const leg of t.legs) {
      const last = prices[leg.marketId] ?? 0;
      if (!(last > 0) || !(leg.open > 0) || last === leg.open) {
        push += 1;
        continue;
      }
      const up = last > leg.open;
      const good = (up && leg.side === "up") || (!up && leg.side === "down");
      if (good) hit += 1;
      else miss += 1;
    }
    let pnl = 0;
    if (miss > 0) pnl = -t.spend;
    else if (push > 0) pnl = 0;
    else if (hit === t.legs.length) pnl = Math.round(t.spend * (t.pays - 1));
    const settled = { ...t, settled: true, pnl };
    done.push(settled);
    return settled;
  });
  write(next);
  return done;
}
