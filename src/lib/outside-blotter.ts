/** A record of a Base signature. Not a balance. The position lives on their contract. */

const KEY = "senda.outside.v1";

export type OutsideFill = {
  pair: string;
  side: "long" | "short";
  margin: number;
  lev: number;
  entry: number | null;
  hash: string;
  at: number;
};

export function loadFills(): OutsideFill[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as OutsideFill[];
    return Array.isArray(rows) ? rows.filter((r) => typeof r?.hash === "string") : [];
  } catch {
    return [];
  }
}

export function rememberFill(row: OutsideFill) {
  const next = [row, ...loadFills().filter((r) => r.hash !== row.hash)].slice(0, 24);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
