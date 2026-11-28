/** Public resting size. Polymarket’s CLOB and Kalshi’s order book. Senda does not place either. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type Level = { price: number; size: number };

const cache = new Map<string, { at: number; bids: Level[]; asks: Level[] }>();

function keep(price: number, size: number): Level | null {
  if (!Number.isFinite(price) || !Number.isFinite(size)) return null;
  if (!(price > 0) || price >= 1 || !(size > 0)) return null;
  return { price: Math.round(price * 10000) / 10000, size };
}

function pairs(raw: unknown, cents: boolean): Level[] {
  if (!Array.isArray(raw)) return [];
  const out: Level[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 2) continue;
    const p = Number(row[0]);
    const level = keep(cents ? p / 100 : p, Number(row[1]));
    if (level) out.push(level);
  }
  return out;
}

function objects(raw: unknown): Level[] {
  if (!Array.isArray(raw)) return [];
  const out: Level[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const level = keep(Number((row as { price?: unknown }).price), Number((row as { size?: unknown }).size));
    if (level) out.push(level);
  }
  return out;
}

function book(bids: Level[], asks: Level[]): { bids: Level[]; asks: Level[] } {
  return {
    bids: bids.slice().sort((a, b) => b.price - a.price).slice(0, 6),
    asks: asks.slice().sort((a, b) => a.price - b.price).slice(0, 6),
  };
}

/** Yes bids stay bids. A no bid at P is a yes ask at 1−P. */
export function parseKalshiBook(json: unknown): { bids: Level[]; asks: Level[] } {
  const root = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const fp = (root.orderbook_fp ?? root.orderbookFp) as Record<string, unknown> | undefined;
  if (fp && typeof fp === "object") {
    const yes = pairs(fp.yes_dollars ?? fp.yesDollars, false);
    const no = pairs(fp.no_dollars ?? fp.noDollars, false);
    return book(yes, no.map((row) => ({ price: Math.round((1 - row.price) * 10000) / 10000, size: row.size })).filter((row) => row.price > 0 && row.price < 1));
  }
  const ob = root.orderbook as Record<string, unknown> | undefined;
  if (ob && typeof ob === "object") {
    const yes = pairs(ob.yes, true);
    const no = pairs(ob.no, true);
    return book(yes, no.map((row) => ({ price: Math.round((1 - row.price) * 10000) / 10000, size: row.size })).filter((row) => row.price > 0 && row.price < 1));
  }
  return { bids: [], asks: [] };
}

export function parsePolyBook(json: unknown): { bids: Level[]; asks: Level[] } {
  const root = json && typeof json === "object" ? (json as { bids?: unknown; asks?: unknown }) : {};
  return book(objects(root.bids), objects(root.asks));
}

const input = z
  .object({
    venue: z.enum(["poly", "kalshi"]),
    id: z.string().min(2).max(120),
  })
  .refine((row) => (row.venue === "poly" ? /^\d{10,120}$/.test(row.id) : /^[A-Za-z0-9._-]{2,80}$/.test(row.id)), {
    message: "That book id is not a public market.",
  });

export const marketDepth = createServerFn({ method: "POST" })
  .validator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const key = `${data.venue}:${data.id}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 12_000) return { ok: true as const, bids: hit.bids, asks: hit.asks, note: hit.bids.length || hit.asks.length ? "" : "No resting size." };
    try {
      const url =
        data.venue === "poly"
          ? `https://clob.polymarket.com/book?token_id=${data.id}`
          : `https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(data.id)}/orderbook`;
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "Senda/1.0" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) return { ok: false as const, bids: [] as Level[], asks: [] as Level[], note: "That book is busy. The price on the card still stands." };
      if (!res.ok) return { ok: false as const, bids: [] as Level[], asks: [] as Level[], note: "The book did not answer." };
      const parsed = data.venue === "poly" ? parsePolyBook(await res.json()) : parseKalshiBook(await res.json());
      if (cache.size > 40) cache.clear();
      cache.set(key, { at: Date.now(), ...parsed });
      const note = parsed.bids.length || parsed.asks.length ? "" : "No resting size on that contract.";
      return { ok: true as const, ...parsed, note };
    } catch {
      return { ok: false as const, bids: [] as Level[], asks: [] as Level[], note: "The book did not answer." };
    }
  });
