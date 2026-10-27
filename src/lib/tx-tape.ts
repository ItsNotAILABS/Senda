/** Recent swaps on the deepest Solana pool, read from the chain the way an explorer does. Not a resting book. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { chainRpc } from "@/lib/phantom";
import { cachedJson } from "@/lib/net-cache";
import { judgeBook, type BookCall } from "@/lib/book-engine";

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

export type BookRow = { price: number; size: number; usd: number; total: number };

export type PrintBook = {
  mint: string;
  pool: string;
  dex: string;
  prints: ChainPrint[];
  usd: number;
  bids: BookRow[];
  asks: BookRow[];
  lastPrice: number;
  spread: number;
  ageSec: number | null;
  call: BookCall;
  note: string;
};

type Bal = {
  mint?: string;
  owner?: string;
  accountIndex?: number;
  uiTokenAmount?: { uiAmount?: number | null; uiAmountString?: string };
};

const memory = new Map<string, { at: number; busy: boolean; prints: ChainPrint[]; pool: string; dex: string; quote: string; sol: number }>();

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
  return {
    mint,
    pool: "",
    dex: "",
    prints: [],
    usd: 0,
    bids: [],
    asks: [],
    lastPrice: 0,
    spread: 0,
    ageSec: null,
    call: judgeBook({ bids: [], asks: [], lastPrice: 0, spread: 0, prints: [] }),
    note,
  };
}

function bucket(price: number): number {
  const tick = price >= 1000 ? 0.1 : price >= 100 ? 0.01 : price >= 1 ? 0.001 : price >= 0.01 ? 0.0001 : 0;
  if (!tick) return Number(price.toPrecision(4));
  return Math.round(price / tick) * tick;
}

function ladder(rows: ChainPrint[], side: "buy" | "sell"): BookRow[] {
  const bags = new Map<number, { size: number; usd: number }>();
  for (const row of rows) {
    if (row.side !== side || !(row.price > 0)) continue;
    const price = bucket(row.price);
    const cur = bags.get(price) || { size: 0, usd: 0 };
    cur.size += row.token;
    cur.usd += row.usd;
    bags.set(price, cur);
  }
  const ordered = [...bags.entries()].sort((a, b) => (side === "buy" ? b[0] - a[0] : a[0] - b[0]));
  let total = 0;
  return ordered.slice(0, 8).map(([price, row]) => {
    total += row.size;
    return { price, size: row.size, usd: row.usd, total };
  });
}

function shape(mint: string, slot: { prints: ChainPrint[]; pool: string; dex: string }): PrintBook {
  const prints = slot.prints;
  const bids = ladder(prints, "buy");
  const asks = ladder(prints, "sell");
  const bestBid = bids[0]?.price || 0;
  const bestAsk = asks[0]?.price || 0;
  const newest = prints.reduce((n, row) => (row.time && row.time > n ? row.time : n), 0);
  const draft = {
    bids,
    asks,
    lastPrice: prints.find((row) => row.price > 0)?.price || 0,
    spread: bestBid > 0 && bestAsk > bestBid ? bestAsk - bestBid : 0,
    prints,
  };
  return {
    mint,
    pool: slot.pool,
    dex: slot.dex,
    prints: prints.slice(0, 12),
    usd: prints.reduce((s, row) => s + row.usd, 0),
    bids,
    asks,
    lastPrice: draft.lastPrice,
    spread: draft.spread,
    ageSec: newest ? Math.max(0, Math.round(Date.now() / 1000 - newest)) : null,
    call: judgeBook(draft),
    note: prints.length ? `${slot.dex} fills` : "Waiting on the next swap.",
  };
}

async function readSwap(
  signature: string,
  blockTime: number | null,
  mint: string,
  quoteMint: string,
  sol: number,
): Promise<ChainPrint | null> {
  const tx = (await chainRpc("getTransaction", [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)) as {
    blockTime?: number | null;
    meta?: { err?: unknown; preTokenBalances?: Bal[]; postTokenBalances?: Bal[] };
  } | null;
  if (!tx?.meta || tx.meta.err) return null;
  const pre = tx.meta.preTokenBalances || [];
  const post = tx.meta.postTokenBalances || [];
  const tokenD = deltas(pre, post, mint);
  const quoteD = deltas(pre, post, quoteMint);
  const both = [...tokenD.entries()]
    .map(([owner, token]) => ({ owner, token, quote: quoteD.get(owner) || 0 }))
    .filter((item) => Math.abs(item.token) > 0 && Math.abs(item.quote) > 0)
    .sort((a, b) => Math.abs(a.token) - Math.abs(b.token));
  const taker = both[0];
  if (!taker) return null;
  const token = Math.abs(taker.token);
  const quote = Math.abs(taker.quote);
  if (!(token > 0) || !(quote > 0)) return null;
  const price = quoteMint === USDC ? quote / token : sol > 0 ? (quote * sol) / token : quote / token;
  const usd = quoteMint === USDC ? quote : sol > 0 ? quote * sol : 0;
  return {
    signature,
    time: tx.blockTime ?? blockTime,
    side: taker.token > 0 ? "buy" : "sell",
    token,
    quote,
    quoteSymbol: quoteMint === USDC ? "USDC" : "SOL",
    price,
    usd,
  };
}

export async function readBook(mint: string): Promise<PrintBook> {
    let slot = memory.get(mint);
    if (!slot) {
      slot = { at: 0, busy: false, prints: [], pool: "", dex: "", quote: "", sol: 0 };
      memory.set(mint, slot);
    }
    if (slot.busy || (slot.at > 0 && Date.now() - slot.at < 1_500)) {
      return slot.prints.length ? shape(mint, slot) : empty(mint, slot.pool ? "Reading the next swaps." : "No Solana pool for this mint.");
    }

    slot.busy = true;
    try {
      if (!slot.pool) {
        const found = await poolOf(mint).catch(() => null);
        if (!found) return empty(mint, "No Solana pool for this mint.");
        slot.pool = found.pool;
        slot.dex = found.dex;
        slot.quote = found.quote === USDC || found.quote === SOL ? found.quote : USDC;
      }
      if (slot.quote === SOL && !(slot.sol > 0)) slot.sol = await solUsd().catch(() => 0);
      const listed = (await chainRpc("getSignaturesForAddress", [slot.pool, { limit: 16 }]).catch(() => null)) as
        | Array<{ signature?: string; blockTime?: number | null; err?: unknown }>
        | null;
      const known = new Set(slot.prints.map((row) => row.signature));
      const next = (listed || []).filter((row) => row.signature && !row.err && !known.has(row.signature || "")).slice(0, slot.prints.length ? 4 : 12);
      const parsed = await Promise.all(next.map((row) => readSwap(row.signature || "", row.blockTime ?? null, mint, slot!.quote, slot!.sol)));
      const added = parsed.filter((row): row is ChainPrint => Boolean(row));
      if (added.length) slot.prints = [...added, ...slot.prints].slice(0, 48);
    } catch {
      /* keep the last book */
    } finally {
      slot.at = Date.now();
      slot.busy = false;
    }
    if (!slot.prints.length) {
      const book = empty(mint, "No decoded swaps on this pool yet.");
      book.pool = slot.pool;
      book.dex = slot.dex;
      return book;
    }
    return shape(mint, slot);
}

export const loadPrints = createServerFn({ method: "POST" })
  .validator(z.object({ mint: z.string().min(32).max(48) }))
  .handler(async ({ data }) => readBook(data.mint));
