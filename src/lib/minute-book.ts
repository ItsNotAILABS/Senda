/** Paper 60-second UP/DOWN on house names. Local. Not a live order. */

const BET_KEY = "the-pit.minute-bets.v1";
const TICK_KEY = "the-pit.minute-ticks.v1";
export const MINUTE_PAYS = 1.9;

export type MinuteSide = "up" | "down";

export type MinuteBet = {
  id: string;
  minute: number;
  marketId: string;
  symbol: string;
  side: MinuteSide;
  spend: number;
  open: number;
  settled: boolean;
  pnl: number;
};

type TickSnap = { minute: number; at: number; last: Record<string, number> };

export function minuteId(t = Date.now()): number {
  return Math.floor(t / 60_000);
}

export function remainingMs(t = Date.now()): number {
  return 60_000 - (t % 60_000);
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function readBets(): MinuteBet[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BET_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MinuteBet[];
    return Array.isArray(parsed) ? parsed.slice(-24) : [];
  } catch {
    return [];
  }
}

function writeBets(rows: MinuteBet[]): void {
  try {
    window.localStorage.setItem(BET_KEY, JSON.stringify(rows.slice(-24)));
  } catch {
    /* ignore */
  }
}

export function loadMinuteBets(): MinuteBet[] {
  return readBets();
}

export function openBetsFor(minute: number): MinuteBet[] {
  return readBets().filter((b) => b.minute === minute && !b.settled);
}

export function placeMinuteBet(
  marketId: string,
  symbol: string,
  side: MinuteSide,
  spend: number,
  open: number,
): MinuteBet {
  const bet: MinuteBet = {
    id: `${minuteId()}:${marketId}:${side}:${Date.now()}`,
    minute: minuteId(),
    marketId,
    symbol,
    side,
    spend,
    open,
    settled: false,
    pnl: 0,
  };
  writeBets([...readBets(), bet]);
  return bet;
}

export function recordTick(last: Record<string, number>): TickSnap {
  const snap: TickSnap = { minute: minuteId(), at: Date.now(), last };
  if (typeof window === "undefined") return snap;
  try {
    const raw = window.sessionStorage.getItem(TICK_KEY);
    const prev = raw ? (JSON.parse(raw) as TickSnap) : null;
    if (!prev || prev.minute !== snap.minute) {
      window.sessionStorage.setItem(TICK_KEY, JSON.stringify(snap));
      return snap;
    }
    return prev;
  } catch {
    return snap;
  }
}

export function minuteOpen(id: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.sessionStorage.getItem(TICK_KEY);
    if (!raw) return fallback;
    const snap = JSON.parse(raw) as TickSnap;
    if (snap.minute !== minuteId()) return fallback;
    const v = snap.last[id];
    return v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

export function settleOpenBets(prices: Record<string, number>): MinuteBet[] {
  const now = minuteId();
  const rows = readBets();
  const done: MinuteBet[] = [];
  const next = rows.map((b) => {
    if (b.settled || b.minute >= now) return b;
    const last = prices[b.marketId] ?? 0;
    let pnl = 0;
    if (last > 0 && b.open > 0) {
      if (last === b.open) pnl = 0;
      else if ((last > b.open && b.side === "up") || (last < b.open && b.side === "down")) {
        pnl = Math.round(b.spend * (MINUTE_PAYS - 1));
      } else {
        pnl = -b.spend;
      }
    } else {
      pnl = 0;
    }
    const settled = { ...b, settled: true, pnl };
    done.push(settled);
    return settled;
  });
  writeBets(next);
  return done;
}
