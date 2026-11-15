/** A Hedge is the live leg. Long and short can both be open. Each leg is signed by the wallet that can sign it. */

const KEY = "senda.hedge.v1";

export type HedgeLeg = { where: "Phantom" | "MetaMask"; what: string; signature: string };

export type Hedge = {
  id: string;
  pair: string;
  long?: HedgeLeg;
  short?: HedgeLeg;
  at: number;
};

export function listHedges(): Hedge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as Hedge[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function rememberHedge(row: Hedge): Hedge[] {
  const all = [row, ...listHedges().filter((item) => item.id !== row.id)];
  localStorage.setItem(KEY, JSON.stringify(all.slice(0, 24)));
  return all;
}
