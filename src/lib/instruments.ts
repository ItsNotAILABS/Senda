/** Working PreStock instruments. Each leg is a swap the wallet signs. Nothing here is a paper chip. */

import type { HouseListing } from "@/lib/sol-house";

const ORDERS = "senda.orders.v1";
const DRIP = "senda.drip.v1";

export type Side = "buy" | "sell";

export type Armed = {
  id: string;
  symbol: string;
  mint: string;
  side: Side;
  usd: number;
  trigger: "below" | "above";
  price: number;
  status: "armed" | "done";
  sig?: string;
};

export type Drip = {
  usd: number;
  symbols: string[];
  lastDay: string;
};

export type Leg = {
  symbol: string;
  mint: string;
  side: Side;
  usd: number;
  price: number;
};

export function bookOf(names: HouseListing[]): HouseListing[] {
  return names.filter((n) => n.venue === "prestocks" && n.last > 0 && n.mint.length >= 32);
}

export function labs(book: HouseListing[]): HouseListing[] {
  const ai = book.filter((n) => n.sector === "Artificial Intelligence");
  return ai.length ? ai : book.filter((n) => n.symbol === "OPENAI" || n.symbol === "ANTHROPIC");
}

export function underMark(book: HouseListing[]): HouseListing[] {
  return [...book].filter((n) => (n.premium ?? 0) < 0).sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0)).slice(0, 4);
}

export function splitLegs(rows: HouseListing[], usd: number, side: Side): Leg[] {
  if (!rows.length || !(usd > 0)) return [];
  const each = Math.max(1, Math.round((usd / rows.length) * 100) / 100);
  return rows.map((n) => ({ symbol: n.symbol, mint: n.mint, side, usd: each, price: n.last }));
}

export function crossed(order: Armed, last: number): boolean {
  if (order.status === "done" || !(last > 0)) return false;
  return order.trigger === "below" ? last <= order.price : last >= order.price;
}

export function loadOrders(): Armed[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(ORDERS) || "[]") as Armed[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function saveOrders(rows: Armed[]) {
  window.localStorage.setItem(ORDERS, JSON.stringify(rows.slice(0, 24)));
}

export function loadDrip(): Drip | null {
  if (typeof window === "undefined") return null;
  try {
    const row = JSON.parse(window.localStorage.getItem(DRIP) || "") as Drip;
    return row?.symbols?.length ? row : null;
  } catch {
    return null;
  }
}

export function saveDrip(row: Drip) {
  window.localStorage.setItem(DRIP, JSON.stringify(row));
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
