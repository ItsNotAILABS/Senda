/** Kalshi markets a US person can hold. This desk reads them. It does not take the stake. */

import { createServerFn } from "@tanstack/react-start";

export type UsMarket = {
  ticker: string;
  title: string;
  yes: number;
  bid: number;
  ask: number;
  volume: number;
  href: string;
};

const SERIES = ["KXBTCD", "KXETHD", "KXNFLGAME", "KXHIGHNY"] as const;

type Raw = {
  ticker?: string;
  event_ticker?: string;
  title?: string;
  yes_sub_title?: string;
  last_price_dollars?: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  volume_24h_fp?: string;
};

function num(v: string | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const loadUsMarkets = createServerFn({ method: "GET" }).handler(async (): Promise<UsMarket[]> => {
  const batches = await Promise.all(
    SERIES.map(async (series) => {
      try {
        const res = await fetch(
          `https://api.elections.kalshi.com/trade-api/v2/markets?status=open&limit=30&series_ticker=${series}`,
          { headers: { accept: "application/json" } },
        );
        if (!res.ok) return [] as Raw[];
        const body = (await res.json()) as { markets?: Raw[] };
        return body.markets ?? [];
      } catch {
        return [] as Raw[];
      }
    }),
  );
  const rows: UsMarket[] = [];
  const seen = new Set<string>();
  for (const market of batches.flat()) {
    const ticker = market.ticker || "";
    if (!ticker || seen.has(ticker) || ticker.includes("MVE")) continue;
    const yes = num(market.last_price_dollars);
    const bid = num(market.yes_bid_dollars);
    const ask = num(market.yes_ask_dollars);
    const volume = num(market.volume_24h_fp);
    if (!(yes > 0 || (bid > 0 && ask > 0)) || volume <= 0) continue;
    seen.add(ticker);
    const event = (market.event_ticker || ticker).toLowerCase();
    rows.push({
      ticker,
      title: market.yes_sub_title ? `${market.title || ticker} · ${market.yes_sub_title}` : market.title || ticker,
      yes,
      bid,
      ask,
      volume,
      href: `https://kalshi.com/markets/${event}`,
    });
  }
  return rows.sort((a, b) => b.volume - a.volume).slice(0, 12);
});
