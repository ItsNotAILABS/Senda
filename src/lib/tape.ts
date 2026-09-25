/**
 * Live street tape — public Polymarket + Kalshi prints, plus this pit's drops.
 * Read-only. No orders.
 */

import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import {
  bookId,
  shortTapeName,
  venueLabel,
  type Venue,
} from "@/lib/feeds";
import { allKnownTables, getTable } from "@/lib/markets";
import type { Side } from "@/lib/lmsr";

const POLY_TRADES = "https://data-api.polymarket.com/trades?limit=40";
const KALSHI_TRADES =
  "https://api.elections.kalshi.com/trade-api/v2/markets/trades?limit=40";
const UA = "Senda/1.0 (read-only tape; no custody)";

export type TapeSource = "street" | "pit" | "house";

export type TapePrint = {
  id: string;
  at: number;
  venue: Venue | "pit";
  marketId: string;
  name: string;
  question: string;
  side: Side;
  price: number;
  size: number;
  notional: number;
  source: TapeSource;
};

const CACHE_MS = 4_000;
let tapeCache: { at: number; rows: TapePrint[] } | null = null;

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function atMs(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v > 1e12 ? v : v * 1000;
  }
  if (typeof v === "string") {
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return ms;
    const asN = Number(v);
    if (Number.isFinite(asN)) return asN > 1e12 ? asN : asN * 1000;
  }
  if (v instanceof Date) return v.getTime();
  return Date.now();
}

async function getJson(url: string, ms = 2800): Promise<unknown> {
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
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function polyPrints(raw: unknown): TapePrint[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: TapePrint[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const title = String(r.title ?? r.slug ?? "");
    if (!title) continue;
    const price = n(r.price);
    if (!(price > 0) || price >= 1) continue;
    const size = n(r.size);
    if (!(size > 0)) continue;
    const outcome = String(r.outcome ?? "").toLowerCase();
    const side: Side = outcome.startsWith("no") ? "no" : "yes";
    const slug = String(r.slug ?? r.eventSlug ?? title);
    const id = `poly:${r.transactionHash ?? r.timestamp ?? slug}:${r.proxyWallet ?? ""}:${size}`;
    out.push({
      id,
      at: atMs(r.timestamp),
      venue: "polymarket",
      marketId: bookId("polymarket", String(r.asset ?? r.conditionId ?? slug)),
      name: shortTapeName(title),
      question: title,
      side,
      price,
      size,
      notional: size,
      source: "street",
    });
  }
  return out;
}

function kalshiPrints(raw: unknown): TapePrint[] {
  const rows =
    raw && typeof raw === "object"
      ? ((raw as { trades?: unknown[] }).trades ?? [])
      : [];
  const out: TapePrint[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const ticker = String(r.ticker ?? "");
    if (!ticker || /MVE|SHARD/i.test(ticker)) continue;
    const price = n(r.yes_price_dollars ?? r.yes_price);
    if (!(price > 0) || price >= 1) continue;
    const size = n(r.count_fp ?? r.count);
    if (!(size > 0)) continue;
    const taker = String(r.taker_side ?? r.taker_outcome_side ?? "yes").toLowerCase();
    const side: Side = taker.startsWith("no") ? "no" : "yes";
    const name = shortTapeName(ticker.replace(/^KX/, "").split("-")[0] || ticker);
    out.push({
      id: `kx:${String(r.trade_id ?? `${ticker}:${r.created_time}`)}`,
      at: atMs(r.created_time),
      venue: "kalshi",
      marketId: bookId("kalshi", ticker),
      name,
      question: ticker,
      side,
      price,
      size,
      notional: size,
      source: "street",
    });
  }
  return out;
}

async function streetTape(): Promise<TapePrint[]> {
  const [poly, kalshi] = await Promise.all([
    withTimeout(getJson(POLY_TRADES).then(polyPrints).catch(() => [] as TapePrint[]), 2600, []),
    withTimeout(getJson(KALSHI_TRADES).then(kalshiPrints).catch(() => [] as TapePrint[]), 2600, []),
  ]);
  return [...poly, ...kalshi];
}

function parsePitRef(ref: string): { source: TapeSource; marketId: string; side: Side } | null {
  const bits = ref.split(":");
  if (bits[0] === "house" && bits[1]) {
    return { source: "house", marketId: bits[1], side: "yes" };
  }
  if (bits[0] === "trade" && bits[1] && (bits[2] === "yes" || bits[2] === "no")) {
    return { source: "pit", marketId: bits[1], side: bits[2] };
  }
  return null;
}

async function pitTape(): Promise<TapePrint[]> {
  try {
    const sql = await getSql();
    const rows = await sql<{
      ref: string;
      dr: string | number;
      created_at: string | Date;
    }>`
      select ref, dr, created_at
      from ledger_entries
      where ref like 'trade:%'
      order by id desc
      limit 24
    `;
    const seen = new Set<string>();
    const out: TapePrint[] = [];
    for (const row of rows) {
      if (seen.has(row.ref)) continue;
      seen.add(row.ref);
      const parsed = parsePitRef(row.ref);
      if (!parsed) continue;
      const table = getTable(parsed.marketId) ?? allKnownTables().find((t) => t.id === parsed.marketId);
      const size = n(row.dr);
      if (!(size > 0)) continue;
      out.push({
        id: row.ref,
        at: atMs(row.created_at),
        venue: table?.venue ?? "pit",
        marketId: parsed.marketId,
        name: table?.name ?? parsed.marketId.slice(0, 10),
        question: table?.question ?? "",
        side: parsed.side,
        price: table?.streetYes ?? 0.5,
        size,
        notional: size,
        source: parsed.source,
      });
    }
    return out;
  } catch {
    return [];
  }
}

function isNoise(p: TapePrint): boolean {
  if (p.source !== "street") return false;
  const blob = `${p.name} ${p.question}`.toUpperCase();
  if (/15M|5M\b|1H\b|KXHIGH|EXACT SCORE/.test(blob) && p.notional < 250) return true;
  if (p.price < 0.04 || p.price > 0.96) return true;
  if (p.notional < 8) return true;
  return false;
}

function uniquify(rows: TapePrint[]): TapePrint[] {
  const seen = new Set<string>();
  const out: TapePrint[] = [];
  for (const p of rows) {
    if (isNoise(p)) continue;
    const k = `${p.source}:${p.venue}:${p.name}:${p.side}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
    if (out.length >= 28) break;
  }
  return out;
}

function mergeTape(street: TapePrint[], pit: TapePrint[]): TapePrint[] {
  const seen = new Set<string>();
  const all = [...pit, ...street].sort((a, b) => b.at - a.at);
  const merged: TapePrint[] = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    merged.push(p);
  }
  return uniquify(merged);
}

export async function fetchTape(): Promise<TapePrint[]> {
  if (tapeCache && Date.now() - tapeCache.at < CACHE_MS) return tapeCache.rows;
  const [street, pit] = await Promise.all([streetTape(), pitTape()]);
  const rows = mergeTape(street, pit);
  tapeCache = { at: Date.now(), rows };
  return rows;
}

export const getTape = createServerFn({ method: "GET" }).handler(
  async (): Promise<TapePrint[]> => fetchTape(),
);

export function formatAgo(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

export function formatPrintSize(p: TapePrint): string {
  if (p.source !== "street") return `${Math.round(p.size)}`;
  if (p.venue === "kalshi") {
    if (p.size >= 1000) return `${(p.size / 1000).toFixed(1)}k`;
    return `${Math.round(p.size)}`;
  }
  if (p.size >= 1_000_000) return `$${(p.size / 1_000_000).toFixed(1)}M`;
  if (p.size >= 1000) return `$${(p.size / 1000).toFixed(1)}k`;
  return `$${Math.round(p.size)}`;
}

export function sourceLabel(p: TapePrint): string {
  if (p.source === "house") return "House";
  if (p.source === "pit") return "Pit";
  if (p.venue === "pit") return "Pit";
  return venueLabel(p.venue);
}

export function localPrint(partial: {
  marketId: string;
  name: string;
  question?: string;
  venue: Venue;
  side: Side;
  price: number;
  size: number;
}): TapePrint {
  return {
    id: `pit:${partial.marketId}:${partial.side}:${Date.now()}`,
    at: Date.now(),
    venue: partial.venue,
    marketId: partial.marketId,
    name: partial.name,
    question: partial.question ?? "",
    side: partial.side,
    price: partial.price,
    size: partial.size,
    notional: partial.size,
    source: "pit",
  };
}
