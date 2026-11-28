/** Live Polymarket events. Public tape. Senda does not hold the position. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GAMMA = "https://gamma-api.polymarket.com";

export type PolyRow = {
  id: string;
  eventId: string;
  title: string;
  question: string;
  slug: string;
  eventSlug: string;
  category: string;
  bid: number | null;
  ask: number | null;
  last: number | null;
  vol: number;
  liq: number;
  eventLiq: number;
  close: string;
  yesToken: string;
  change: number | null;
};

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return null;
  return n;
}

function dollars(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n;
}

function yesPrice(market: Record<string, unknown>): number | null {
  const bid = num(market.bestBid);
  if (bid != null) return bid;
  const raw = market.outcomePrices;
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw) as unknown[];
      return num(arr[0]);
    } catch {
      return null;
    }
  }
  return Array.isArray(raw) ? num(raw[0]) : null;
}

function categoryOf(event: Record<string, unknown>): string {
  const direct = String(event.category ?? "").trim();
  if (direct) return direct;
  const tags = event.tags;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (!tag || typeof tag !== "object") continue;
      const label = String((tag as { label?: unknown }).label ?? "").trim();
      if (label) return label;
    }
  }
  return "Markets";
}

function day(value: unknown): string {
  const raw = String(value ?? "");
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

function yesTokenOf(market: Record<string, unknown>): string {
  const raw = market.clobTokenIds;
  let list: unknown[] = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      list = Array.isArray(parsed) ? parsed : [];
    } catch {
      list = [];
    }
  } else if (Array.isArray(raw)) list = raw;
  const id = String(list[0] ?? "");
  return /^\d{10,120}$/.test(id) ? id : "";
}

function changeOf(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 1000) / 1000;
}

function flatten(events: Array<Record<string, unknown>>): PolyRow[] {
  const out: PolyRow[] = [];
  for (const e of events) {
    const title = String(e.title ?? "").trim();
    const eventSlug = String(e.slug ?? "");
    const eventId = String(e.id ?? eventSlug);
    const category = categoryOf(e);
    const eventLiq = dollars(e.liquidity ?? e.liquidityClob);
    const eventClose = day(e.endDate);
    const markets = Array.isArray(e.markets) ? e.markets : [];
    for (const raw of markets) {
      if (!raw || typeof raw !== "object") continue;
      const m = raw as Record<string, unknown>;
      const id = String(m.id ?? m.conditionId ?? "");
      if (!id) continue;
      const question = String(m.question ?? m.groupItemTitle ?? title).trim();
      const last = yesPrice(m);
      out.push({
        id,
        eventId,
        title: title || question,
        question: question && question !== title ? question : "",
        slug: String(m.slug ?? eventSlug),
        eventSlug,
        category,
        bid: num(m.bestBid) ?? last,
        ask: num(m.bestAsk),
        last,
        vol: dollars(m.volume24hr ?? e.volume24hr),
        liq: dollars(m.liquidityNum ?? m.liquidity) || eventLiq,
        eventLiq,
        close: day(m.endDate) || eventClose,
        yesToken: yesTokenOf(m),
        change: changeOf(m.oneDayPriceChange),
      });
    }
  }
  return out;
}

async function events(q: string, offset: number): Promise<{ rows: PolyRow[]; count: number }> {
  const url = q
    ? `${GAMMA}/public-search?q=${encodeURIComponent(q)}`
    : `${GAMMA}/events?limit=40&offset=${offset}&active=true&closed=false&order=volume24hr&ascending=false`;
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
  if (!res.ok) throw new Error(`Polymarket ${res.status}`);
  const json = (await res.json()) as unknown;
  const list = Array.isArray(json)
    ? json
    : json && typeof json === "object"
      ? ((json as { events?: unknown[] }).events ?? [])
      : [];
  const raw = list.filter((row): row is Record<string, unknown> => !!row && typeof row === "object");
  return { rows: flatten(raw), count: raw.length };
}

export const polyPage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        offset: z.number().int().min(0).max(20_000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const q = (data.q ?? "").trim();
    const offset = q ? 0 : (data.offset ?? 0);
    const page = await events(q, offset);
    return { rows: page.rows, offset, more: !q && page.count >= 40 };
  });
