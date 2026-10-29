/** Verified Jupiter coins, one page at a time. The phone never holds the whole book. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LiveCoin } from "@/lib/coin-tape";

const PAGE = 24;
const VERIFIED = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const FALLBACK = [
  "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100",
];

let book: LiveCoin[] = [];
let at = 0;

function rowOf(raw: unknown): LiveCoin | null {
  const row = raw as {
    id?: string;
    symbol?: string;
    name?: string;
    icon?: string;
    usdPrice?: number;
    decimals?: number;
    stats24h?: { priceChange?: number };
  };
  const price = Number(row.usdPrice) || 0;
  if (!row.id || !row.symbol || !(price > 0)) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name || row.symbol,
    price,
    change: Number(row.stats24h?.priceChange) || 0,
    icon: row.icon || "",
    decimals: Number.isFinite(Number(row.decimals)) ? Number(row.decimals) : 6,
    liq: Number((raw as { liquidity?: number }).liquidity) || undefined,
  };
}

async function pull(url: string): Promise<LiveCoin[]> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`Coins ${res.status}`);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) return [];
  const out: LiveCoin[] = [];
  for (const raw of body) {
    const row = rowOf(raw);
    if (row) out.push(row);
  }
  return out;
}

async function catalog(): Promise<LiveCoin[]> {
  if (book.length && Date.now() - at < 60_000) return book;
  try {
    const rows = await pull(VERIFIED);
    if (rows.length) {
      book = rows;
      at = Date.now();
      return rows;
    }
  } catch {
    /* the three shorter lists still trade */
  }
  const merged = new Map<string, LiveCoin>();
  for (const url of FALLBACK) {
    const rows = await pull(url).catch(() => [] as LiveCoin[]);
    for (const row of rows) merged.set(row.id, row);
  }
  book = [...merged.values()];
  at = Date.now();
  return book;
}

export const coinPage = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ page: z.number().int().min(0).max(400), q: z.string().max(48).optional() }).parse(input))
  .handler(async ({ data }): Promise<{ rows: LiveCoin[]; total: number; page: number; pages: number }> => {
    const all = await catalog();
    const q = (data.q || "").trim().toLowerCase();
    const searched = q.length >= 2 ? await pull(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`).catch(() => [] as LiveCoin[]) : [];
    searched.sort((a, b) => (b.liq ?? 0) - (a.liq ?? 0));
    const seen = new Set(searched.map((row) => row.id));
    const matched = q
      ? [...searched, ...all.filter((row) => !seen.has(row.id) && `${row.symbol} ${row.name} ${row.id}`.toLowerCase().includes(q))]
      : all;
    const pages = Math.max(1, Math.ceil(matched.length / PAGE));
    const page = Math.min(data.page, pages - 1);
    return { rows: matched.slice(page * PAGE, page * PAGE + PAGE), total: matched.length, page, pages };
  });
