/** 5 bps on a deep book. 8 bps when the book is wider. Collected only when a Jupiter fee token account is set. */

export const DEEP_FEE_BPS = 5;
export const DESK_FEE_BPS = 8;
export const SEND_FEE_BPS = 4;

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
  if (deskFeeAccount()) return `A deep book is ${DEEP_FEE_BPS} bps. A wider book is ${DESK_FEE_BPS} bps. Either is taken only when the route still wins after the fee, and impact is under 1%. ${shown} is the 8 bps figure on this size.`;
  return `A deep book would be ${DEEP_FEE_BPS} bps and a wider book ${DESK_FEE_BPS} bps, only when the route still wins after the fee. No fee account is set, so this trade pays the chain and the venue only.`;
}

export function feeQuoteParam(bps = 0): string {
  if (!deskFeeAccount() || (bps !== DESK_FEE_BPS && bps !== DEEP_FEE_BPS)) return "";
  return `&platformFeeBps=${bps}`;
}

export function feeSwapBody(bps = 0): { feeAccount?: string; platformFeeBps?: number } {
  const account = deskFeeAccount();
  if (!account || (bps !== DESK_FEE_BPS && bps !== DEEP_FEE_BPS)) return {};
  return { feeAccount: account, platformFeeBps: bps };
}

/** The fee the route can carry and still beat the plain quote. Deep books pay 5. Wider books pay 8. A thin book pays 0. */
export function takeBps(impact: number, savedBps: number): number {
  if (!(savedBps > 0) || impact > 1) return 0;
  if (impact <= 0.15 && savedBps > DEEP_FEE_BPS) return DEEP_FEE_BPS;
  if (savedBps > DESK_FEE_BPS) return DESK_FEE_BPS;
  return 0;
}

/** Four bps on a USDC send, free under $5, never more than $0.50. The payee receives the full amount. */
export function sendCut(usd: number): { bps: number; usd: number; why: string } {
  if (!(usd >= 5)) return { bps: 0, usd: 0, why: "Under $5 a USDC send is free." };
  const raw = (usd * SEND_FEE_BPS) / 10_000;
  const fee = Math.min(0.5, Math.max(0.01, Math.round(raw * 100) / 100));
  if (!deskFeeAccount()) return { bps: SEND_FEE_BPS, usd: 0, why: `A send of this size would be $${fee.toFixed(2)}. No fee account is set, so it is free.` };
  return { bps: SEND_FEE_BPS, usd: fee, why: `They receive the full amount. You pay $${fee.toFixed(2)} on top. 4 bps, capped at $0.50.` };
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
  if (!deskFeeAccount()) return { bps: 0, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. No fee account, so the desk takes 0.` };
  const bps = takeBps(impact, savedBps);
  if (bps === 0) return { bps: 0, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. Not enough to take a fee and still beat the plain quote.` };
  return { bps, savedBps, why: `Route saved ${savedBps.toFixed(1)} bps. Desk keeps ${bps}. You keep ${(savedBps - bps).toFixed(1)} after the fee.` };
}
