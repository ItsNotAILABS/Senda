/** Live event prices. This desk reads them. It does not take the stake. */

import { createServerFn } from "@tanstack/react-start";

export type EventQuote = {
  id: string;
  question: string;
  yes: number;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  change: number | null;
  volume: number;
  end: string;
  href: string;
};

type Gamma = {
  id?: string;
  question?: string;
  slug?: string;
  outcomePrices?: string;
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
  oneDayPriceChange?: number;
  volume24hr?: number;
  endDate?: string;
  closed?: boolean;
  events?: Array<{ slug?: string }>;
};

export type EventBoard = {
  source: "https://gamma-api.polymarket.com";
  auth: "public";
  checkedAt: string;
  dropped: number;
  rows: EventQuote[];
};

export function quoteAgrees(listed: number, detail: number): boolean {
  return Number.isFinite(listed) && Number.isFinite(detail) && Math.abs(listed - detail) < 0.011;
}

function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function yesOf(row: Gamma): number {
  try {
    const prices = JSON.parse(row.outcomePrices || "[]") as string[];
    return Number(prices[0]) || 0;
  } catch {
    return 0;
  }
}

const HEADERS = { accept: "application/json", "user-agent": "Senda/1.0" };

async function confirmRow(row: EventQuote): Promise<boolean> {
  if (!/^\d+$/.test(row.id)) return false;
  if (row.bid != null && row.ask != null && row.bid > row.ask + 0.001) return false;
  try {
    const res = await fetch(`https://gamma-api.polymarket.com/markets/${row.id}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const detail = (await res.json()) as Gamma;
    return detail.question === row.question && quoteAgrees(row.yes, yesOf(detail));
  } catch {
    return false;
  }
}

export const getEventBoard = createServerFn({ method: "GET" }).handler(async (): Promise<EventBoard> => {
  const empty: EventBoard = {
    source: "https://gamma-api.polymarket.com",
    auth: "public",
    checkedAt: new Date().toISOString(),
    dropped: 0,
    rows: [],
  };
  const url = "https://gamma-api.polymarket.com/markets?limit=12&active=true&closed=false&order=volume24hr&ascending=false";
  let res: Response;
  try {
    res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(8000) });
  } catch {
    return empty;
  }
  if (!res.ok) return empty;
  const rows = (await res.json()) as Gamma[];
  const listed: EventQuote[] = [];
  for (const row of rows) {
    if (row.closed || !row.question || !row.id) continue;
    const yes = yesOf(row);
    if (!(yes > 0) || yes >= 1) continue;
    const slug = row.events?.[0]?.slug || row.slug || "";
    const bid = num(row.bestBid);
    const ask = num(row.bestAsk);
    const spread = num(row.spread);
    const change = num(row.oneDayPriceChange);
    listed.push({
      id: String(row.id),
      question: row.question,
      yes,
      bid: bid != null && bid > 0 && bid < 1 ? bid : null,
      ask: ask != null && ask > 0 && ask < 1 ? ask : null,
      spread: spread != null && spread >= 0 && spread < 1 ? spread : null,
      change,
      volume: Number(row.volume24hr) || 0,
      end: typeof row.endDate === "string" ? row.endDate.slice(0, 10) : "",
      href: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com",
    });
    if (listed.length >= 8) break;
  }
  const checks = await Promise.all(listed.map((row) => confirmRow(row)));
  const kept = listed.filter((_, index) => checks[index]);
  return {
    source: "https://gamma-api.polymarket.com",
    auth: "public",
    checkedAt: new Date().toISOString(),
    dropped: listed.length - kept.length,
    rows: kept,
  };
});

