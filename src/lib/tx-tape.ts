/** Recent swaps on the deepest Solana pool, read from the chain the way an explorer does. Not a resting book. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chainRpc } from "@/lib/phantom";
import { cachedJson } from "@/lib/net-cache";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

export type ChainPrint = {
  signature: string;
  time: number | null;
  side: "buy" | "sell";
  token: number;
  quote: number;
  quoteSymbol: string;
  price: number;
  usd: number;
};

export type PrintLevel = { price: number; usd: number; n: number };

export type PrintBook = {
  mint: string;
  pool: string;
  dex: string;
  prints: ChainPrint[];
  usd: number;
  levels: PrintLevel[];
  lastPrice: number;
  ageSec: number | null;
  note: string;
};

type Bal = {
  mint?: string;
  owner?: string;
  accountIndex?: number;
  uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string };
};

const memory = new Map<string, { at: number; book: PrintBook }>();

function ui(row: Bal): number {
  const t = row.uiTokenAmount;
  if (!t) return 0;
  if (typeof t.uiAmount === "number" && Number.isFinite(t.uiAmount)) return t.uiAmount;
  const n = Number(t.uiAmountString);
  return Number.isFinite(n) ? n : 0;
}

function deltas(pre: Bal[], post: Bal[], mint: string): Map<string, number> {
  const before = new Map<string, number>();
  const after = new Map<string, number>();
  const add = (map: Map<string, number>, rows: Bal[]) => {
    for (const row of rows) {
      if (row.mint !== mint) continue;
      const key = row.owner || `i${row.accountIndex ?? 0}`;
      map.set(key, (map.get(key) || 0) + ui(row));
    }
  };
  add(before, pre);
  add(after, post);
  const out = new Map<string, number>();
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    out.set(key, (after.get(key) || 0) - (before.get(key) || 0));
  }
  return out;
}

async function solUsd(): Promise<number> {
  const r = await cachedJson(`https://lite-api.jup.ag/price/v3?ids=${SOL}`, 20_000);
  if (!r.ok) return 0;
  return Number((r.body as Record<string, { usdPrice?: number }>)[SOL]?.usdPrice) || 0;
}

async function poolOf(mint: string): Promise<{ pool: string; dex: string; quote: string } | null> {
  const r = await cachedJson(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, 60_000, {
    headers: { accept: "application/json", "user-agent": "Senda" },
  });
  if (!r.ok) return null;
  const pairs = ((r.body as { pairs?: Array<{ chainId?: string; pairAddress?: string; dexId?: string; baseToken?: { address?: string }; quoteToken?: { address?: string }; liquidity?: { usd?: number } }> }).pairs || [])
    .filter((p) => p.chainId === "solana" && p.pairAddress)
    .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const top = pairs[0];
  if (!top?.pairAddress) return null;
  const quote = top.quoteToken?.address === mint ? top.baseToken?.address || "" : top.quoteToken?.address || "";
  return { pool: top.pairAddress, dex: top.dexId || "pool", quote };
}

function empty(mint: string, note: string): PrintBook {
  return { mint, pool: "", dex: "", prints: [], usd: 0, levels: [], lastPrice: 0, ageSec: null, note };
}

export const loadPrints = createServerFn({ method: "POST" })
  .validator(z.object({ mint: z.string().min(32).max(48) }))
  .handler(async ({ data }): Promise<PrintBook> => {
    const hit = memory.get(data.mint);
    if (hit && Date.now() - hit.at < 12_000) return hit.book;
    const found = await poolOf(data.mint).catch(() => null);
    if (!found) return empty(data.mint, "No Solana pool for this mint, so there are no prints to read.");
    const listed = (await chainRpc("getSignaturesForAddress", [found.pool, { limit: 8 }]).catch(() => null)) as
      | Array<{ signature?: string; blockTime?: number | null; err?: unknown }>
      | null;
    const sigs = (listed || []).filter((row) => row.signature && !row.err).slice(0, 6);
    if (!sigs.length) {
      const book = empty(data.mint, "The public node did not return signatures for this pool.");
      book.pool = found.pool;
      book.dex = found.dex;
      return book;
    }
    const quoteMint = found.quote === USDC || found.quote === SOL ? found.quote : USDC;
    const quoteSymbol = quoteMint === USDC ? "USDC" : "SOL";
    const sol = quoteMint === SOL ? await solUsd().catch(() => 0) : 0;
    const prints: ChainPrint[] = [];
    for (const row of sigs) {
      const tx = (await chainRpc("getTransaction", [row.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)) as {
        blockTime?: number | null;
        meta?: { err?: unknown; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] };
      } | null;
      if (!tx?.meta || tx.meta.err) continue;
      const pre = tx.meta.preTokenBalances || [];
      const post = tx.meta.postTokenBalances || [];
      const tokenD = deltas(pre, post, data.mint);
      const quoteD = deltas(pre, post, quoteMint);
      const both = [...tokenD.entries()]
        .map(([owner, token]) => ({ owner, token, quote: quoteD.get(owner) || 0 }))
        .filter((item) => Math.abs(item.token) > 0 && Math.abs(item.quote) > 0)
        .sort((a, b) => Math.abs(a.token) - Math.abs(b.token));
      const taker = both[0];
      if (!taker) continue;
      const token = Math.abs(taker.token);
      const quote = Math.abs(taker.quote);
      if (!(token > 0) || !(quote > 0)) continue;
      const price = quoteMint === USDC ? quote / token : sol > 0 ? (quote * sol) / token : quote / token;
      const usd = quoteMint === USDC ? quote : sol > 0 ? quote * sol : 0;
      prints.push({
        signature: row.signature || "",
        time: tx.blockTime ?? row.blockTime ?? null,
        side: taker.token > 0 ? "buy" : "sell",
        token,
        quote,
        quoteSymbol,
        price,
        usd,
      });
    }
    const usd = prints.reduce((s, row) => s + row.usd, 0);
    const buckets = new Map<string, PrintLevel>();
    for (const row of prints) {
      if (!(row.price > 0)) continue;
      const key = row.price.toPrecision(4);
      const cur = buckets.get(key) || { price: Number(key), usd: 0, n: 0 };
      cur.usd += row.usd;
      cur.n += 1;
      buckets.set(key, cur);
    }
    const levels = [...buckets.values()].sort((a, b) => b.usd - a.usd).slice(0, 6);
    const newest = prints.reduce((n, row) => (row.time && row.time > n ? row.time : n), 0);
    const book: PrintBook = {
      mint: data.mint,
      pool: found.pool,
      dex: found.dex,
      prints,
      usd,
      levels,
      lastPrice: prints.find((row) => row.price > 0)?.price || 0,
      ageSec: newest ? Math.max(0, Math.round(Date.now() / 1000 - newest)) : null,
      note: prints.length
        ? `Last ${prints.length} swaps on the ${found.dex} pool. Same transactions Solscan lists. Volume is what those swaps moved, not a resting book.`
        : "The signatures came back, but none of them moved this mint against the quote.",
    };
    memory.set(data.mint, { at: Date.now(), book });
    return book;
  });
