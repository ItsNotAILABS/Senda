/**
 * Real street book for one market: history, depth, prints.
 * Polymarket CLOB + Data API. Kalshi elections/series candlesticks + orderbook.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Side } from "@/lib/lmsr";
import type { Venue } from "@/lib/feeds";

const UA = "Senda/1.0 (read-only tape; no custody)";
const CLOB = "https://clob.polymarket.com";
const POLY_DATA = "https://data-api.polymarket.com";
const POLY_GAMMA = "https://gamma-api.polymarket.com";
const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";

export type HistPoint = { t: number; p: number };
export type DepthLevel = { price: number; size: number };
export type StreetTrade = {
  id: string;
  at: number;
  side: Side;
  price: number;
  size: number;
  name: string;
};

export type StreetBook = {
  history: HistPoint[];
  bids: DepthLevel[];
  asks: DepthLevel[];
  trades: StreetTrade[];
  bid: number | null;
  ask: number | null;
  last: number | null;
};

const emptyBook: StreetBook = {
  history: [],
  bids: [],
  asks: [],
  trades: [],
  bid: null,
  ask: null,
  last: null,
};

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function atMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v > 1e12 ? v : v * 1000;
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function getJson(url: string, ms = 3500): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": UA },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function sortDepth(levels: DepthLevel[], dir: "bid" | "ask"): DepthLevel[] {
  const copy = levels.filter((l) => l.price > 0 && l.price < 1 && l.size > 0);
  copy.sort((a, b) => (dir === "bid" ? b.price - a.price : a.price - b.price));
  const tight = copy.filter((l) => l.price >= 0.03 && l.price <= 0.97);
  return (tight.length ? tight : copy).slice(0, 8);
}

function seriesFromTicker(ticker: string): string {
  const i = ticker.lastIndexOf("-");
  return i > 2 ? ticker.slice(0, i) : ticker;
}

async function resolvePoly(venueKey: string): Promise<{ tokenYes: string; conditionId: string }> {
  const raw = await getJson(`${POLY_GAMMA}/markets/${encodeURIComponent(venueKey)}`);
  const m = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object") return { tokenYes: "", conditionId: "" };
  const tokens = parseJsonArray(m.clobTokenIds);
  return {
    tokenYes: tokens[0] ?? "",
    conditionId: String(m.conditionId ?? ""),
  };
}

async function polyHistory(tokenYes: string): Promise<HistPoint[]> {
  const raw = (await getJson(
    `${CLOB}/prices-history?market=${encodeURIComponent(tokenYes)}&interval=1w&fidelity=120`,
  )) as { history?: { t: number; p: number }[] };
  const rows = raw.history ?? [];
  return rows
    .map((r) => ({ t: n(r.t) > 1e12 ? n(r.t) : n(r.t) * 1000, p: n(r.p) }))
    .filter((r) => r.p > 0 && r.p < 1);
}

async function polyDepth(tokenYes: string): Promise<{ bids: DepthLevel[]; asks: DepthLevel[] }> {
  const raw = (await getJson(
    `${CLOB}/book?token_id=${encodeURIComponent(tokenYes)}`,
  )) as Record<string, unknown>;
  const bidRows = (raw.bids ?? raw.buys ?? []) as { price?: string; size?: string }[];
  const askRows = (raw.asks ?? raw.sells ?? []) as { price?: string; size?: string }[];
  const bids = sortDepth(
    bidRows.map((l) => ({ price: n(l.price), size: n(l.size) })),
    "bid",
  );
  const asks = sortDepth(
    askRows.map((l) => ({ price: n(l.price), size: n(l.size) })),
    "ask",
  );
  return { bids, asks };
}

async function polyTrades(conditionId: string): Promise<StreetTrade[]> {
  const raw = await getJson(
    `${POLY_DATA}/trades?limit=16&market=${encodeURIComponent(conditionId)}`,
  );
  const rows = Array.isArray(raw) ? raw : [];
  const out: StreetTrade[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const price = n(r.price);
    const size = n(r.size);
    if (!(price > 0) || price >= 1 || !(size > 0)) continue;
    const outcome = String(r.outcome ?? "").toLowerCase();
    out.push({
      id: String(r.transactionHash ?? `${r.timestamp}:${size}`),
      at: atMs(r.timestamp),
      side: outcome.startsWith("no") ? "no" : "yes",
      price,
      size,
      name: String(r.title ?? "").slice(0, 80),
    });
  }
  return out;
}

async function kalshiDepth(ticker: string): Promise<{ bids: DepthLevel[]; asks: DepthLevel[] }> {
  const raw = (await getJson(
    `${KALSHI}/markets/${encodeURIComponent(ticker)}/orderbook?depth=8`,
  )) as { orderbook_fp?: { yes_dollars?: [string, string][] } };
  const yes = raw.orderbook_fp?.yes_dollars ?? [];
  const bids = sortDepth(
    yes.map(([price, size]) => ({ price: n(price), size: n(size) })),
    "bid",
  );
  const asks = bids
    .map((b) => ({ price: Math.max(0.01, 1 - b.price), size: b.size }))
    .sort((a, b) => a.price - b.price);
  return { bids, asks: asks.slice(0, 8) };
}

async function kalshiTrades(ticker: string): Promise<StreetTrade[]> {
  const raw = (await getJson(
    `${KALSHI}/markets/trades?limit=16&ticker=${encodeURIComponent(ticker)}`,
  )) as { trades?: Record<string, unknown>[] };
  const out: StreetTrade[] = [];
  for (const r of raw.trades ?? []) {
    const price = n(r.yes_price_dollars);
    const size = n(r.count_fp);
    if (!(price > 0) || price >= 1 || !(size > 0)) continue;
    const taker = String(r.taker_side ?? "yes").toLowerCase();
    out.push({
      id: String(r.trade_id ?? `${ticker}:${r.created_time}`),
      at: atMs(r.created_time),
      side: taker.startsWith("no") ? "no" : "yes",
      price,
      size,
      name: ticker,
    });
  }
  return out;
}

async function kalshiHistory(series: string, ticker: string): Promise<HistPoint[]> {
  if (!series) return [];
  const end = Math.floor(Date.now() / 1000);
  const start = end - 7 * 86400;
  const raw = (await getJson(
    `${KALSHI}/series/${encodeURIComponent(series)}/markets/${encodeURIComponent(ticker)}/candlesticks?start_ts=${start}&end_ts=${end}&period_interval=60`,
  )) as { candlesticks?: Record<string, unknown>[] };
  const out: HistPoint[] = [];
  for (const c of raw.candlesticks ?? []) {
    const price = c.price as Record<string, unknown> | undefined;
    const p = n(price?.close ?? price?.mean);
    const t = n(c.end_period_ts);
    if (!(p > 0) || p >= 1 || !(t > 0)) continue;
    out.push({ t: t > 1e12 ? t : t * 1000, p });
  }
  return out;
}

const inputSchema = z.object({
  venue: z.enum(["tessera", "prestocks", "polymarket", "kalshi", "manifold"]),
  venueKey: z.string().min(1).max(120),
  tokenYes: z.string().max(200).optional().default(""),
  conditionId: z.string().max(200).optional().default(""),
  seriesTicker: z.string().max(80).optional().default(""),
});

export const getStreetBook = createServerFn({ method: "POST" })
  .validator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<StreetBook> => {
    try {
      if (data.venue === "tessera" || data.venue === "prestocks") {
        return emptyBook;
      }
      if (data.venue === "polymarket") {
        let tokenYes = data.tokenYes;
        let conditionId = data.conditionId;
        if (!tokenYes || !conditionId) {
          const resolved = await withTimeout(
            resolvePoly(data.venueKey).catch(() => ({ tokenYes: "", conditionId: "" })),
            2800,
            { tokenYes: "", conditionId: "" },
          );
          tokenYes = tokenYes || resolved.tokenYes;
          conditionId = conditionId || resolved.conditionId;
        }
        const [history, depth, trades] = await Promise.all([
          tokenYes
            ? withTimeout(polyHistory(tokenYes).catch(() => [] as HistPoint[]), 3200, [])
            : Promise.resolve([]),
          tokenYes
            ? withTimeout(polyDepth(tokenYes).catch(() => ({ bids: [], asks: [] })), 3200, {
                bids: [] as DepthLevel[],
                asks: [] as DepthLevel[],
              })
            : Promise.resolve({ bids: [] as DepthLevel[], asks: [] as DepthLevel[] }),
          conditionId
            ? withTimeout(polyTrades(conditionId).catch(() => [] as StreetTrade[]), 3200, [])
            : Promise.resolve([]),
        ]);
        return {
          history,
          bids: depth.bids,
          asks: depth.asks,
          trades,
          bid: depth.bids[0]?.price ?? null,
          ask: depth.asks[0]?.price ?? null,
          last: trades[0]?.price ?? history.at(-1)?.p ?? null,
        };
      }
      if (data.venue === "kalshi") {
        const ticker = data.venueKey;
        const series = data.seriesTicker || seriesFromTicker(ticker);
        const [history, depth, trades] = await Promise.all([
          withTimeout(kalshiHistory(series, ticker).catch(() => [] as HistPoint[]), 3200, []),
          withTimeout(kalshiDepth(ticker).catch(() => ({ bids: [], asks: [] })), 3200, {
            bids: [] as DepthLevel[],
            asks: [] as DepthLevel[],
          }),
          withTimeout(kalshiTrades(ticker).catch(() => [] as StreetTrade[]), 3200, []),
        ]);
        const hist =
          history.length > 1
            ? history
            : trades
                .slice()
                .reverse()
                .map((t) => ({ t: t.at, p: t.price }));
        return {
          history: hist,
          bids: depth.bids,
          asks: depth.asks,
          trades,
          bid: depth.bids[0]?.price ?? null,
          ask: depth.asks[0]?.price ?? null,
          last: trades[0]?.price ?? hist.at(-1)?.p ?? null,
        };
      }
      return emptyBook;
    } catch {
      return emptyBook;
    }
  });

export type StreetRef = {
  venue: Venue;
  venueKey: string;
  tokenYes?: string;
  conditionId?: string;
  seriesTicker?: string;
};
