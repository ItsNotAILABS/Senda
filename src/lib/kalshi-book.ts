/** Live Kalshi open contracts. Public tape only. Senda does not hold the position. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EVENTS = "https://api.elections.kalshi.com/trade-api/v2/events";
const MARKETS = "https://api.elections.kalshi.com/trade-api/v2/markets";

export type KalshiRow = {
  ticker: string;
  event: string;
  title: string;
  yes: string;
  category: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  noAsk: number | null;
  vol: number;
  close: string;
};

type EventMeta = { title: string; category: string };
type Cache = {
  at: number;
  rows: KalshiRow[];
  seen: Set<string>;
  meta: Map<string, EventMeta>;
  marketCursor: string;
  eventCursor: string;
  marketsDone: boolean;
  eventsDone: boolean;
  done: boolean;
};

let cache: Cache = empty();
let walking: Promise<void> | null = null;

function empty(): Cache {
  return {
    at: 0,
    rows: [],
    seen: new Set(),
    meta: new Map(),
    marketCursor: "",
    eventCursor: "",
    marketsDone: false,
    eventsDone: false,
    done: false,
  };
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return null;
  return n;
}

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
  if (!res.ok) throw new Error(`Kalshi ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

async function pullEvents(cursor: string): Promise<{ cursor: string }> {
  const u = new URL(EVENTS);
  u.searchParams.set("limit", "200");
  u.searchParams.set("status", "open");
  u.searchParams.set("with_nested_markets", "false");
  if (cursor) u.searchParams.set("cursor", cursor);
  const j = await getJson(u.toString());
  const events = Array.isArray(j.events) ? j.events : [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const ticker = String(e.event_ticker ?? "");
    if (!ticker) continue;
    cache.meta.set(ticker, {
      title: String(e.title ?? "").trim(),
      category: String(e.category ?? "Markets"),
    });
  }
  return { cursor: String(j.cursor ?? "") };
}

function fromMarket(raw: Record<string, unknown>): KalshiRow | null {
  const ticker = String(raw.ticker ?? "");
  if (!ticker || raw.mve_collection_ticker) return null;
  const status = String(raw.status ?? "active");
  if (status !== "active" && status !== "open") return null;
  const event = String(raw.event_ticker ?? ticker);
  const info = cache.meta.get(event);
  const contract = String(raw.yes_sub_title ?? "").trim();
  const marketTitle = String(raw.title ?? "").trim();
  const eventTitle = info?.title || "";
  const title = eventTitle || marketTitle || contract || ticker;
  const yes = contract && contract !== title ? contract : marketTitle && marketTitle !== title ? marketTitle : "";
  const vol = Number(raw.volume_24h_fp ?? raw.volume_fp ?? 0) || 0;
  return {
    ticker,
    event,
    title,
    yes,
    category: info?.category || "Markets",
    bid: num(raw.yes_bid_dollars),
    ask: num(raw.yes_ask_dollars),
    last: num(raw.last_price_dollars),
    noAsk: num(raw.no_ask_dollars),
    vol,
    close: String(raw.close_time ?? "").slice(0, 10),
  };
}

async function pullMarkets(cursor: string): Promise<{ rows: KalshiRow[]; cursor: string }> {
  const u = new URL(MARKETS);
  u.searchParams.set("limit", "200");
  u.searchParams.set("status", "open");
  u.searchParams.set("mve_filter", "exclude");
  if (cursor) u.searchParams.set("cursor", cursor);
  const j = await getJson(u.toString());
  const markets = Array.isArray(j.markets) ? j.markets : [];
  const rows: KalshiRow[] = [];
  for (const raw of markets) {
    if (!raw || typeof raw !== "object") continue;
    const row = fromMarket(raw as Record<string, unknown>);
    if (!row || cache.seen.has(row.ticker)) continue;
    cache.seen.add(row.ticker);
    rows.push(row);
  }
  return { rows, cursor: String(j.cursor ?? "") };
}

function walk() {
  if (walking) return walking;
  walking = (async () => {
    for (let i = 0; i < 8 && !cache.eventsDone; i += 1) {
      try {
        const page = await pullEvents(cache.eventCursor);
        cache.eventCursor = page.cursor;
        cache.eventsDone = !page.cursor;
        cache.at = Date.now();
      } catch {
        break;
      }
    }
    const rows = cache.rows;
    for (let i = 0; i < 6 && !cache.marketsDone; i += 1) {
      try {
        const page = await pullMarkets(cache.marketCursor);
        rows.push(...page.rows);
        cache.marketCursor = page.cursor;
        cache.marketsDone = !page.cursor;
        cache.rows = rows;
        cache.at = Date.now();
        cache.done = cache.marketsDone && cache.eventsDone;
      } catch {
        cache.at = Date.now();
        break;
      }
    }
    cache.done = cache.marketsDone && cache.eventsDone;
  })().finally(() => {
    walking = null;
  });
  return walking;
}

function ensure() {
  if ((!cache.done || cache.rows.length === 0) && !walking) void walk();
  else if (cache.done && Date.now() - cache.at > 5 * 60_000 && !walking) {
    cache = empty();
    void walk();
  }
}

function decorate(row: KalshiRow): KalshiRow {
  const info = cache.meta.get(row.event);
  if (!info) return row;
  const contract = row.yes || (row.title !== info.title ? row.title : "");
  return {
    ...row,
    title: info.title || row.title,
    yes: contract && contract !== info.title ? contract : "",
    category: info.category || row.category,
  };
}

export const kalshiPage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        category: z.string().max(48).optional(),
        offset: z.number().int().min(0).max(250_000).optional(),
        limit: z.number().int().min(1).max(240).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    ensure();
    if (cache.rows.length < 80) {
      await Promise.race([walk(), new Promise((resolve) => setTimeout(resolve, 8000))]);
    }
    const q = (data.q ?? "").trim().toLowerCase();
    const category = (data.category ?? "").trim();
    let rows = cache.rows.map(decorate);
    if (category) rows = rows.filter((r) => r.category === category);
    if (q) rows = rows.filter((r) => `${r.ticker} ${r.title} ${r.yes} ${r.event}`.toLowerCase().includes(q));
    else rows = rows.slice().sort((a, b) => b.vol - a.vol);
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 80;
    const cats = new Map<string, number>();
    for (const r of cache.rows) {
      const row = decorate(r);
      cats.set(row.category, (cats.get(row.category) ?? 0) + 1);
    }
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      loaded: cache.rows.length,
      done: cache.done,
      categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    };
  });
