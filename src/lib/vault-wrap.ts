/** A vault labels USDC that stays in the wallet. The label is ciphertext once the wallet opens the seal. */

import { sealOpen } from "@/lib/seal";

const KEY = "senda.vaultwrap.v1";

export type Sleeve = { id: string; name: string; usdc: number };

type Row = { label: string; usdc: number; sleeves: Sleeve[] };
type Book = Record<string, Row>;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function load(): Book {
  if (typeof window === "undefined") return {};
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "") as Book;
    return p && typeof p === "object" ? p : {};
  } catch {
    return {};
  }
}

function save(b: Book) {
  if (typeof window !== "undefined" && !sealOpen()) {
    throw new Error("Open the vault with the wallet. The book is not written until it can be sealed.");
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(b));
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Open the vault")) throw e;
    /* quota */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("senda-vault"));
}

function claimed(row: Row | undefined): number {
  if (!row) return 0;
  if (row.sleeves?.length) return round(row.sleeves.reduce((s, x) => s + (x.usdc || 0), 0));
  return round(row.usdc || 0);
}

function rowOf(book: Book, address: string): Row {
  const raw = book[address];
  if (!raw) return { label: "Wallet", usdc: 0, sleeves: [] };
  if (raw.sleeves?.length) return { label: raw.label || "Wallet", usdc: claimed(raw), sleeves: raw.sleeves };
  if ((raw.usdc || 0) > 0) {
    return { label: raw.label || "Wallet", usdc: round(raw.usdc), sleeves: [{ id: "cash", name: "Cash", usdc: round(raw.usdc) }] };
  }
  return { label: raw.label || "Wallet", usdc: 0, sleeves: [] };
}

function write(book: Book, address: string, row: Row) {
  const usdc = claimed(row);
  book[address] = { label: row.label, usdc, sleeves: row.sleeves };
  save(book);
}

export function wrappedUsdc(address: string): number {
  return claimed(rowOf(load(), address));
}

export function listSleeves(address: string): Sleeve[] {
  return rowOf(load(), address).sleeves;
}

export function vaultHealth(address: string, onChain: number): { claimed: number; free: number; over: number } {
  const have = wrappedUsdc(address);
  const chain = round(Math.max(0, onChain));
  return {
    claimed: have,
    free: round(Math.max(0, chain - have)),
    over: round(Math.max(0, have - chain)),
  };
}

export function wrapUsdc(address: string, label: string, amount: number, onChain: number): number {
  const book = load();
  const row = rowOf(book, address);
  const next = round(claimed(row) + amount);
  if (next - onChain > 0.001) throw new Error("You can't wrap more USDC than this wallet holds.");
  const cash = row.sleeves.find((s) => s.id === "cash");
  const sleeves = cash
    ? row.sleeves.map((s) => (s.id === "cash" ? { ...s, usdc: round(s.usdc + amount) } : s))
    : [{ id: "cash", name: "Cash", usdc: round(amount) }, ...row.sleeves];
  write(book, address, { label, usdc: next, sleeves });
  return next;
}

export function unwrapUsdc(address: string, amount: number): number {
  const book = load();
  const row = rowOf(book, address);
  if (amount - claimed(row) > 0.001) throw new Error("The vault doesn't have that much wrapped.");
  let left = round(amount);
  const sleeves = row.sleeves.map((s) => ({ ...s }));
  const order = [...sleeves.filter((s) => s.id === "cash"), ...sleeves.filter((s) => s.id !== "cash")];
  for (const sleeve of order) {
    if (!(left > 0)) break;
    const take = Math.min(sleeve.usdc, left);
    sleeve.usdc = round(sleeve.usdc - take);
    left = round(left - take);
  }
  const byId = new Map(order.map((s) => [s.id, s]));
  write(book, address, { ...row, sleeves: sleeves.map((s) => byId.get(s.id) || s) });
  return wrappedUsdc(address);
}

export function openSleeve(address: string, name: string): Sleeve[] {
  const n = name.trim();
  if (n.length < 2) throw new Error("Name the sleeve.");
  const book = load();
  const row = rowOf(book, address);
  if (row.sleeves.some((s) => s.name.toLowerCase() === n.toLowerCase())) throw new Error("That sleeve already exists.");
  const sleeves = [...row.sleeves, { id: `sl-${Date.now().toString(36)}`, name: n, usdc: 0 }];
  write(book, address, { ...row, sleeves });
  return sleeves;
}

export function moveSleeve(address: string, fromId: string, toId: string, amount: number): Sleeve[] {
  if (fromId === toId) throw new Error("Pick a different sleeve.");
  const amt = round(amount);
  if (!(amt > 0)) throw new Error("Enter an amount.");
  const book = load();
  const row = rowOf(book, address);
  const from = row.sleeves.find((s) => s.id === fromId);
  const to = row.sleeves.find((s) => s.id === toId);
  if (!from || !to) throw new Error("That sleeve is gone.");
  if (from.usdc + 0.001 < amt) throw new Error("That sleeve doesn't have that much.");
  const sleeves = row.sleeves.map((s) => {
    if (s.id === fromId) return { ...s, usdc: round(s.usdc - amt) };
    if (s.id === toId) return { ...s, usdc: round(s.usdc + amt) };
    return s;
  });
  write(book, address, { ...row, sleeves });
  return sleeves;
}
