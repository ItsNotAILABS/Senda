/** Live event prices. This desk reads them. It does not take the stake. */

import { createServerFn } from "@tanstack/react-start";

export type EventQuote = {
  id: string;
  question: string;
  yes: number;
  volume: number;
  href: string;
};

type Gamma = {
  id?: string;
  question?: string;
  slug?: string;
  outcomePrices?: string;
  volume24hr?: number;
  closed?: boolean;
  events?: Array<{ slug?: string }>;
};

export const getEventBoard = createServerFn({ method: "GET" }).handler(async (): Promise<EventQuote[]> => {
  const url = "https://gamma-api.polymarket.com/markets?limit=12&active=true&closed=false&order=volume24hr&ascending=false";
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
  if (!res.ok) return [];
  const rows = (await res.json()) as Gamma[];
  const out: EventQuote[] = [];
  for (const row of rows) {
    if (row.closed || !row.question) continue;
    let yes = 0;
    try {
      const prices = JSON.parse(row.outcomePrices || "[]") as string[];
      yes = Number(prices[0]) || 0;
    } catch {
      yes = 0;
    }
    if (!(yes > 0) || yes >= 1) continue;
    const slug = row.events?.[0]?.slug || row.slug || "";
    out.push({
      id: String(row.id || slug || row.question),
      question: row.question,
      yes,
      volume: Number(row.volume24hr) || 0,
      href: slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com",
    });
    if (out.length >= 8) break;
  }
  return out;
});
