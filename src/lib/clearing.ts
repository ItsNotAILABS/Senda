/** A clear is a money movement the desk can show. Chain rows have a signature. */

export type ClearLeg = {
  side: "out" | "in";
  asset: string;
  amount: number;
  where: string;
};

export type ClearRecord = {
  id: string;
  at: number;
  desk: "work" | "cover" | "send" | "trade";
  title: string;
  legs: ClearLeg[];
  feeUsd: number;
  sig?: string;
  status: "signed" | "local";
};

const KEY = "senda.clears.v1";

export function listClears(): ClearRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as ClearRecord[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function rememberClear(row: Omit<ClearRecord, "id" | "at">): ClearRecord {
  const next: ClearRecord = {
    ...row,
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    at: Date.now(),
  };
  const rows = [next, ...listClears()].slice(0, 80);
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  window.dispatchEvent(new Event("senda-clear"));
  return next;
}
