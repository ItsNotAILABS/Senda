/** Event contracts on live PreStocks last / mark. Clock-aligned windows, 24/7. */

import { pFinishUp } from "@/lib/combo-quote";

export type PlayTenor = "1m" | "15m" | "1h" | "4h" | "12h" | "1d";
export type PlayKind = "up" | "down" | "over" | "under" | "up1" | "down1" | "inside" | "outside" | "diverge" | "converge";
export type PlayGroup = "tape" | "mark" | "move" | "range" | "gap";

export const TENORS: { id: PlayTenor; label: string; ms: number }[] = [
  { id: "1m", label: "1 min", ms: 60_000 },
  { id: "15m", label: "15 min", ms: 900_000 },
  { id: "1h", label: "1 hour", ms: 3_600_000 },
  { id: "4h", label: "4 hour", ms: 14_400_000 },
  { id: "12h", label: "12 hour", ms: 43_200_000 },
  { id: "1d", label: "1 day", ms: 86_400_000 },
];

export const GROUPS: { id: PlayGroup; label: string; yes: PlayKind; no: PlayKind; blurb: string }[] = [
  { id: "tape", label: "Tape", yes: "up", no: "down", blurb: "Last finishes above window-open last." },
  { id: "mark", label: "Mark", yes: "over", no: "under", blurb: "Last finishes above the SPV mark." },
  { id: "move", label: "±1%", yes: "up1", no: "down1", blurb: "Last closes at least 1% from open." },
  { id: "range", label: "Range", yes: "inside", no: "outside", blurb: "Last stays inside ±0.5% of open." },
  { id: "gap", label: "Gap", yes: "diverge", no: "converge", blurb: "Token–mark gap widens vs window open." },
];

const VIG = 0.04;
const KEY = "senda.play.v3";
const OPEN_KEY = "senda.play.open.v3";

export type PlayTicket = {
  id: string;
  stockId: string;
  symbol: string;
  tenor: PlayTenor;
  kind: PlayKind;
  title: string;
  windowId: number;
  spend: number;
  ask: number;
  contracts: number;
  openLast: number;
  openMark: number;
  settled: boolean;
  pnl: number;
};

type OpenSnap = { tenor: PlayTenor; windowId: number; last: Record<string, number>; mark: Record<string, number> };

export function tenorMs(t: PlayTenor): number {
  return TENORS.find((x) => x.id === t)?.ms ?? 60_000;
}

export function windowId(tenor: PlayTenor, now = Date.now()): number {
  return Math.floor(now / tenorMs(tenor));
}

export function remainingMs(tenor: PlayTenor, now = Date.now()): number {
  const ms = tenorMs(tenor);
  return ms - (now % ms);
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}:${(m % 60).toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
  }
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function yesAsk(p: number): number {
  return Math.min(0.92, Math.max(0.08, p + VIG));
}

export function cents(ask: number): string {
  return `${Math.round(ask * 100)}¢`;
}

function read(): PlayTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as PlayTicket[];
    return Array.isArray(p) ? p.slice(-80) : [];
  } catch {
    return [];
  }
}

function write(rows: PlayTicket[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(-80)));
  } catch {
    /* quota */
  }
}

export function loadPlayTickets(): PlayTicket[] {
  return read();
}

export function quoteP(
  kind: PlayKind,
  last: number,
  mark: number,
  openLast: number,
  openMark: number,
  change24h: number | null,
  remain: number,
): number {
  const pUp = pFinishUp(last, openLast, change24h, remain);
  const pOver = pFinishUp(last, mark, change24h, remain);
  const pUp1 = pFinishUp(last, openLast * 1.01, change24h, remain);
  const pDown1 = 1 - pFinishUp(last, openLast * 0.99, change24h, remain);
  const pAboveLo = pFinishUp(last, openLast * 0.995, change24h, remain);
  const pAboveHi = pFinishUp(last, openLast * 1.005, change24h, remain);
  const inside = Math.min(0.95, Math.max(0.05, pAboveLo - pAboveHi));
  const gap0 = Math.abs(openLast - openMark);
  const pDivHi = pFinishUp(last, mark + gap0, change24h, remain);
  const pDivLo = 1 - pFinishUp(last, mark - gap0, change24h, remain);
  const diverge = Math.min(0.95, Math.max(0.05, pDivHi + pDivLo - pDivHi * pDivLo));
  switch (kind) {
    case "up":
      return pUp;
    case "down":
      return 1 - pUp;
    case "over":
      return pOver;
    case "under":
      return 1 - pOver;
    case "up1":
      return pUp1;
    case "down1":
      return pDown1;
    case "inside":
      return inside;
    case "outside":
      return 1 - inside;
    case "diverge":
      return diverge;
    default:
      return 1 - diverge;
  }
}

export function won(kind: PlayKind, last: number, mark: number, openLast: number, openMark: number): boolean {
  if (!(last > 0)) return false;
  const gap0 = Math.abs(openLast - openMark);
  const gap1 = Math.abs(last - mark);
  switch (kind) {
    case "up":
      return last > openLast;
    case "down":
      return last < openLast;
    case "over":
      return last > mark;
    case "under":
      return last < mark;
    case "up1":
      return last >= openLast * 1.01;
    case "down1":
      return last <= openLast * 0.99;
    case "inside":
      return Math.abs(last - openLast) / openLast <= 0.005;
    case "outside":
      return Math.abs(last - openLast) / openLast > 0.005;
    case "diverge":
      return gap1 > gap0 + 1e-9;
    default:
      return gap1 <= gap0 + 1e-9;
  }
}

export function contractTitle(symbol: string, tenor: PlayTenor, group: PlayGroup): string {
  const t = TENORS.find((x) => x.id === tenor)?.label ?? tenor;
  if (group === "tape") return `${symbol} finishes up · ${t}`;
  if (group === "mark") return `${symbol} above SPV mark · ${t}`;
  if (group === "move") return `${symbol} moves ≥1% · ${t}`;
  if (group === "range") return `${symbol} stays in ±0.5% · ${t}`;
  return `${symbol} gap vs mark widens · ${t}`;
}

export function freezeOpen(tenor: PlayTenor, last: Record<string, number>, mark: Record<string, number>): OpenSnap {
  const wid = windowId(tenor);
  const snap: OpenSnap = { tenor, windowId: wid, last, mark };
  if (typeof window === "undefined") return snap;
  try {
    const raw = window.sessionStorage.getItem(`${OPEN_KEY}.${tenor}`);
    const prev = raw ? (JSON.parse(raw) as OpenSnap) : null;
    if (!prev || prev.windowId !== wid) {
      window.sessionStorage.setItem(`${OPEN_KEY}.${tenor}`, JSON.stringify(snap));
      return snap;
    }
    return prev;
  } catch {
    return snap;
  }
}

export function openPrint(tenor: PlayTenor, id: string, fallbackLast: number, fallbackMark: number) {
  if (typeof window === "undefined") return { last: fallbackLast, mark: fallbackMark };
  try {
    const raw = window.sessionStorage.getItem(`${OPEN_KEY}.${tenor}`);
    if (!raw) return { last: fallbackLast, mark: fallbackMark };
    const snap = JSON.parse(raw) as OpenSnap;
    if (snap.windowId !== windowId(tenor)) return { last: fallbackLast, mark: fallbackMark };
    return {
      last: snap.last[id] > 0 ? snap.last[id] : fallbackLast,
      mark: snap.mark[id] > 0 ? snap.mark[id] : fallbackMark,
    };
  } catch {
    return { last: fallbackLast, mark: fallbackMark };
  }
}

export function placePlay(input: Omit<PlayTicket, "id" | "windowId" | "settled" | "pnl">): PlayTicket {
  const row: PlayTicket = {
    ...input,
    id: `pl${Math.random().toString(36).slice(2, 10)}`,
    windowId: windowId(input.tenor),
    settled: false,
    pnl: 0,
  };
  write([...read(), row]);
  return row;
}

export function settlePlay(prices: Record<string, { last: number; mark: number }>): PlayTicket[] {
  const done: PlayTicket[] = [];
  const next = read().map((t) => {
    if (t.settled) return t;
    if (t.windowId >= windowId(t.tenor)) return t;
    const px = prices[t.stockId];
    const last = px?.last ?? 0;
    const mark = px?.mark ?? t.openMark;
    const hit = won(t.kind, last, mark, t.openLast, t.openMark);
    const pnl = last > 0 ? (hit ? Math.round((t.contracts - t.spend) * 100) / 100 : -t.spend) : 0;
    const settled = { ...t, settled: true, pnl };
    done.push(settled);
    return settled;
  });
  write(next);
  return done;
}

export function kindLabel(k: PlayKind): string {
  const map: Record<PlayKind, string> = {
    up: "Up",
    down: "Down",
    over: "Over mark",
    under: "Under mark",
    up1: "≥ +1%",
    down1: "≤ −1%",
    inside: "Inside ±0.5%",
    outside: "Break ±0.5%",
    diverge: "Gap widens",
    converge: "Gap shrinks",
  };
  return map[k];
}
