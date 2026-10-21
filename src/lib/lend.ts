/** A loan row is the slice that was sold. Repay buys it back. */

const KEY = "senda.lend.v1";

export type Loan = {
  id: string;
  stockId: string;
  symbol: string;
  borrowed: number;
  shares: number;
  createdAt: string;
  mint?: string;
};

export function loadLoans(): Loan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Loan[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function save(rows: Loan[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 20)));
  } catch {
    /* quota */
  }
}

export const LTV = 0.5;

export function borrow(rows: Loan[], stockId: string, symbol: string, shares: number, last: number, mint?: string): Loan[] | { error: string } {
  const room = shares * last * LTV;
  if (!(room >= 0.5)) return { error: "Need a holding first." };
  const next = [
    {
      id: `ln${Math.random().toString(36).slice(2, 8)}`,
      stockId,
      symbol,
      borrowed: Math.round(room * 100) / 100,
      shares,
      createdAt: new Date().toISOString(),
      mint,
    },
    ...rows.filter((r) => r.stockId !== stockId),
  ];
  save(next);
  return next;
}

export function repay(rows: Loan[], id: string): Loan[] {
  const next = rows.filter((r) => r.id !== id);
  save(next);
  return next;
}
