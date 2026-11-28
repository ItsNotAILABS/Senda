/** Phoenix perps on Solana. Senda reads their public book and asks Phantom to sign. Senda does not match or hold the position. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API = "https://perp-api.phoenix.trade";
const WS = "wss://perp-api.phoenix.trade/v1/ws";

export type PhoenixKind = "equity" | "etf" | "preipo" | "commodity" | "crypto";

export type PhoenixMarket = {
  symbol: string;
  name: string;
  kind: PhoenixKind;
  logo: string | null;
  color: string | null;
  leverage: number;
  isolated: boolean;
  status: string;
  mark: number;
  oi: number | null;
  supply: number | null;
  cap: number | null;
  change: number | null;
  volume: number | null;
};

export type PhoenixCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  markOpen: number;
  markHigh: number;
  markLow: number;
  markClose: number;
  volume: number;
  volumeQuote: number;
};

export type PhoenixLevel = { price: number; size: number };

export type PhoenixDetail = {
  symbol: string;
  mark: number;
  index: number;
  mid: number | null;
  funding: number | null;
  fundingYear: number | null;
  oi: number | null;
  decimals: number;
  takerBps: number | null;
  makerBps: number | null;
  bids: PhoenixLevel[];
  asks: PhoenixLevel[];
};

export type PhoenixIx = {
  programId: string;
  data: number[];
  keys: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
};

export type PhoenixPosition = {
  symbol: string;
  size: number;
  entry: number;
  sub: number;
};

const ETF = new Set(["QQQ", "SPY", "TLT"]);
const METAL = new Set(["GOLD", "SILVER", "COPPER", "WTIOIL"]);
const PRE = new Set(["ANTHROPIC"]);

const symbolSchema = z.string().regex(/^[A-Za-z0-9]{1,16}$/);
const walletSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);

type RawMarket = {
  symbol?: string;
  marketStatus?: string;
  isolatedOnly?: boolean;
  leverageTiers?: Array<{ maxLeverage?: number }>;
  openInterest?: { ui?: string; value?: number; decimals?: number };
  metadata?: {
    name?: string;
    logoUri?: string | null;
    displayColor?: string | null;
    circulatingSupply?: number | null;
    coinGeckoId?: string | null;
    classifications?: string[];
  };
};

let bookCache: { at: number; rows: PhoenixMarket[] } | null = null;
const moveCache = new Map<string, { change: number | null; volume: number | null; at: number }>();
let moveJob: Promise<void> | null = null;
let knownSymbols: string[] = [];

function kindOf(symbol: string, meta: RawMarket["metadata"]): PhoenixKind {
  const tags = new Set((meta?.classifications ?? []).map((t) => t.toLowerCase()));
  if (PRE.has(symbol) || tags.has("pre-ipo")) return "preipo";
  if (METAL.has(symbol) || tags.has("commodity")) return "commodity";
  if (ETF.has(symbol)) return "etf";
  if (meta?.coinGeckoId || tags.has("solana") || tags.has("l1") || tags.has("meme") || tags.has("defi")) return "crypto";
  return "equity";
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { accept: "application/json", "content-type": "application/json", ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text.slice(0, 280) || `Phoenix ${res.status}`);
  return JSON.parse(text) as T;
}

async function mids(): Promise<Record<string, number>> {
  const WSCtor = (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
  if (!WSCtor) return {};
  return new Promise((resolve) => {
    let done = false;
    const finish = (rows: Record<string, number>) => {
      if (done) return;
      done = true;
      resolve(rows);
    };
    const ws = new WSCtor(WS);
    const timer = setTimeout(() => {
      ws.close();
      finish({});
    }, 7000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", subscription: { channel: "allMids" } }));
    });
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { channel?: string; mids?: Record<string, number> };
        if (msg.channel === "allMids" && msg.mids) {
          clearTimeout(timer);
          ws.close();
          finish(msg.mids);
        }
      } catch {
        /* ignore a bad frame */
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      finish({});
    });
  });
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function fillMoves(symbols: string[]) {
  const now = Date.now();
  const todo = symbols.filter((s) => {
    const hit = moveCache.get(s);
    return !hit || now - hit.at > 120_000;
  });
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const symbol = todo[cursor];
      cursor += 1;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const bars = await getJson<Array<{ close?: number; volumeQuote?: number }>>(
            `/v1/candles/${encodeURIComponent(symbol)}?timeframe=1d&limit=2`,
          );
          const last = bars.at(-1);
          const prev = bars.length > 1 ? bars[bars.length - 2] : null;
          const close = num(last?.close);
          const before = num(prev?.close);
          moveCache.set(symbol, {
            change: close != null && before ? ((close - before) / before) * 100 : null,
            volume: num(last?.volumeQuote),
            at: Date.now(),
          });
          break;
        } catch (e) {
          const wait = /429/.test(e instanceof Error ? e.message : "") ? 400 * (attempt + 1) : 0;
          if (!wait || attempt === 2) break;
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, () => worker()));
}

function ensureMoves(symbols: string[]) {
  knownSymbols = symbols;
  if (!moveJob) moveJob = fillMoves(symbols).finally(() => { moveJob = null; });
  return moveJob;
}

function paint(rows: PhoenixMarket[]): PhoenixMarket[] {
  return rows.map((row) => {
    const move = moveCache.get(row.symbol);
    return move ? { ...row, change: move.change, volume: move.volume } : row;
  });
}

async function loadBook(): Promise<PhoenixMarket[]> {
  if (bookCache && Date.now() - bookCache.at < 15_000) {
    void ensureMoves(bookCache.rows.map((r) => r.symbol));
    return paint(bookCache.rows);
  }
  const [listed, tape] = await Promise.all([
    getJson<{ markets?: RawMarket[] }>("/v1/view/markets"),
    mids(),
  ]);
  const rows: PhoenixMarket[] = (listed.markets ?? []).flatMap((row) => {
    const symbol = String(row.symbol || "");
    if (!symbol) return [];
    const mark = Number(tape[symbol]) || 0;
    const oi = num(row.openInterest?.ui);
    const supply = num(row.metadata?.circulatingSupply);
    const cached = moveCache.get(symbol);
    return [{
      symbol,
      name: row.metadata?.name || symbol,
      kind: kindOf(symbol, row.metadata),
      logo: row.metadata?.logoUri || null,
      color: row.metadata?.displayColor || null,
      leverage: Number(row.leverageTiers?.[0]?.maxLeverage) || 1,
      isolated: Boolean(row.isolatedOnly),
      status: row.marketStatus || "active",
      mark,
      oi,
      supply,
      cap: supply && mark ? supply * mark : null,
      change: cached?.change ?? null,
      volume: cached?.volume ?? null,
    }];
  });
  bookCache = { at: Date.now(), rows };
  void ensureMoves(rows.map((r) => r.symbol));
  return paint(rows);
}

export const phoenixBook = createServerFn({ method: "GET" }).handler(async () => loadBook());

export const phoenixMoves = createServerFn({ method: "GET" }).handler(async () => {
  const symbols = knownSymbols.length ? knownSymbols : (await loadBook()).map((r) => r.symbol);
  await Promise.race([
    ensureMoves(symbols),
    new Promise((resolve) => setTimeout(resolve, 8000)),
  ]);
  return symbols.flatMap((symbol) => {
    const move = moveCache.get(symbol);
    return move ? [{ symbol, change: move.change, volume: move.volume }] : [];
  });
});

const TFS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d"] as const;

export const phoenixCandles = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ symbol: symbolSchema, timeframe: z.enum(TFS) }).parse(input))
  .handler(async ({ data }): Promise<PhoenixCandle[]> => {
    const bars = await getJson<Array<Record<string, number>>>(
      `/v1/candles/${encodeURIComponent(data.symbol)}?timeframe=${data.timeframe}&limit=180`,
    );
    return bars.flatMap((bar) => {
      const close = num(bar.close);
      if (close == null) return [];
      return [{
        time: Number(bar.time) || 0,
        open: num(bar.open) ?? close,
        high: num(bar.high) ?? close,
        low: num(bar.low) ?? close,
        close,
        markOpen: num(bar.markOpen) ?? close,
        markHigh: num(bar.markHigh) ?? close,
        markLow: num(bar.markLow) ?? close,
        markClose: num(bar.markClose) ?? close,
        volume: num(bar.volume) ?? 0,
        volumeQuote: num(bar.volumeQuote) ?? 0,
      }];
    });
  });

function levels(raw: unknown): PhoenixLevel[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 8).flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const price = num(row[0]);
    const size = num(row[1]);
    return price && size ? [{ price, size }] : [];
  });
}

export const phoenixDetail = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ symbol: symbolSchema }).parse(input))
  .handler(async ({ data }): Promise<PhoenixDetail> => {
    const [view, book] = await Promise.all([
      getJson<{ market?: Record<string, unknown> }>(`/v1/view/market/${encodeURIComponent(data.symbol)}`),
      getJson<{ bids?: unknown; asks?: unknown }>(`/v1/view/orderbook/${encodeURIComponent(data.symbol)}`).catch(() => ({ bids: [], asks: [] })),
    ]);
    const market = view.market ?? {};
    const mark = num((market.markPrice as { price?: number } | undefined)?.price) ?? 0;
    const index = num((market.spotPrice as { price?: number } | undefined)?.price) ?? mark;
    const l2 = market.l2Orderbook as { mid?: number } | undefined;
    const fees = market.fees as { takerFeeMicro?: number; makerFeeMicro?: number } | undefined;
    const units = market.units as { baseLotsDecimals?: number } | undefined;
    const oi = num((market.openInterest as { ui?: string } | undefined)?.ui);
    return {
      symbol: data.symbol,
      mark,
      index,
      mid: num(l2?.mid),
      funding: num(market.currentFundingRatePercentage),
      fundingYear: num(market.annualizedFundingRatePercentage),
      oi,
      decimals: Number(units?.baseLotsDecimals) || 2,
      takerBps: fees?.takerFeeMicro != null ? fees.takerFeeMicro / 100 : null,
      makerBps: fees?.makerFeeMicro != null ? fees.makerFeeMicro / 100 : null,
      bids: levels(book.bids),
      asks: levels(book.asks).reverse(),
    };
  });

export const phoenixNonce = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ wallet: walletSchema }).parse(input))
  .handler(async ({ data }) => {
    return getJson<{ nonce_id: string; message: string }>(`/v1/auth/nonce?wallet_pubkey=${data.wallet}`);
  });

export const phoenixLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    wallet: walletSchema,
    signature: z.string().min(32).max(120),
    nonceId: z.string().min(8).max(80),
  }).parse(input))
  .handler(async ({ data }) => {
    const session = await getJson<{ access_token: string; expires_in: number }>("/v1/auth/login/wallet", {
      method: "POST",
      body: JSON.stringify({ wallet_pubkey: data.wallet, signature: data.signature, nonce_id: data.nonceId }),
    });
    return { accessToken: session.access_token, expiresIn: session.expires_in };
  });

function readIxs(body: unknown): PhoenixIx[] {
  const list = Array.isArray(body) ? body : (body as { instructions?: unknown })?.instructions;
  if (!Array.isArray(list)) throw new Error("Phoenix did not return a transaction.");
  return list.flatMap((row) => {
    const ix = row as PhoenixIx;
    if (!ix?.programId || !Array.isArray(ix.data) || !Array.isArray(ix.keys)) return [];
    return [ix];
  });
}

export const phoenixRegister = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ authority: walletSchema }).parse(input))
  .handler(async ({ data }) => {
    const body = await getJson<unknown>("/v1/exchange/build-register-ixs", {
      method: "POST",
      body: JSON.stringify({ traderAuthority: data.authority, txFeePayer: data.authority }),
    });
    return { ixs: readIxs(body) };
  });

export const phoenixOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(20).max(4000),
    authority: walletSchema,
    symbol: symbolSchema,
    side: z.enum(["bid", "ask"]),
    quantity: z.number().positive().max(1_000_000),
    margin: z.number().positive().max(1_000_000),
  }).parse(input))
  .handler(async ({ data }) => {
    const body = await getJson<unknown>("/v1/ix/place-isolated-market-order", {
      method: "POST",
      headers: { authorization: `Bearer ${data.token}` },
      body: JSON.stringify({
        authority: data.authority,
        symbol: data.symbol,
        side: data.side,
        quantity: data.quantity,
        transferAmount: Math.round(data.margin * 1_000_000),
      }),
    });
    return { ixs: readIxs(body) };
  });

export const phoenixPositions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({
    token: z.string().min(20).max(4000),
    authority: walletSchema,
  }).parse(input))
  .handler(async ({ data }): Promise<PhoenixPosition[]> => {
    const body = await getJson<{ snapshot?: { subaccounts?: Array<{ subaccountIndex?: number; positions?: unknown }> } }>(
      `/v1/trader/state/${data.authority}`,
      { headers: { authorization: `Bearer ${data.token}` } },
    );
    const subs = body.snapshot?.subaccounts ?? [];
    const out: PhoenixPosition[] = [];
    for (const sub of subs) {
      const rows = Array.isArray(sub.positions) ? sub.positions : [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const rec = row as Record<string, unknown>;
        const symbol = typeof rec.symbol === "string" ? rec.symbol : "";
        const size = num(rec.basePositionLots);
        const entry = num(rec.entryPriceUsd) ?? 0;
        if (!symbol || !size) continue;
        out.push({ symbol, size, entry, sub: Number(sub.subaccountIndex) || 0 });
      }
    }
    return out;
  });
