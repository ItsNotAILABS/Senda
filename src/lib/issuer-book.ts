/** One registration list. A mint is here because Jupiter returned it. Nothing is typed in as a price. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const LIQUID_USD = 25_000;

export const PLACES = [
  { id: "backpack", venue: "Backpack Securities", test: (name: string) => name.includes("Backpack Securities") },
  { id: "xstock", venue: "xStock", test: (name: string, _s: string, tags: string[]) => tags.includes("xstocks") || name.includes("xStock") },
  { id: "ondo", venue: "Ondo", test: (name: string) => name.includes("Ondo") },
  { id: "prestock", venue: "PreStocks", test: (name: string) => /pre-?ipo|prestock/i.test(name) },
  { id: "wisdomtree", venue: "WisdomTree", test: (name: string) => name.includes("WisdomTree") },
  { id: "securitize", venue: "Securitize", test: (name: string) => name.includes("Securitize") && !name.includes("Corp") },
  { id: "franklin", venue: "Franklin", test: (name: string) => /franklin templeton/i.test(name) || name.includes("BENJI") },
  { id: "blackrock", venue: "BlackRock", test: (name: string, symbol: string) => name.includes("BlackRock") || symbol === "BUIDL" },
  { id: "swarm", venue: "Swarm", test: (name: string) => /swarm markets/i.test(name) },
  { id: "superstate", venue: "Superstate", test: (name: string, symbol: string) => /superstate/i.test(name) || symbol === "USTB" || symbol === "USCC" },
  { id: "maple", venue: "Maple", test: (name: string) => name.includes("Maple") },
  { id: "mountain", venue: "Mountain", test: (name: string) => name.includes("Mountain") },
  { id: "matrixdock", venue: "Matrixdock", test: (name: string) => /matrixdock/i.test(name) },
  { id: "centrifuge", venue: "Centrifuge", test: (name: string) => name.includes("Centrifuge") },
  { id: "openeden", venue: "OpenEden", test: (name: string) => /openeden/i.test(name) },
] as const;

const FEEDS = [
  "https://lite-api.jup.ag/tokens/v2/tag?query=verified",
  "https://lite-api.jup.ag/tokens/v2/tag?query=lst",
  "https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptrending/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100",
  "https://lite-api.jup.ag/tokens/v2/toptraded/7d?limit=100",
];

export type Issued = {
  mint: string;
  symbol: string;
  name: string;
  venue: string;
  family: "security" | "coin" | "stake";
  price: number | null;
  change: number | null;
  liquidity: number;
  holders: number;
  liquid: boolean;
};

type Raw = {
  id?: string;
  symbol?: string;
  name?: string;
  usdPrice?: number;
  liquidity?: number;
  holderCount?: number;
  tags?: string[];
  stats24h?: { priceChange?: number };
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function placeOf(name: string, symbol: string, tags: string[]): { venue: string; family: Issued["family"] } {
  for (const place of PLACES) {
    if (place.test(name, symbol, tags)) return { venue: place.venue, family: "security" };
  }
  if (tags.includes("lst")) return { venue: "Stake", family: "stake" };
  return { venue: "Jupiter", family: "coin" };
}

async function feed(url: string): Promise<Raw[]> {
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? (body as Raw[]) : [];
  } catch {
    return [];
  }
}

/** Every token those feeds return. A later feed does not erase an earlier mint. */
export async function loadIssued(): Promise<Issued[]> {
  const lists = await Promise.all(FEEDS.map(feed));
  const map = new Map<string, Issued>();
  for (const rows of lists) {
    for (const raw of rows) {
      if (!raw.id || raw.id.length < 32 || !raw.symbol || map.has(raw.id)) continue;
      const name = raw.name || raw.symbol;
      const tags = raw.tags ?? [];
      const place = placeOf(name, raw.symbol, tags);
      const liquidity = num(raw.liquidity);
      map.set(raw.id, {
        mint: raw.id,
        symbol: raw.symbol,
        name,
        venue: place.venue,
        family: place.family,
        price: num(raw.usdPrice) > 0 ? num(raw.usdPrice) : null,
        change: raw.stats24h?.priceChange == null ? null : num(raw.stats24h.priceChange),
        liquidity,
        holders: num(raw.holderCount),
        liquid: liquidity >= LIQUID_USD,
      });
    }
  }
  return [...map.values()];
}

export const screenIssued = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(40).optional(),
        family: z.enum(["all", "security", "coin", "stake"]).optional(),
        liquid: z.boolean().optional(),
        limit: z.number().int().min(1).max(80).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const rows = await loadIssued();
    const q = (data.q ?? "").trim().toLowerCase();
    const family = data.family ?? "all";
    const matched = rows.filter((row) => {
      if (data.liquid && !row.liquid) return false;
      if (family !== "all" && row.family !== family) return false;
      if (!q) return true;
      return `${row.symbol} ${row.name} ${row.venue}`.toLowerCase().includes(q);
    });
    matched.sort((a, b) => b.liquidity - a.liquidity);
    const venues: Record<string, number> = {};
    for (const row of rows) if (row.family === "security") venues[row.venue] = (venues[row.venue] ?? 0) + 1;
    return {
      total: rows.length,
      liquid: rows.filter((row) => row.liquid).length,
      securities: rows.filter((row) => row.family === "security").length,
      venues,
      matched: matched.length,
      rows: matched.slice(0, data.limit ?? 40),
    };
  });

