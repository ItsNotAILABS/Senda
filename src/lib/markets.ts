import { DEFAULT_B, qFromProb } from "@/lib/lmsr";
import {
  FALLBACK_LIVE,
  fetchLiveMarkets,
  type LiveMarket,
  type Venue,
} from "@/lib/feeds";

export const BUY_IN_CHIPS = 1000;
export const CHIP_DENOMS = [1, 5, 25, 100, 500] as const;
export type ChipDenom = (typeof CHIP_DENOMS)[number];
export const DEFAULT_CHIP: ChipDenom = 25;
export const MAX_STACK = 20_000;
export const MAX_SPEND = 500;
export const GUEST_USER_ID = "guest";
export const HOUSE_USER_ID = "house";
export const SIMULATED_BANNER = "Paper · not real money";

export type MarketStatus = "open" | "paused" | "resolved";

export type BookExtra = {
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

export const EMPTY_BOOK: BookExtra = {
  bidYes: null,
  askYes: null,
  lastYes: null,
  liquidity: 0,
  volume24h: 0,
  openInterest: 0,
  change24h: null,
  tokenYes: "",
  conditionId: "",
  seriesTicker: "",
  description: "",
  rules: "",
  spread: null,
  lastUsd: 0,
  markUsd: 0,
  premium: null,
  holders: 0,
  valuation: 0,
  swapUrl: "",
  mint: "",
  sector: "",
};

export type TableDef = {
  id: string;
  name: string;
  question: string;
  resolveBy: string;
  qYes: number;
  qNo: number;
  b: number;
  status: MarketStatus;
  blurb: string;
  venue: Venue;
  venueKey: string;
  streetYes: number;
  volume: number;
  url: string;
} & BookExtra;

function bookFromLive(m: LiveMarket): BookExtra {
  const bid = m.bidYes ?? null;
  const ask = m.askYes ?? null;
  const last = m.lastYes ?? m.streetYes;
  return {
    bidYes: bid,
    askYes: ask,
    lastYes: last,
    liquidity: m.liquidity ?? 0,
    volume24h: m.volume24h ?? m.volume,
    openInterest: m.openInterest ?? 0,
    change24h: m.change24h ?? null,
    tokenYes: m.tokenYes ?? "",
    conditionId: m.conditionId ?? "",
    seriesTicker: m.seriesTicker ?? "",
    description: m.description ?? "",
    rules: m.rules ?? "",
    spread: m.spread ?? spreadOf(bid, ask),
    lastUsd: m.lastUsd ?? 0,
    markUsd: m.markUsd ?? 0,
    premium: m.premium ?? null,
    holders: m.holders ?? 0,
    valuation: m.valuation ?? 0,
    swapUrl: m.swapUrl ?? "",
    mint: m.mint ?? "",
    sector: m.sector ?? "",
  };
}

export function liveToTable(m: LiveMarket): TableDef {
  const { qYes, qNo } = qFromProb(m.streetYes, DEFAULT_B);
  return {
    id: m.id,
    name: m.name,
    question: m.question,
    resolveBy: m.resolveBy,
    qYes,
    qNo,
    b: DEFAULT_B,
    status: "open",
    blurb: m.blurb,
    venue: m.venue,
    venueKey: m.venueKey,
    streetYes: m.streetYes,
    volume: m.volume,
    url: m.url,
    ...bookFromLive(m),
  };
}

export const TABLES: TableDef[] = FALLBACK_LIVE.map(liveToTable);

let catalog: TableDef[] = TABLES;
const sat = new Map<string, TableDef>();

export function rememberTable(t: TableDef): void {
  sat.set(t.id, t);
}

export async function loadCatalog(): Promise<TableDef[]> {
  try {
    const live = await Promise.race([
      fetchLiveMarkets(),
      new Promise<LiveMarket[] | null>((resolve) => {
        setTimeout(() => resolve(null), 4200);
      }),
    ]);
    if (live && live.length >= 3) {
      catalog = live.map(liveToTable);
    }
  } catch {
    /* keep last catalog / fallback */
  }
  return catalog.length ? catalog : TABLES;
}

export function currentCatalog(): TableDef[] {
  return catalog.length ? catalog : TABLES;
}

export function allKnownTables(): TableDef[] {
  const base = currentCatalog();
  if (sat.size === 0) return base;
  const seen = new Set(base.map((t) => t.id));
  const extra = [...sat.values()].filter((t) => !seen.has(t.id));
  return extra.length ? [...base, ...extra] : base;
}

export function getTable(id: string): TableDef | undefined {
  return (
    currentCatalog().find((t) => t.id === id) ??
    sat.get(id) ??
    TABLES.find((t) => t.id === id)
  );
}

export function formatChips(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

export function formatPct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

/** Street last the way the real books quote it. */
export function streetLast(m: { lastYes?: number | null; streetYes: number }): number {
  return m.lastYes && m.lastYes > 0 ? m.lastYes : m.streetYes;
}

export function spreadOf(bid: number | null | undefined, ask: number | null | undefined): number | null {
  if (bid == null || ask == null) return null;
  if (!(ask >= bid)) return null;
  return ask - bid;
}

export function formatSpread(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n < 0) return "—";
  return `${(n * 100).toFixed(1)}¢`;
}

/** Street price the way the real books quote it. */
export function formatCents(p: number): string {
  return `${(p * 100).toFixed(1)}¢`;
}

/** Chips back if this side resolves (each share pays 1). */
export function paysIfHits(spend: number, p: number): number {
  if (!(spend > 0) || !(p > 0.001)) return 0;
  return spend / Math.min(0.99, Math.max(0.01, p));
}

export function formatPays(n: number): string {
  if (!(n > 0) || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n >= 100 ? 0 : 1,
  }).format(n);
}

export function formatDate(iso: string): string {
  if (!iso || iso === "open") return "Open";
  const d = new Date(`${iso.slice(0, 10)}T18:00:00-05:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatVolume(n: number, venue?: Venue): string {
  if (!(n > 0)) return "thin";
  if (venue === "manifold") {
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k mana`;
    return `${Math.round(n)} mana`;
  }
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}
