/** The most one send may move, until the person raises it on Wallet. */

import { listTrades } from "@/lib/trade-log";

const KEY = "senda.spendcap";
const DEFAULT = 100;

export function spendCap(): number {
  if (typeof window === "undefined") return DEFAULT;
  const n = Number(window.localStorage.getItem(KEY));
  if (!Number.isFinite(n) || n < 1) return DEFAULT;
  return Math.min(1_000_000, Math.round(n));
}

export function setSpendCap(n: number): number {
  const v = Math.min(1_000_000, Math.max(1, Math.round(n)));
  try {
    window.localStorage.setItem(KEY, String(v));
  } catch {
    /* quota */
  }
  return v;
}

/** Dollars already signed today. A sell returns USDC, so it does not consume the cap. One signature counts once. */
export function signedToday(): number {
  if (typeof window === "undefined") return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  const seen = new Set<string>();
  let usd = 0;
  for (const row of listTrades()) {
    if (!row.signature || row.at < from || seen.has(row.signature)) continue;
    if (row.side === "sell") continue;
    seen.add(row.signature);
    usd += Number(row.usd) || 0;
  }
  return Math.round(usd * 100) / 100;
}

/** Called at the signature, not when a bot queued the ticket. Prior signatures are subtracted here. */
export function assertSpend(usd: number): void {
  if (!(usd > 0)) throw new Error("Enter an amount.");
  const cap = spendCap();
  const used = signedToday();
  if (usd > cap) throw new Error(`That is about $${usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  if (used + usd > cap + 0.009) {
    throw new Error(`$${used.toFixed(2)} is already signed today. Another $${usd.toFixed(2)} would pass the $${cap} cap.`);
  }
}
