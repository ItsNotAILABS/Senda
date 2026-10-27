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
  if (deskFeeAccount()) return `Desk fee ${DESK_FEE_BPS} bps · ${shown} on this ticket. Jupiter pays the fee account.`;
  return `Desk fee ${DESK_FEE_BPS} bps would be ${shown}. Not collected. No fee account is set, so this pays the chain and the venue only.`;
}

export function feeQuoteParam(): string {
  return deskFeeAccount() ? `&platformFeeBps=${DESK_FEE_BPS}` : "";
}

export function feeSwapBody(): { feeAccount?: string; platformFeeBps?: number } {
  const account = deskFeeAccount();
  return account ? { feeAccount: account, platformFeeBps: DESK_FEE_BPS } : {};
}
