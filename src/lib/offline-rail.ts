/** A send priced and held on this phone. No RPC. A signature is still required before USDC moves. */

import { netLegs } from "@/lib/money-move";
import { payReference, transferRequest } from "@/lib/solana-pay";

const KEY = "senda.offline-sends.v1";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type HeldSend = {
  id: string;
  to: string;
  usd: number;
  memo: string;
  link: string;
  at: string;
  status: "held" | "signed";
  sig?: string;
};

function read(): HeldSend[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as HeldSend[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows: HeldSend[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listHeld(): HeldSend[] {
  return read();
}

/** Address, cents, and a Solana Pay link. Throws nothing. The chain is not asked. */
export function holdSend(to: string, usd: number, memo: string): HeldSend | { error: string } {
  const [leg] = netLegs([{ to, usd, memo }]);
  if (!leg) return { error: "Need an address and at least one cent." };
  let link = "";
  try {
    const reference = payReference(`${leg.to}:${leg.usd}:${Date.now()}`);
    link = transferRequest({
      recipient: leg.to,
      amount: leg.usd,
      splToken: USDC,
      reference,
      memo: leg.memo || undefined,
      label: "Senda",
    });
  } catch {
    return { error: "That is not a Solana address." };
  }
  const row: HeldSend = {
    id: crypto.randomUUID(),
    to: leg.to,
    usd: leg.usd,
    memo: leg.memo,
    link,
    at: new Date().toISOString(),
    status: "held",
  };
  write([row, ...read()]);
  return row;
}

/** Same address, one amount. Two holds of $1.10 and $1.20 become one $2.30 signature. */
export function netOpen(): { to: string; usd: number; memo: string; ids: string[] }[] {
  const open = read().filter((row) => row.status === "held");
  const legs = netLegs(open.map((row) => ({ to: row.to, usd: row.usd, memo: row.memo })));
  return legs.map((leg) => ({
    ...leg,
    ids: open.filter((row) => row.to === leg.to).map((row) => row.id),
  }));
}

export function markSigned(ids: string[], sig: string) {
  const set = new Set(ids);
  write(read().map((row) => (set.has(row.id) ? { ...row, status: "signed" as const, sig } : row)));
}

export function dropHeld(id: string) {
  write(read().filter((row) => row.id !== id || row.status === "signed"));
}

const TRADES = "senda.offline-trades.v1";
const BOOK = "senda.book.cache.v1";

export type HeldTrade = {
  id: string;
  kind: "spot" | "curve";
  mint: string;
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  sol: number;
  pool: "pump" | "bonk" | "auto";
  price: number;
  decimals: number;
  at: string;
  status: "held" | "signed";
  sig?: string;
};

function readTrades(): HeldTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(TRADES) || "[]") as HeldTrade[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeTrades(rows: HeldTrade[]) {
  window.localStorage.setItem(TRADES, JSON.stringify(rows.slice(0, 40)));
}

export function listHeldTrades(): HeldTrade[] {
  return readTrades();
}

/** The ticket, saved on this phone. Jupiter is not asked. Nothing fills. */
export function holdTrade(input: Omit<HeldTrade, "id" | "at" | "status" | "sig">): HeldTrade | { error: string } {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(input.mint)) return { error: "That is not a mint." };
  if (input.kind === "spot" && !(input.usd > 0)) return { error: "Set a dollar size." };
  if (input.kind === "curve" && input.side === "buy" && !(input.sol > 0)) return { error: "Set a SOL size." };
  const row: HeldTrade = {
    ...input,
    symbol: (input.symbol || input.mint.slice(0, 4)).slice(0, 16),
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    status: "held",
  };
  writeTrades([row, ...readTrades()]);
  return row;
}

export function markTradeSigned(id: string, sig: string) {
  writeTrades(readTrades().map((row) => (row.id === id ? { ...row, status: "signed" as const, sig } : row)));
}

export function dropTrade(id: string) {
  writeTrades(readTrades().filter((row) => row.id !== id || row.status === "signed"));
}

export type BookSnap = {
  at: string;
  shelf: string;
  page: number;
  q: string;
  pages: number;
  total: number;
  rows: unknown[];
};

export function saveBook(snap: Omit<BookSnap, "at">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BOOK, JSON.stringify({ ...snap, at: new Date().toISOString() }));
  } catch {
    /* quota */
  }
}

export function readBook(): BookSnap | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(BOOK) || "null") as BookSnap | null;
    return row && Array.isArray(row.rows) ? row : null;
  } catch {
    return null;
  }
}

