/** The most one send may move, until the person raises it on Wallet. */

const KEY = "senda.spendcap";
const DEFAULT = 100;

export function spendCap(): number {
  if (typeof window === "undefined") return DEFAULT;
  const n = Number(window.localStorage.getItem(KEY));
  if (!Number.isFinite(n) || n < 1) return DEFAULT;
  return Math.min(5000, Math.round(n));
}

export function setSpendCap(n: number): number {
  const v = Math.min(5000, Math.max(1, Math.round(n)));
  try {
    window.localStorage.setItem(KEY, String(v));
  } catch {
    /* quota */
  }
  return v;
}
