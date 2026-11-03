export type AccountFill = {
  id: string;
  at: number;
  desk: string;
  symbol: string;
  side: "buy" | "sell" | "send" | "receive";
  usd: number;
  sig?: string;
};

const KEY = "senda.account.v1";

export function listFills(): AccountFill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as AccountFill[];
    return Array.isArray(raw) ? raw.filter((row) => row && typeof row.symbol === "string" && typeof row.usd === "number") : [];
  } catch {
    return [];
  }
}

export function noteFill(row: Omit<AccountFill, "id" | "at">): AccountFill {
  const next: AccountFill = { ...row, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: Date.now() };
  if (typeof window === "undefined") return next;
  const rows = [next, ...listFills()].slice(0, 200);
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* quota */
  }
  window.dispatchEvent(new Event("senda-account"));
  return next;
}
