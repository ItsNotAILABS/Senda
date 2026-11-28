/** A pair contract is the token in the wallet. The terms are the fill. Close sells it back. */

import { USDC } from "@/lib/jup-exec";
import { signRoute } from "@/lib/jup-sign";
import { splHolding } from "@/lib/phantom";

const KEY = "senda.pair.ticket.v1";

export type PairContract = {
  id: string;
  pair: string;
  symbol: string;
  mint: string;
  usd: number;
  got: number;
  paid: number;
  signature: string;
  at: number;
  terms: string;
  closed?: string;
};

export function listPairs(): PairContract[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as PairContract[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function save(rows: PairContract[]) {
  localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 24)));
}

export function pairTerms(pair: string, symbol: string, usd: number, got: number): string {
  return `Long ${pair}. The wallet holds ${symbol}. Paid $${usd.toFixed(2)} USDC. Close sells ${symbol} back to USDC. This is the token, not a position at a broker.`;
}

export function rememberPair(row: Omit<PairContract, "terms"> & { terms?: string }): PairContract[] {
  const next: PairContract = { ...row, terms: row.terms || pairTerms(row.pair, row.symbol, row.usd, row.got) };
  const all = [next, ...listPairs().filter((item) => item.id !== next.id)];
  save(all);
  return all;
}

export async function closePair(owner: string, ticket: PairContract): Promise<string> {
  const held = await splHolding(owner, ticket.mint);
  if (!(Number(held.raw) > 0)) throw new Error(`No ${ticket.symbol} in this wallet to sell.`);
  const signed = await signRoute({
    owner,
    inputMint: ticket.mint,
    outputMint: USDC,
    amountRaw: Number(held.raw),
    outDecimals: 6,
    usd: Math.max(ticket.usd, 1),
  });
  save(listPairs().map((item) => (item.id === ticket.id ? { ...item, closed: signed.signature } : item)));
  return signed.signature;
}
