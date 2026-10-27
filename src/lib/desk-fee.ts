/** 8 bps on a route. Collected only when a Jupiter fee token account is set. */

export const DESK_FEE_BPS = 8;

export function deskFeeAccount(): string {
  const fromProcess = typeof process !== "undefined" ? process.env.SENDA_FEE_ACCOUNT || process.env.VITE_SENDA_FEE_ACCOUNT || "" : "";
  const fromVite = (import.meta.env?.VITE_SENDA_FEE_ACCOUNT as string | undefined) || "";
  const raw = (fromProcess || fromVite).trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw) ? raw : "";
}

export function deskFeeUsd(usd: number): number {
  if (!(usd > 0)) return 0;
  return (usd * DESK_FEE_BPS) / 10_000;
}

export function deskFeeLine(usd: number): string {
  const cut = deskFeeUsd(usd);
  const shown = cut > 0 ? `$${cut.toFixed(4)}` : "$0";
  if (deskFeeAccount()) return `Desk fee is ${DESK_FEE_BPS} bps (${shown}) only when this route beats the other quote by more than that and impact is under 1%. A thin book pays nothing.`;
  return `Desk fee would be ${DESK_FEE_BPS} bps (${shown}) when the route beats the plain quote by more than that. No fee account is set, so this trade pays the chain and the venue only.`;
}

export function feeQuoteParam(bps = 0): string {
  return deskFeeAccount() && bps === DESK_FEE_BPS ? `&platformFeeBps=${DESK_FEE_BPS}` : "";
}

export function feeSwapBody(bps = 0): { feeAccount?: string; platformFeeBps?: number } {
  const account = deskFeeAccount();
  return account && bps === DESK_FEE_BPS ? { feeAccount: account, platformFeeBps: DESK_FEE_BPS } : {};
}

/** Eight bps only when the chosen route beats the other quote by more than that, and the book is not thin. */
export function routeEarn(best: number, plain: number, impact: number): { bps: number; savedBps: number; why: string } {
  if (!(best > 0) || !(plain > 0) || best === plain) {
    return { bps: 0, savedBps: 0, why: "One quote. Nothing was beaten, so the desk fee is 0." };
  }
  const top = Math.max(best, plain);
  const base = Math.min(best, plain);
  const savedBps = ((top - base) / base) * 10_000;
  if (impact > 1) return { bps: 0, savedBps, why: `Impact is ${impact.toFixed(2)}%. Thin book. Desk fee stays 0.` };
  if (!(savedBps > DESK_FEE_BPS)) return { bps: 0, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. Not more than the fee, so the desk takes 0.` };
  if (!deskFeeAccount()) return { bps: 0, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. The desk would keep ${DESK_FEE_BPS}. No fee account, so it takes 0.` };
  return { bps: DESK_FEE_BPS, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. Desk keeps ${DESK_FEE_BPS}. You keep ${(savedBps - DESK_FEE_BPS).toFixed(1)}.` };
}
