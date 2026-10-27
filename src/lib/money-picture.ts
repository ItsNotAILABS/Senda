/** One count of what an address can use. Chain tokens, cash pockets, and USDC posted into a pot. */

import type { BoardGroup, TapeRow } from "@/lib/universe";
import { priceMints, UNIVERSE } from "@/lib/universe";

type Leg = { owner: string; usd: number };

export type OpenLine = { id: string; label: string; usd: number };

export type HeldLine = { mint: string; symbol: string; group: BoardGroup; ui: number; usd: number };

export type Picture = {
  total: number;
  sol: number;
  solUsd: number;
  usdc: number;
  /** Phantom Cash on this address. A dollar token. Not the browser book. */
  phantomCash: number;
  cash: number;
  companies: number;
  crypto: number;
  listed: number;
  posted: number;
  lines: HeldLine[];
  open: OpenLine[];
};

type House = {
  preds?: Array<{ id: string; symbol: string; tenor: string; strike?: number; status: string; yes: Leg[]; no: Leg[] }>;
  perps?: Array<{ id: string; owner: string; symbol: string; side: string; margin: number; status: string }>;
  races?: Array<{ id: string; left: string; right: string; tenor: string; status: string; leftLegs: Leg[]; rightLegs: Leg[] }>;
};

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";
const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Tape plus a Jupiter price for SOL and for anything this address holds that the ladder skipped. */
export async function quoteHeld(mints: string[], tape: TapeRow[]): Promise<TapeRow[]> {
  const have = new Set(tape.map((row) => row.mint));
  const need = [...new Set([SOL_MINT, ...mints])].filter((mint) => mint && !have.has(mint)).slice(0, 40);
  if (!need.length) return tape;
  const priced = await priceMints({ data: { ids: need } }).catch(() => [] as Array<{ mint: string; price: number }>);
  const extra: TapeRow[] = priced
    .filter((row) => row.price > 0)
    .map((row) => {
      const named = UNIVERSE.find((name) => name.mint === row.mint);
      return {
        symbol: named?.symbol || `${row.mint.slice(0, 4)}…${row.mint.slice(-4)}`,
        mint: row.mint,
        group: named?.group || "crypto",
        price: row.price,
        change: 0,
      };
    });
  return [...tape, ...extra];
}

export function buildPicture(input: {
  owner: string;
  sol: number;
  tokens: Array<{ mint: string; ui: number; symbol?: string }>;
  tape: TapeRow[];
  cash: number;
  house: House | null;
}): Picture {
  const px = new Map(input.tape.map((r) => [r.mint, r.price]));
  const solMint = UNIVERSE.find((n) => n.symbol === "SOL")?.mint || SOL_MINT;
  const solUsd = input.sol * (px.get(solMint) || input.tape.find((row) => row.symbol === "SOL")?.price || 0);
  const usdc = input.tokens.find((t) => t.mint === USDC)?.ui || 0;
  const phantomCash = input.tokens.find((t) => t.mint === CASH)?.ui || 0;
  const lines: HeldLine[] = [];
  let companies = 0;
  let crypto = 0;
  let listed = 0;
  const seen = new Set<string>();
  for (const token of input.tokens) {
    if (!token.mint || token.mint === USDC || token.mint === CASH || !(token.ui > 0) || seen.has(token.mint)) continue;
    seen.add(token.mint);
    const named = UNIVERSE.find((name) => name.mint === token.mint);
    const price = px.get(token.mint) || 0;
    const usd = token.ui * price;
    const group = named?.group || "crypto";
    lines.push({
      mint: token.mint,
      symbol: named?.symbol || token.symbol || `${token.mint.slice(0, 4)}…${token.mint.slice(-4)}`,
      group,
      ui: token.ui,
      usd,
    });
    if (!(usd > 0)) continue;
    if (group === "company") companies += usd;
    else if (group === "listed") listed += usd;
    else crypto += usd;
  }
  const open: OpenLine[] = [];
  let posted = 0;
  const add = (id: string, label: string, usd: number) => {
    if (!(usd > 0)) return;
    posted += usd;
    open.push({ id, label, usd: Math.round(usd * 100) / 100 });
  };
  if (input.owner && input.house) {
    for (const c of input.house.preds || []) {
      if (c.status !== "open") continue;
      const y = c.yes.filter((l) => l.owner === input.owner).reduce((s, l) => s + l.usd, 0);
      const n = c.no.filter((l) => l.owner === input.owner).reduce((s, l) => s + l.usd, 0);
      const side = y > 0 ? "above" : "below";
      const where = c.strike && c.strike > 0 ? `$${c.strike}` : "the print";
      add(c.id, `${c.symbol} ${c.tenor} ${side} ${where}`, y + n);
    }
    for (const p of input.house.perps || []) {
      if (p.status !== "open" || p.owner !== input.owner) continue;
      add(p.id, `${p.symbol} ${p.side}`, p.margin);
    }
    for (const r of input.house.races || []) {
      if (r.status !== "open") continue;
      const a = r.leftLegs.filter((l) => l.owner === input.owner).reduce((s, l) => s + l.usd, 0);
      const b = r.rightLegs.filter((l) => l.owner === input.owner).reduce((s, l) => s + l.usd, 0);
      add(r.id, `${r.left} vs ${r.right}`, a + b);
    }
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  const total = round(solUsd + usdc + phantomCash + input.cash + companies + crypto + listed + posted);
  return {
    total,
    sol: input.sol,
    solUsd: round(solUsd),
    usdc: round(usdc),
    phantomCash: round(phantomCash),
    cash: round(input.cash),
    companies: round(companies),
    crypto: round(crypto),
    listed: round(listed),
    posted: round(posted),
    lines,
    open,
  };
}
