/** Live Kalshi open contracts. Public tape only. Senda does not hold the position. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {selectMarkets} from "@/lib/event-market-discovery.mjs";

const HOST = "https://external-api.kalshi.com/trade-api/v2/events";

export type KalshiRow = {
  ticker: string;
  event: string;
  seriesTicker?:string;
  title: string;
  yes: string;
  category: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  vol: number;
  reportedVolume?:number|null;
  close: string;
  closeFull?:string;
};

type Cache = { at: number; rows: KalshiRow[]; cursor: string; done: boolean };

let cache: Cache = { at: 0, rows: [], cursor: "", done: false };
let walking: Promise<void> | null = null;
let nextReadAt=0;

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return null;
  return n;
}

function flatten(events: Array<Record<string, unknown>>): KalshiRow[] {
  const out: KalshiRow[] = [];
  for (const e of events) {
    const title = String(e.title ?? "").trim();
    const event = String(e.event_ticker ?? "");
    const category = String(e.category ?? "Other");
    const markets = Array.isArray(e.markets) ? e.markets : [];
    for (const raw of markets) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Record<string, unknown>;
      const ticker = String(m.ticker ?? "");
      if (!ticker) continue;
      const yes = String(m.yes_sub_title ?? "").trim();
      const rawVolume=m.volume_24h_fp??m.volume_fp;
      const parsedVolume=rawVolume===null||rawVolume===undefined?null:Number(rawVolume);
      const reportedVolume=parsedVolume!==null&&Number.isFinite(parsedVolume)&&parsedVolume>=0?parsedVolume:null;
      const vol=reportedVolume??0;
      out.push({
        ticker,
        event,
        seriesTicker: String(e.series_ticker??"").slice(0,120),
        title: title || yes || ticker,
        yes: yes && yes !== title ? yes : "",
        category,
        bid: num(m.yes_bid_dollars),
        ask: num(m.yes_ask_dollars),
        last: num(m.last_price_dollars),
        vol,
        reportedVolume,
        close: String(m.close_time ?? "").slice(0, 10),
        closeFull: String(m.close_time ?? ""),
      });
    }
  }
  return out;
}

async function pullPage(cursor: string): Promise<{ rows: KalshiRow[]; cursor: string }> {
  const u = new URL(HOST);
  u.searchParams.set("limit", "200");
  u.searchParams.set("status", "open");
  u.searchParams.set("with_nested_markets", "true");
  if (cursor) u.searchParams.set("cursor", cursor);
  const res = await fetch(u, { headers: { accept: "application/json", "user-agent": "Senda/1.0" },redirect:"error",signal:AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Kalshi ${res.status}`);
  const j = (await res.json()) as { events?: Array<Record<string, unknown>>; cursor?: string };
  return { rows: flatten(j.events ?? []), cursor: String(j.cursor ?? "") };
}

function walk() {
  if (walking) return walking;
  walking = (async () => {
    let cursor = cache.cursor;
    const rows = cache.rows.slice();
    const seen = new Set(rows.map(r=>r.ticker));
    for (let i = 0; i < 30; i += 1) {
      try {
        const page = await pullPage(cursor);
        for(const row of page.rows){if(!seen.has(row.ticker)){seen.add(row.ticker);rows.push(row);}}
        cursor = page.cursor;
        cache = { at: Date.now(), rows, cursor, done: !cursor };
        if (!cursor) break;
      } catch {
        nextReadAt=Date.now()+20_000;
        cache = { at: Date.now(), rows, cursor, done: false };
        break;
      }
    }
  })().finally(() => {
    walking = null;
  });
  return walking;
}

function ensure() {
  if(Date.now()<nextReadAt)return;
  if ((cache.rows.length === 0 || !cache.done) && !walking) void walk();
  else if (cache.done && Date.now() - cache.at > 5 * 60_000 && !walking) {
    cache = { at: Date.now(), rows: [], cursor: "", done: false };
    void walk();
  }
}

export const kalshiPage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        category: z.string().max(48).optional(),
        lane: z.enum(["all","sports","economy","crypto","weather","world","technology","culture"]).optional(),
        watchlist:z.array(z.string().regex(/^[A-Z0-9][A-Z0-9._-]{2,119}$/)).max(70).optional(),
        sort: z.enum(["activity","closing","tight-spread"]).optional(),
        offset: z.number().int().min(0).max(250_000).optional(),
        limit: z.number().int().min(1).max(60).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    ensure();
    if (cache.rows.length < 40 && Date.now()>=nextReadAt) {
      await Promise.race([walk(), new Promise((resolve) => setTimeout(resolve, 8000))]);
    }
    const q = (data.q ?? "").trim().toLowerCase();
    const category = (data.category ?? "").trim();
    let rows = cache.rows;
    if (category) rows = rows.filter((r) => r.category === category);
    if(data.watchlist)rows=rows.filter(r=>data.watchlist!.includes(r.ticker));
    rows=selectMarkets(rows,{q,lane:data.lane??"all",sort:data.sort??"activity"});
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 40;
    const cats = new Map<string, number>();
    for (const r of cache.rows) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
    return {
      rows: rows.slice(offset, offset + limit),
      total: rows.length,
      loaded: cache.rows.length,
      done: cache.done,
      observedAt:cache.at?new Date(cache.at).toISOString():null,
      source:"Kalshi public events index",
      categories: [...cats.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n })),
    };
  });
