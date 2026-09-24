/**
 * Tokenized house on Solana — Tessera T-Tokens + PreStocks.
 * Read-only prices. Swaps go to Jupiter. Chips on this pit stay paper.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HouseVenue = "tessera" | "prestocks";

export type HouseListing = {
  id: string;
  venue: HouseVenue;
  mint: string;
  symbol: string;
  name: string;
  question: string;
  description: string;
  last: number;
  mark: number;
  premium: number | null;
  valuation: number;
  /** SPV mark valuation, PreStocks only. */
  markValuation?: number;
  /** Token supply, PreStocks only. */
  supply?: number;
  holders: number;
  liquidity: number;
  change24h: number | null;
  url: string;
  swapUrl: string;
  sector: string;
  image: string;
};

type Seed = {
  venue: HouseVenue;
  mint: string;
  symbol: string;
  name: string;
  mark: number;
  last: number;
  valuation: number;
  holders: number;
  liquidity: number;
  change24h: number | null;
  url: string;
  sector: string;
  description: string;
};

const UA = "ThePIT/1.0 (paper pit; Stocklana house tape; no custody)";
const TESSERA = "https://rest-api.tessera.pe/v1/public/token-details";
const PRESTOCKS = "https://prestocks.com/api/prestocks";
const JUP = "https://api.jup.ag/price/v3?ids=";

const CACHE_MS = 40_000;
let cache: { at: number; rows: HouseListing[] } | null = null;

function n(v: unknown): number {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function houseId(venue: HouseVenue, mint: string): string {
  const prefix = venue === "tessera" ? "ts" : "ps";
  let h = 2166136261;
  const s = `${venue}:${mint}`;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${prefix}${(h >>> 0).toString(16)}`;
}

export function logoFor(symbol: string): string {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const map: Record<string, string> = {
    OPENAI: "/logos/openai.png",
    ANTHROPIC: "/logos/anthropic.png",
    SPACEX: "/logos/spacex.png",
    ANDURIL: "/logos/anduril.png",
    NEURALINK: "/logos/neuralink.png",
    FIGUREAI: "/logos/figureai.png",
    KALSHI: "/logos/kalshi.png",
    XAI: "/logos/xai.png",
    POLYMARKET: "/logos/polymarket.png",
  };
  return map[s] ?? "/logos/openai.png";
}

export function houseVenueLabel(venue: HouseVenue): string {
  return venue === "prestocks" ? "PreStocks SPV" : "Tessera";
}

export function formatUsd(p: number): string {
  if (!(p > 0)) return "—";
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 100) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(2)}`;
}

export function formatValuation(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n)}`;
}

export function formatChg(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p) || p === 0) return "flat";
  const sign = p > 0 ? "+" : "";
  return `${sign}${(p * 100).toFixed(1)}%`;
}

export function formatPremium(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${(p * 100).toFixed(1)}%`;
}

export function jupiterSwap(mint: string): string {
  return `https://jup.ag/swap/USDC-${mint}`;
}

/** xAI token discontinued after the SpaceX deal. Off the book. */
function skippedName(symbol: string, name = "", url = ""): boolean {
  const blob = `${symbol} ${name} ${url}`.toUpperCase();
  return /\bXAI\b/.test(blob) && !blob.includes("SPACEX");
}

export function sectorFor(symbol: string, fallback = "Pre-IPO"): string {
  const s = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  if (s.includes("KALSHI") || s.includes("POLY")) return "Prediction Markets";
  if (s.includes("SPACE")) return "Aerospace";
  if (s.includes("ANDURIL")) return "Defense";
  if (s.includes("FIGURE")) return "Robotics";
  if (s.includes("NEURAL")) return "Neurotech";
  if (s.includes("DISC")) return "Consumer";
  if (s.includes("EPIC")) return "Games";
  if (s.includes("DATABR") || s.includes("GLEAN")) return "Infrastructure";
  if (s.includes("PERPLEX") || s.includes("PPLX") || s.includes("GROQ") || s.includes("HARVEY") || s.includes("SSI")) {
    return "Artificial Intelligence";
  }
  if (s.includes("KRAKEN")) return "Crypto";
  if (s.includes("SARON") || s.includes("CHAOS")) return "Defense";
  return fallback;
}

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

type JupRow = { usdPrice?: number; liquidity?: number; priceChange24h?: number };

async function jupPrices(mints: string[]): Promise<Record<string, JupRow>> {
  if (mints.length === 0) return {};
  const raw = await getJson(`${JUP}${mints.join(",")}`);
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, JupRow>;
}

function chgFrac(v: number | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.abs(v) > 1 ? v / 100 : v;
}

function premium(last: number, mark: number): number | null {
  if (!(mark > 0) || !(last > 0)) return null;
  return (last - mark) / mark;
}

/**
 * Every live Tessera T-Token + every live PreStock, including xAI
 * (prestocks.com/products lists it; the public /api/prestocks omits it).
 * Refunded/outdated Kraken, Discord, Databricks stay off.
 */
const SEEDS: Seed[] = [
  {
    venue: "tessera",
    mint: "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
    symbol: "T-Kalshi",
    name: "T-Kalshi",
    mark: 413.8,
    last: 449.66,
    valuation: 14_000_000_000,
    holders: 2605,
    liquidity: 199928,
    change24h: 0.0057,
    url: "https://app.tessera.pe",
    sector: "Prediction Markets",
    description:
      "Loan-participation T-Token for Kalshi on Solana. Not equity. Permissionless DEX, no KYC.",
  },
  {
    venue: "tessera",
    mint: "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
    symbol: "T-OpenAI",
    name: "T-OpenAI",
    mark: 812.79,
    last: 981.78,
    valuation: 950_000_000_000,
    holders: 8259,
    liquidity: 391668,
    change24h: 0.0079,
    url: "https://app.tessera.pe",
    sector: "Artificial Intelligence",
    description: "Loan-participation T-Token for OpenAI on Solana. Not equity.",
  },
  {
    venue: "tessera",
    mint: "TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v",
    symbol: "T-SpaceX",
    name: "T-SpaceX",
    mark: 423,
    last: 558.82,
    valuation: 800_000_000_000,
    holders: 1274,
    liquidity: 103461,
    change24h: 0,
    url: "https://app.tessera.pe",
    sector: "Aerospace",
    description: "Loan-participation T-Token for SpaceX on Solana. Not equity. Permissionless DEX, no KYC.",
  },
  {
    venue: "prestocks",
    mint: "PreLWGkkeqG1s4HEfFZSy9moCrJ7btsHuUtfcCeoRua",
    symbol: "KALSHI",
    name: "Kalshi PreStocks",
    mark: 894.58,
    last: 900.23,
    valuation: 32_743_394_471,
    holders: 0,
    liquidity: 100485,
    change24h: -0.0086,
    url: "https://www.prestocks.com/kalshi",
    sector: "Prediction Markets",
    description: "SPV-backed PreStock tracking Kalshi. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF",
    symbol: "OPENAI",
    name: "OpenAI PreStocks",
    mark: 991.14,
    last: 1161.68,
    valuation: 1_424_757_956_561,
    holders: 0,
    liquidity: 820277,
    change24h: 0.0306,
    url: "https://www.prestocks.com/openai",
    sector: "Artificial Intelligence",
    description: "SPV-backed PreStock tracking OpenAI. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw",
    symbol: "ANTHROPIC",
    name: "Anthropic PreStocks",
    mark: 1024.04,
    last: 1009.02,
    valuation: 1_643_568_410_719,
    holders: 0,
    liquidity: 683825,
    change24h: -0.0087,
    url: "https://www.prestocks.com/anthropic",
    sector: "Artificial Intelligence",
    description: "SPV-backed PreStock tracking Anthropic. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "Pre8AREmFPtoJFT8mQSXQLh56cwJmM7CFDRuoGBZiUP",
    symbol: "POLYMARKET",
    name: "Polymarket PreStocks",
    mark: 144.27,
    last: 143.93,
    valuation: 14_195_163_914,
    holders: 0,
    liquidity: 97000,
    change24h: 0.03,
    url: "https://www.prestocks.com/polymarket",
    sector: "Prediction Markets",
    description: "SPV-backed PreStock tracking Polymarket. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh",
    symbol: "SPACEX",
    name: "SpaceX PreStocks",
    mark: 152.57,
    last: 119.54,
    valuation: 1_567_262_870_583,
    holders: 0,
    liquidity: 113265,
    change24h: -0.0147,
    url: "https://www.prestocks.com/spacex",
    sector: "Aerospace",
    description: "SPV-backed PreStock tracking SpaceX. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "PrekqLJvJ3qVdXmBGDiexvwUTF4rLFDa6HWS4HJbw9S",
    symbol: "NEURALINK",
    name: "Neuralink PreStocks",
    mark: 333.42,
    last: 424.32,
    valuation: 80_905_827_097,
    holders: 0,
    liquidity: 276388,
    change24h: 0.1008,
    url: "https://www.prestocks.com/neuralink",
    sector: "Neurotech",
    description: "SPV-backed PreStock tracking Neuralink. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB",
    symbol: "ANDURIL",
    name: "Anduril PreStocks",
    mark: 152.53,
    last: 161.38,
    valuation: 142_772_530_369,
    holders: 0,
    liquidity: 378656,
    change24h: 0.0484,
    url: "https://www.prestocks.com/anduril",
    sector: "Defense",
    description: "SPV-backed PreStock tracking Anduril. Economic exposure only — not a share.",
  },
  {
    venue: "prestocks",
    mint: "PreZad18qfPtbxNpMtMuAuX2zVpvkEU8DnJx56faCWd",
    symbol: "FIGUREAI",
    name: "Figure AI PreStocks",
    mark: 181.71,
    last: 170.31,
    valuation: 37_559_368_875,
    holders: 0,
    liquidity: 127516,
    change24h: -0.0617,
    url: "https://www.prestocks.com/figureai",
    sector: "Robotics",
    description: "SPV-backed PreStock tracking Figure AI. Economic exposure only — not a share.",
  },
];

const SEED_MINTS = new Set(SEEDS.map((s) => s.mint));

function fromSeed(s: Seed, px?: JupRow): HouseListing {
  const last = n(px?.usdPrice) || s.last || s.mark;
  return {
    id: houseId(s.venue, s.mint),
    venue: s.venue,
    mint: s.mint,
    symbol: s.symbol,
    name: s.name,
    question: s.venue === "tessera" ? `Tessera ${s.symbol}` : s.name,
    description: s.description,
    last,
    mark: s.mark,
    premium: premium(last, s.mark),
    valuation: s.valuation,
    holders: s.holders,
    liquidity: n(px?.liquidity) || s.liquidity,
    change24h: chgFrac(px?.priceChange24h) ?? s.change24h,
    url: s.url,
    swapUrl: jupiterSwap(s.mint),
    sector: s.sector,
    image: logoFor(s.symbol),
  };
}

function rank(s: HouseListing): number {
  const blob = `${s.symbol} ${s.name}`.toUpperCase();
  const venueBoost = s.venue === "prestocks" ? 0 : 20;
  let name = 12;
  if (blob.includes("KALSHI")) name = 0;
  else if (blob.includes("OPENAI")) name = 1;
  else if (blob.includes("ANTHROP")) name = 3;
  else if (blob.includes("POLY")) name = 4;
  else if (blob.includes("SPACE")) name = 5;
  else if (blob.includes("NEURAL")) name = 6;
  else if (blob.includes("ANDURIL")) name = 7;
  else if (blob.includes("FIGURE")) name = 8;
  return venueBoost + name;
}

function sortHouse(rows: HouseListing[]): HouseListing[] {
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    return d !== 0 ? d : b.liquidity - a.liquidity;
  });
}

export const HOUSE_FALLBACK: HouseListing[] = sortHouse(SEEDS.map((s) => fromSeed(s)));

function tesseraRows(raw: unknown, px: Record<string, JupRow>): HouseListing[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: HouseListing[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const mint = String(r.mint ?? "");
    if (!mint) continue;
    const symbol = String(r.symbol ?? r.code ?? "T");
    const name = String(r.name ?? symbol);
    if (skippedName(symbol, name)) continue;
    const mark = n(r.markPrice);
    const last = n(px[mint]?.usdPrice) || mark;
    out.push({
      id: houseId("tessera", mint),
      venue: "tessera",
      mint,
      symbol,
      name,
      question: `Tessera ${symbol}`,
      description: `${name} is a Tessera T-Token on Solana — loan participation, not equity. ${String(r.sector ?? "")} Permissionless DEX, no KYC.`,
      last,
      mark,
      premium: premium(last, mark),
      valuation: n(r.markValuation),
      holders: Math.round(n(r.holders)),
      liquidity: n(px[mint]?.liquidity),
      change24h: chgFrac(px[mint]?.priceChange24h),
      url: "https://app.tessera.pe",
      swapUrl: jupiterSwap(mint),
      sector: String(r.sector ?? "") || sectorFor(symbol),
      image: logoFor(symbol),
    });
  }
  return out;
}

function prestocksRows(raw: unknown, px: Record<string, JupRow>): HouseListing[] {
  const rows = Array.isArray(raw) ? raw : [];
  const out: HouseListing[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const mint = String(r.contract_address ?? "");
    if (!mint) continue;
    const symbol = String(r.symbol ?? "");
    const name = String(r.name ?? symbol);
    if (skippedName(symbol, name, String(r.external_url ?? ""))) continue;
    const mark = n(r.markPrice);
    const token = n(r.tokenPrice) || n(px[mint]?.usdPrice) || mark;
    const desc = String(r.description ?? "").split("\n\n")[0] ?? "";
    const known = SEED_MINTS.has(mint);
    if (!(token > 0) && !(mark > 0)) continue;
    if (!known && token > 0 && token < 0.05) continue;
    out.push({
      id: houseId("prestocks", mint),
      venue: "prestocks",
      mint,
      symbol,
      name,
      question: name,
      description: desc.slice(0, 420) || `${name}. SPV economic exposure — not a share.`,
      last: token,
      mark,
      premium: premium(token, mark),
      valuation: n(r.impliedValuation) || n(r.markValuation),
      markValuation: n(r.markValuation),
      supply: n(r.supply),
      holders: Math.round(n(r.holders)),
      liquidity: n(px[mint]?.liquidity),
      change24h: chgFrac(px[mint]?.priceChange24h),
      url: String(r.external_url ?? "https://prestocks.com"),
      swapUrl: jupiterSwap(mint),
      sector: sectorFor(symbol),
      image: String(r.image ?? "") || logoFor(symbol),
    });
  }
  return out;
}

function fillSeeds(have: Set<string>, px: Record<string, JupRow>): HouseListing[] {
  return SEEDS.filter((s) => !have.has(s.mint)).map((s) => fromSeed(s, px[s.mint]));
}

export async function fetchHouse(): Promise<HouseListing[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.rows;
  try {
    const [tess, pre] = await Promise.all([
      withTimeout(getJson(TESSERA).catch(() => []), 3200, []),
      withTimeout(getJson(PRESTOCKS).catch(() => []), 3200, []),
    ]);
    const tessRows = Array.isArray(tess) ? tess : [];
    const preRows = Array.isArray(pre) ? pre : [];
    const mints = [
      ...tessRows.map((r) => String((r as Record<string, unknown>).mint ?? "")),
      ...preRows.map((r) => String((r as Record<string, unknown>).contract_address ?? "")),
      ...SEEDS.map((e) => e.mint),
    ].filter(Boolean);
    const px = await withTimeout(jupPrices(mints).catch(() => ({})), 2800, {} as Record<string, JupRow>);
    const live = [...tesseraRows(tess, px), ...prestocksRows(pre, px)];
    const have = new Set(live.map((r) => r.mint));
    const rows = sortHouse([...live, ...fillSeeds(have, px)]);
    const filled = rows.length ? rows : HOUSE_FALLBACK;
    cache = { at: Date.now(), rows: filled };
    return filled;
  } catch {
    return HOUSE_FALLBACK;
  }
}

export const getHouse = createServerFn({ method: "GET" }).handler(
  async (): Promise<HouseListing[]> => fetchHouse(),
);

export const getHouseOne = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ id: z.string().min(1).max(48) }).parse(input))
  .handler(async ({ data }): Promise<HouseListing | null> => {
    const rows = await fetchHouse();
    return rows.find((r) => r.id === data.id) ?? null;
  });
