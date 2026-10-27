/** Signed swaps this browser has sent. The signature is public. The list is not sealed. */

import { invalidateChain, showInPhantom } from "@/lib/phantom";

const KEY = "senda.trades.v1";
const EVENT = "senda-trade";
const SKIP_WATCH = new Set([
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH",
  "So11111111111111111111111111111111111111112",
]);

export type TradeFill = {
  at: number;
  symbol: string;
  side: "buy" | "sell" | "send";
  usd: number;
  mint: string;
  signature: string;
  qty?: number;
  /** Dollars, SOL, or token units that left for the swap itself. */
  paidUi?: number;
  paidAsset?: string;
  /** What the output side was denominated in. USDC on a sell, the token on a buy. */
  receivedAsset?: string;
  /** Fill price in dollars per token received. */
  executed?: number;
  /** Screen price the ticket showed before the route. */
  refPrice?: number;
  quotedUi?: number;
  slippageBps?: number;
  platformFeeBps?: number;
  impact?: number;
  route?: string;
  /** Signature + priority, in SOL. */
  solFee?: number;
  /** Rent for a token account created in this transaction. Once per mint. */
  solRent?: number;
  solTotal?: number;
  ataNew?: boolean;
};

export function listTrades(): TradeFill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as TradeFill[];
    return Array.isArray(raw) ? raw.filter((r) => r && typeof r.signature === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTrade(row: Omit<TradeFill, "at">) {
  const next: TradeFill = { ...row, at: Date.now() };
  const rows = [next, ...listTrades().filter((r) => r.signature !== row.signature)].slice(0, 80);
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    /* quota */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
}

/** One signed fill. The blotter, the balances, and Phantom's list all hear it. */
export function fileFill(row: Omit<TradeFill, "at"> & { owner?: string }) {
  rememberTrade(row);
  if (row.owner) invalidateChain(row.owner);
  if (row.side === "buy" && row.mint && !SKIP_WATCH.has(row.mint)) void showInPhantom(row.mint);
}

export function onTrades(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
