/** A valuation contract is the token Jupiter filled. The wallet holds it. Senda does not. */

import { settlementDelta } from "@/lib/mark-engine";

export type FdvPos = {
  id: string;
  owner: string;
  mint: string;
  symbol: string;
  kind: "pre" | "x" | "coin";
  side: "long" | "short";
  margin: number;
  lev: number;
  notional: number;
  entry: number;
  fdvEntry: number;
  sig: string;
  at: number;
};

const KEY = "senda.fdv.v1";

export function listFdv(owner?: string): FdvPos[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as FdvPos[];
    const rows = Array.isArray(raw) ? raw.filter((row) => row && typeof row.mint === "string" && row.notional > 0) : [];
    return owner ? rows.filter((row) => row.owner === owner) : rows;
  } catch {
    return [];
  }
}

export function saveFdv(row: Omit<FdvPos, "id" | "at">): FdvPos {
  const next: FdvPos = { ...row, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
  if (typeof window === "undefined") return next;
  const rows = [next, ...listFdv()].slice(0, 80);
  localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event("senda-fdv"));
  return next;
}

export function dropFdv(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(listFdv().filter((row) => row.id !== id)));
  window.dispatchEvent(new Event("senda-fdv"));
}

export function fdvPnl(row: FdvPos, mark: number): number | null {
  return settlementDelta({ entry: row.entry, mark, notional: row.notional, side: row.side })?.pnl ?? null;
}
