/**
 * The prepaid sleeve. One wallet, one Revtag, many currencies.
 * An opened Revolut payment is not paid. A signed USDC transfer is.
 */

import type { SleeveCcy } from "@/lib/revolut-link";

const KEY = "senda.sleeve.v1";

export type SleeveOrder = {
  id: string;
  wallet: string;
  buyerTag: string;
  sellerTag: string;
  product: string;
  desk: string;
  usd: number;
  ccy: SleeveCcy;
  quoted: number;
  ref: string;
  status: "opened" | "signed";
  sig?: string;
  at: number;
};

export function sleeveAmount(usd: number, ccy: SleeveCcy, usdPer: { EUR?: number; GBP?: number; MXN?: number }): number {
  if (!(usd > 0)) return 0;
  if (ccy === "USD") return Math.round(usd * 100) / 100;
  const per = ccy === "EUR" ? usdPer.EUR : ccy === "GBP" ? usdPer.GBP : usdPer.MXN;
  if (!per || per <= 0) return 0;
  return Math.round((usd / per) * 100) / 100;
}

function readAll(): SleeveOrder[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as SleeveOrder[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeAll(rows: SleeveOrder[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listOrders(wallet: string): SleeveOrder[] {
  const who = wallet.trim();
  if (!who) return [];
  return readAll().filter((r) => r.wallet === who);
}

export function openSleeveOrder(row: Omit<SleeveOrder, "id" | "at" | "status">): SleeveOrder {
  const next: SleeveOrder = { ...row, id: crypto.randomUUID(), status: "opened", at: Date.now() };
  writeAll([next, ...readAll()]);
  return next;
}

/** Only a Solana signature closes an order. Revolut does not report back. */
export function signSleeveOrder(id: string, sig: string): void {
  writeAll(readAll().map((r) => (r.id === id ? { ...r, status: "signed", sig } : r)));
}
