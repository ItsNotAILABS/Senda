/** A cap a custodian sets for another wallet. The other wallet holds the tokens. Senda does not. */

const KEY = "senda.allowance.v1";

export type Allowance = { custodian: string; wallet: string; cap: number; at: number };

function read(): Allowance[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || "[]") as Allowance[];
    return Array.isArray(rows) ? rows.filter((r) => r && typeof r.wallet === "string") : [];
  } catch {
    return [];
  }
}

export function listAllowances(): Allowance[] {
  return read();
}

export function allowanceFor(wallet: string): Allowance | null {
  return read().find((r) => r.wallet === wallet) ?? null;
}

export function saveAllowance(custodian: string, wallet: string, cap: number): Allowance {
  if (custodian === wallet) throw new Error("That is this wallet. Paste the other one.");
  const row: Allowance = { custodian, wallet, cap: Math.max(1, Math.round(cap)), at: Date.now() };
  const next = [row, ...read().filter((r) => r.wallet !== wallet)].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
  return row;
}
