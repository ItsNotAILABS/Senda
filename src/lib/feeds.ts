/**
 * Read-only street books. PreStocks lead. Polymarket, Kalshi, and Manifold stay as a second tape.
 * A live PreStock buy is a Jupiter route the wallet signs. It is not a paper chip.
 */

import {
  fetchHouse,
  HOUSE_FALLBACK,
  jupiterSwap,
  logoFor,
  type HouseListing,
  type HouseVenue,
} from "@/lib/sol-house";

export type Venue = "tessera" | "prestocks" | "polymarket" | "kalshi" | "manifold";

export type LiveMarket = {
  id: string;
  venue: Venue;
  venueKey: string;
  name: string;
  question: string;
  resolveBy: string;
  streetYes: number;
  volume: number;
  url: string;
  blurb: string;
  bidYes: number | null;
  askYes: number | null;
  lastYes: number | null;
  liquidity: number;
  volume24h: number;
  openInterest: number;
  change24h: number | null;
  tokenYes: string;
  conditionId: string;
  seriesTicker: string;
  description: string;
  rules: string;
  spread: number | null;
  lastUsd: number;
  markUsd: number;
  premium: number | null;
  holders: number;
  valuation: number;
  swapUrl: string;
  mint: string;
  sector: string;
};

export type VenuePlugin = {
  id: Venue;
  label: string;
  tagline: string;
  how: string;
  hot: (limit: number) => Promise<LiveMarket[]>;
  search: (query: string, limit: number) => Promise<LiveMarket[]>;
};

const POLY_GAMMA = "https://gamma-api.polymarket.com";
const MANIFOLD = "https://api.manifold.markets/v0";
const KALSHI = "https://api.elections.kalshi.com/trade-api/v2";
const UA = "Senda/1.0 (read-only tape; no custody)";

const CACHE_MS = 45_000;
const SEARCH_CACHE_MS = 30_000;

let hotCache: { at: number; tables: LiveMarket[] } | null = null;
const searchCache = new Map<string, { at: number; tables: LiveMarket[] }>();

export const VENUE_ORDER: Venue[] = ["prestocks", "tessera", "polymarket", "kalshi"];

export function isHouse(v: string): v is HouseVenue {
  return v === "tessera" || v === "prestocks";
}

export function venueLabel(v: Venue): string {
  if (v === "tessera") return "Tessera";
  if (v === "prestocks") return "PreStocks";
  if (v === "polymarket") return "Polymarket";
  if (v === "manifold") return "Manifold";
  return "Kalshi";
}

export function isVenue(v: string): v is Venue {
  return (
    v === "tessera" ||
    v === "prestocks" ||
    v === "polymarket" ||
    v === "kalshi" ||
    v === "manifold"
  );
}

export function bookId(venue: Venue, key: string): string {
  const prefix =
    venue === "tessera"
      ? "ts"
      : venue === "prestocks"
        ? "ps"
        : venue === "polymarket"
          ? "pm"
          : venue === "kalshi"
            ? "kx"
            : "mf";
  let h = 2166136261;
  const s = `${venue}:${key}`;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${prefix}${(h >>> 0).toString(16)}`;
}

export function shortTapeName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= 28) return t;
  return `${t.slice(0, 26)}…`;
}

export function clampP(p: number): number {
  if (!Number.isFinite(p)) return 0.5;
  return Math.min(0.88, Math.max(0.12, p));
}

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw) as unknown;
      return Array.isArray(v) ? v.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parsePrices(raw: unknown): number[] {
  return parseJsonArray(raw).map((s) => n(s)).filter((x) => x > 0 && x < 1);
}

function day(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "open";
  return iso.slice(0, 10) || "open";
}

const EMPTY_USD = {
  lastUsd: 0,
  markUsd: 0,
  premium: null as number | null,
  holders: 0,
  valuation: 0,
  swapUrl: "",
  mint: "",
  sector: "",
};

async function getJson(url: string, ms = 4000): Promise<unknown> {
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
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export function listingToLive(h: HouseListing): LiveMarket {
  const prem = h.premium ?? 0;
  const streetYes = clampP(0.5 + prem * 0.6);
  const houseRules =
    h.venue === "tessera"
      ? "Tessera T-Token: loan participation, not equity. Permissionless DEX, no KYC. Live size is a Jupiter swap from your wallet."
      : "PreStock: SPV economic exposure, not a share, vote, or dividend. Live size is a Jupiter swap from your wallet.";
  return {
    id: h.id,
    venue: h.venue,
    venueKey: h.mint,
    name: h.symbol,
    question: h.question,
    resolveBy: "open",
    streetYes,
    volume: h.liquidity,
    url: h.url,
    blurb: h.sector || h.symbol,
    bidYes: null,
    askYes: null,
    lastYes: streetYes,
    liquidity: h.liquidity,
    volume24h: h.liquidity,
    openInterest: h.valuation,
    change24h: h.change24h,
    tokenYes: h.mint,
    conditionId: "",
    seriesTicker: h.symbol,
    description: h.description,
    rules: `${h.sector ? `${h.sector}. ` : ""}${houseRules}`,
    spread: null,
    lastUsd: h.last,
    markUsd: h.mark,
    premium: h.premium,
    holders: h.holders,
    valuation: h.valuation,
    swapUrl: h.swapUrl,
    mint: h.mint,
    sector: h.sector,
  };
}

export function listingFromLive(m: {
  id: string;
  venue: Venue;
  venueKey: string;
  name: string;
  question: string;
  description?: string;
  lastUsd?: number;
  markUsd?: number;
  premium?: number | null;
  valuation?: number;
  holders?: number;
  liquidity?: number;
  change24h?: number | null;
  url?: string;
  swapUrl?: string;
  mint?: string;
  sector?: string;
}): HouseListing | null {
  if (!isHouse(m.venue)) return null;
  return {
    id: m.id,
    venue: m.venue,
    mint: m.mint || m.venueKey,
    symbol: m.name,
    name: m.name,
    question: m.question,
    description: m.description ?? "",
    last: m.lastUsd ?? 0,
    mark: m.markUsd ?? 0,
    premium: m.premium ?? null,
    valuation: m.valuation ?? 0,
    holders: m.holders ?? 0,
    liquidity: m.liquidity ?? 0,
    change24h: m.change24h ?? null,
    url: m.url ?? "https://jup.ag",
    swapUrl: m.swapUrl || (m.mint || m.venueKey ? jupiterSwap(m.mint || m.venueKey) : ""),
    sector: m.sector ?? "",
    image: logoFor(m.name),
  };
}

function polyFromMarket(m: Record<string, unknown>, eventTitle?: string): LiveMarket | null {
  const prices = parsePrices(m.outcomePrices);
  const last = n(m.lastTradePrice) || prices[0] || 0;
  if (!(last > 0) || last >= 1) return null;
  const tokens = parseJsonArray(m.clobTokenIds);
  const id = String(m.id ?? m.conditionId ?? "");
  if (!id) return null;
  const question = String(m.question ?? eventTitle ?? "").trim();
  if (!question) return null;
  const bid = n(m.bestBid) || null;
  const ask = n(m.bestAsk) || null;
  const vol = n(m.volume24hr) || n(m.volume);
  const slug = String(m.slug ?? m.eventSlug ?? id);
  const spread = bid && ask && ask >= bid ? ask - bid : n(m.spread) || null;
  return {
    id: bookId("polymarket", id),
    venue: "polymarket",
    venueKey: id,
    name: shortTapeName(question),
    question,
    resolveBy: day(m.endDate ?? m.closedTime),
    streetYes: clampP(last),
    volume: vol,
    url: `https://polymarket.com/event/${slug}`,
    blurb: String(m.groupItemTitle ?? m.description ?? "").slice(0, 180),
    bidYes: bid && bid > 0 && bid < 1 ? bid : null,
    askYes: ask && ask > 0 && ask < 1 ? ask : null,
    lastYes: clampP(last),
    liquidity: n(m.liquidityNum ?? m.liquidity),
    volume24h: n(m.volume24hr) || vol,
    openInterest: n(m.openInterest),
    change24h: m.oneDayPriceChange != null ? n(m.oneDayPriceChange) : null,
    tokenYes: tokens[0] ?? "",
    conditionId: String(m.conditionId ?? ""),
    seriesTicker: "",
    description: String(m.description ?? "").slice(0, 2000),
    rules: String(m.description ?? "").slice(0, 8000),
    spread,
    ...EMPTY_USD,
  };
}

function polyFromEvent(e: Record<string, unknown>): LiveMarket | null {
  const markets = Array.isArray(e.markets) ? (e.markets as Record<string, unknown>[]) : [];
  let best: LiveMarket | null = null;
  let bestVol = -1;
  const title = String(e.title ?? "");
  for (const m of markets) {
    const row = polyFromMarket(m, title);
    if (!row) continue;
    const p = row.lastYes ?? row.streetYes;
    if (p < 0.05 || p > 0.95) continue;
    const vol = row.volume24h || row.volume;
    if (vol > bestVol) {
      best = row;
      bestVol = vol;
    }
  }
  if (best) {
    if (title) best.question = title;
    return best;
  }
  for (const m of markets) {
    const row = polyFromMarket(m, title);
    if (row) {
      if (title) row.question = title;
      return row;
    }
  }
  return null;
}

async function polyHot(limit: number): Promise<LiveMarket[]> {
  const raw = await getJson(
    `${POLY_GAMMA}/events?limit=${Math.min(40, Math.max(8, limit * 2))}&active=true&closed=false&order=volume24hr&ascending=false`,
  );
  const rows = Array.isArray(raw) ? raw : [];
  const out: LiveMarket[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const m = polyFromEvent(item as Record<string, unknown>);
    if (m) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

async function polySearch(query: string, limit: number): Promise<LiveMarket[]> {
  const q = query.trim();
  if (!q) return polyHot(limit);
  const raw = await getJson(`${POLY_GAMMA}/public-search?q=${encodeURIComponent(q)}`);
  const events =
    raw && typeof raw === "object" ? ((raw as { events?: unknown[] }).events ?? []) : [];
  const out: LiveMarket[] = [];
  const seen = new Set<string>();
  for (const item of events) {
    if (!item || typeof item !== "object") continue;
    const m = polyFromEvent(item as Record<string, unknown>);
    if (!m || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

function kalshiFromMarket(r: Record<string, unknown>): LiveMarket | null {
  const ticker = String(r.ticker ?? "");
  if (!ticker || /MVE|SHARD/i.test(ticker)) return null;
  const last = n(r.last_price_dollars ?? r.last_price) || n(r.yes_bid_dollars);
  if (!(last > 0) || last >= 1) return null;
  const title = String(r.title ?? r.yes_sub_title ?? ticker).trim();
  if (!title) return null;
  const bid = n(r.yes_bid_dollars ?? r.yes_bid);
  const ask = n(r.yes_ask_dollars ?? r.yes_ask);
  const vol = n(r.volume_24h_fp ?? r.volume_fp ?? r.volume);
  const series = String(r.event_ticker ?? ticker.split("-")[0] ?? "");
  return {
    id: bookId("kalshi", ticker),
    venue: "kalshi",
    venueKey: ticker,
    name: shortTapeName(title),
    question: title,
    resolveBy: day(r.close_time ?? r.expiration_time),
    streetYes: clampP(last),
    volume: vol,
    url: `https://kalshi.com/markets/${ticker.toLowerCase()}`,
    blurb: String(r.subtitle ?? r.yes_sub_title ?? "").slice(0, 180),
    bidYes: bid > 0 && bid < 1 ? bid : null,
    askYes: ask > 0 && ask < 1 ? ask : null,
    lastYes: clampP(last),
    liquidity: n(r.liquidity ?? r.open_interest_fp),
    volume24h: n(r.volume_24h_fp) || vol,
    openInterest: n(r.open_interest_fp ?? r.open_interest),
    change24h: null,
    tokenYes: "",
    conditionId: "",
    seriesTicker: series,
    description: String(r.rules_primary ?? r.subtitle ?? "").slice(0, 2000),
    rules: String(r.rules_primary ?? "").slice(0, 8000),
    spread: bid > 0 && ask >= bid ? ask - bid : null,
    ...EMPTY_USD,
  };
}

async function kalshiHot(limit: number): Promise<LiveMarket[]> {
  const raw = (await getJson(`${KALSHI}/markets?limit=${Math.min(50, limit * 3)}&status=open`)) as {
    markets?: Record<string, unknown>[];
  };
  const out: LiveMarket[] = [];
  for (const item of raw.markets ?? []) {
    const m = kalshiFromMarket(item);
    if (m) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

async function kalshiSearch(query: string, limit: number): Promise<LiveMarket[]> {
  const q = query.trim().toLowerCase();
  if (!q) return kalshiHot(limit);
  const raw = (await getJson(`${KALSHI}/markets?limit=80&status=open`)) as {
    markets?: Record<string, unknown>[];
  };
  const out: LiveMarket[] = [];
  for (const item of raw.markets ?? []) {
    const blob = `${item.ticker ?? ""} ${item.title ?? ""} ${item.subtitle ?? ""}`.toLowerCase();
    if (!blob.includes(q)) continue;
    const m = kalshiFromMarket(item);
    if (m) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

function manifoldFrom(r: Record<string, unknown>): LiveMarket | null {
  const id = String(r.id ?? "");
  if (!id) return null;
  const p = n(r.probability);
  if (!(p > 0) || p >= 1) return null;
  const question = String(r.question ?? "").trim();
  if (!question) return null;
  return {
    id: bookId("manifold", id),
    venue: "manifold",
    venueKey: id,
    name: shortTapeName(question),
    question,
    resolveBy: day(r.closeTime ? new Date(n(r.closeTime)).toISOString() : ""),
    streetYes: clampP(p),
    volume: n(r.volume24Hours ?? r.volume),
    url: String(r.url ?? `https://manifold.markets/${r.creatorUsername ?? "market"}/${r.slug ?? id}`),
    blurb: String(r.textDescription ?? "").slice(0, 180),
    bidYes: null,
    askYes: null,
    lastYes: clampP(p),
    liquidity: n(r.totalLiquidity),
    volume24h: n(r.volume24Hours),
    openInterest: 0,
    change24h: null,
    tokenYes: "",
    conditionId: "",
    seriesTicker: "",
    description: String(r.textDescription ?? "").slice(0, 2000),
    rules: "",
    spread: null,
    ...EMPTY_USD,
  };
}

async function manifoldSearch(query: string, limit: number): Promise<LiveMarket[]> {
  const q = query.trim();
  if (!q) return [];
  const raw = await getJson(
    `${MANIFOLD}/search-markets?term=${encodeURIComponent(q)}&limit=${limit}&filter=open&sort=score`,
  );
  const rows = Array.isArray(raw) ? raw : [];
  const out: LiveMarket[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const m = manifoldFrom(item as Record<string, unknown>);
    if (m) out.push(m);
    if (out.length >= limit) break;
  }
  return out;
}

const CLOB_FALLBACK: LiveMarket[] = [
  {
    id: bookId("polymarket", "fed-25bps"),
    venue: "polymarket",
    venueKey: "fed-25bps",
    name: "Fed 25bps",
    question: "Will the Fed raise rates 25bps at the next meeting?",
    resolveBy: "open",
    streetYes: 0.21,
    volume: 4_200_000,
    url: "https://polymarket.com",
    blurb: "Fallback book while Gamma is unreachable.",
    bidYes: 0.2,
    askYes: 0.22,
    lastYes: 0.21,
    liquidity: 800_000,
    volume24h: 1_100_000,
    openInterest: 2_400_000,
    change24h: -0.04,
    tokenYes: "",
    conditionId: "",
    seriesTicker: "",
    description: "Paper book. Live Gamma feed fills this once the street answers.",
    rules: "Resolves to the FOMC decision. Paper chips only.",
    spread: 0.02,
    ...EMPTY_USD,
  },
  {
    id: bookId("kalshi", "KXFED-FALLBACK"),
    venue: "kalshi",
    venueKey: "KXFED-FALLBACK",
    name: "Fed hold",
    question: "Will the Fed hold rates at the next meeting?",
    resolveBy: "open",
    streetYes: 0.74,
    volume: 2_100_000,
    url: "https://kalshi.com",
    blurb: "Fallback Kalshi book.",
    bidYes: 0.73,
    askYes: 0.75,
    lastYes: 0.74,
    liquidity: 400_000,
    volume24h: 620_000,
    openInterest: 1_800_000,
    change24h: 0.02,
    tokenYes: "",
    conditionId: "",
    seriesTicker: "KXFED",
    description: "Paper book. Live Kalshi tape fills this once the street answers.",
    rules: "Resolves to the FOMC decision. Paper chips only.",
    spread: 0.02,
    ...EMPTY_USD,
  },
];

export const FALLBACK_LIVE: LiveMarket[] = [
  ...HOUSE_FALLBACK.map(listingToLive),
  ...CLOB_FALLBACK,
];

async function houseLive(): Promise<LiveMarket[]> {
  try {
    const rows = await fetchHouse();
    return rows.map(listingToLive);
  } catch {
    return HOUSE_FALLBACK.map(listingToLive);
  }
}

function filterHouse(rows: LiveMarket[], query: string): LiveMarket[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((m) =>
    `${m.name} ${m.question} ${m.sector} ${m.description}`.toLowerCase().includes(q),
  );
}

export const PLUGINS: Record<Venue, VenuePlugin> = {
  tessera: {
    id: "tessera",
    label: "Tessera",
    tagline: "T-Kalshi, T-OpenAI, T-SpaceX. No KYC.",
    how: "Loan-participation T-Tokens on Solana. Paper LONG/FADE here. Live size is Jupiter.",
    hot: async (limit) => (await houseLive()).filter((m) => m.venue === "tessera").slice(0, limit),
    search: async (query, limit) =>
      filterHouse((await houseLive()).filter((m) => m.venue === "tessera"), query).slice(0, limit),
  },
  prestocks: {
    id: "prestocks",
    label: "PreStocks",
    tagline: "Every live PreStock: OpenAI, xAI, Anthropic, SpaceX, Anduril, more.",
    how: "SPV-backed PreStocks. Paper LONG/FADE here. Live size is Jupiter.",
    hot: async (limit) => (await houseLive()).filter((m) => m.venue === "prestocks").slice(0, limit),
    search: async (query, limit) =>
      filterHouse((await houseLive()).filter((m) => m.venue === "prestocks"), query).slice(0, limit),
  },
  polymarket: {
    id: "polymarket",
    label: "Polymarket",
    tagline: "CLOB street ¢. Wallet signs the live order.",
    how: "Gamma + CLOB, read-only. Paper chips on this pit.",
    hot: polyHot,
    search: polySearch,
  },
  kalshi: {
    id: "kalshi",
    label: "Kalshi",
    tagline: "CFTC books. Key signs the live order.",
    how: "Elections API, read-only. Paper chips on this pit.",
    hot: kalshiHot,
    search: kalshiSearch,
  },
  manifold: {
    id: "manifold",
    label: "Manifold",
    tagline: "Mana books. Search only.",
    how: "Public search. Paper chips on this pit.",
    hot: async () => [],
    search: manifoldSearch,
  },
};

export async function fetchLiveMarkets(): Promise<LiveMarket[]> {
  if (hotCache && Date.now() - hotCache.at < CACHE_MS) return hotCache.tables;
  const [house, poly, kalshi] = await Promise.all([
    withTimeout(houseLive().catch(() => HOUSE_FALLBACK.map(listingToLive)), 3600, HOUSE_FALLBACK.map(listingToLive)),
    withTimeout(polyHot(8).catch(() => [] as LiveMarket[]), 3200, []),
    withTimeout(kalshiHot(8).catch(() => [] as LiveMarket[]), 3200, []),
  ]);
  const seen = new Set<string>();
  const merged: LiveMarket[] = [];
  for (const m of [...house, ...poly, ...kalshi]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  const tables = merged.length >= 3 ? merged : FALLBACK_LIVE;
  hotCache = { at: Date.now(), tables };
  return tables;
}

export async function searchLiveMarkets(
  query: string,
  venue: "all" | Venue,
  limit = 24,
): Promise<LiveMarket[]> {
  const q = query.trim();
  const key = `${venue}:${q}:${limit}`;
  const hit = searchCache.get(key);
  if (hit && Date.now() - hit.at < SEARCH_CACHE_MS) return hit.tables;

  const plugins: Venue[] =
    venue === "all" ? VENUE_ORDER : isVenue(venue) ? [venue] : VENUE_ORDER;

  const chunks = await Promise.all(
    plugins.map((id) =>
      withTimeout(PLUGINS[id].search(q, Math.max(6, Math.ceil(limit / plugins.length))).catch(() => [] as LiveMarket[]), 3200, []),
    ),
  );
  const seen = new Set<string>();
  const tables: LiveMarket[] = [];
  for (const rows of chunks) {
    for (const m of rows) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      tables.push(m);
      if (tables.length >= limit) break;
    }
    if (tables.length >= limit) break;
  }
  searchCache.set(key, { at: Date.now(), tables });
  return tables;
}
