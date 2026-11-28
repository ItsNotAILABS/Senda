/** Phone privacy. Covers the desk. Does not shield the chain and does not use Helius. */

import { sealOpen } from "@/lib/seal";

export const PRIVACY_FLAG = "senda.privacy.v1";
const BOOK = "senda.privacy-book.v1";
const EVENT = "senda-privacy";

export type PrivateHold = { symbol: string; usd: number };
export type PrivateSend = { at: number; title: string; usd: number; asset: string };

type Book = { holds: PrivateHold[]; sends: PrivateSend[] };

export function privacyOn(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(PRIVACY_FLAG);
    if (!raw || raw.startsWith("sen1.")) return false;
    const row = JSON.parse(raw) as { on?: boolean };
    return row?.on === true;
  } catch {
    return false;
  }
}

export function setPrivacy(on: boolean) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PRIVACY_FLAG, JSON.stringify({ v: 1, on }));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** True when the screen must hide balances, tokens, and send amounts. */
export function coverDesk(): boolean {
  return privacyOn() && !sealOpen();
}

function empty(): Book {
  return { holds: [], sends: [] };
}

function readBook(): Book {
  if (!sealOpen() || typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(BOOK);
    if (!raw || raw.startsWith("sen1.")) return empty();
    const row = JSON.parse(raw) as Book;
    return {
      holds: Array.isArray(row.holds)
        ? row.holds.filter((row) => Boolean(row) && typeof row.symbol === "string" && typeof row.usd === "number").slice(0, 24)
        : [],
      sends: Array.isArray(row.sends)
        ? row.sends
            .filter((row) => Boolean(row) && typeof row.title === "string" && typeof row.usd === "number" && typeof row.asset === "string" && typeof row.at === "number")
            .slice(0, 12)
        : [],
    };
  } catch {
    return empty();
  }
}

function writeBook(book: Book) {
  localStorage.setItem(BOOK, JSON.stringify(book));
}

/** Ciphertext only while the phone key is open. A locked desk writes nothing. */
export function keepPrivateHolds(holds: PrivateHold[]): boolean {
  if (!sealOpen() || !privacyOn()) return false;
  const book = readBook();
  book.holds = holds.filter((row) => row.symbol && row.usd > 0).slice(0, 24);
  writeBook(book);
  return true;
}

export function keepPrivateSend(row: { title: string; usd: number; asset: string }): boolean {
  if (!sealOpen() || !privacyOn()) return false;
  const book = readBook();
  book.sends = [{ at: Date.now(), title: row.title.slice(0, 80), usd: row.usd, asset: row.asset }, ...book.sends].slice(0, 12);
  writeBook(book);
  return true;
}

export function privateSends(): PrivateSend[] {
  if (!sealOpen() || !privacyOn()) return [];
  return readBook().sends;
}
