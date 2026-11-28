/** A bundle is weights on mints that already trade. It is not a new token. */

import { runPrestock } from "@/lib/prestock";

const KEY = "senda.bundles.v1";

export type BundleLeg = {
  mint: string;
  symbol: string;
  name: string;
  /** Share of the dollars, 0–100. The legs on a bundle add up to 100. */
  weight: number;
};

export type BundleFill = {
  at: string;
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  signature: string;
};

export type Bundle = {
  id: string;
  name: string;
  /** index = several assets. sleeve = one asset, still the same buy. */
  kind: "index" | "sleeve";
  usd: number;
  legs: BundleLeg[];
  created: string;
  fills: BundleFill[];
};

export type Pickable = { mint: string; symbol: string; name: string };

function load(): Bundle[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Bundle[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: Bundle[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* quota */
  }
}

export function listBundles(): Bundle[] {
  return load();
}

export function equalWeights(legs: BundleLeg[]): BundleLeg[] {
  if (!legs.length) return [];
  const each = Math.floor(100 / legs.length);
  return legs.map((leg, i) => ({ ...leg, weight: i === legs.length - 1 ? 100 - each * (legs.length - 1) : each }));
}

export function weightOk(legs: BundleLeg[]): boolean {
  const sum = legs.reduce((n, leg) => n + leg.weight, 0);
  return legs.length > 0 && legs.length <= 8 && legs.every((leg) => leg.weight > 0 && leg.mint.length > 30) && sum === 100;
}

export function saveBundle(input: { name: string; usd: number; legs: BundleLeg[] }): Bundle {
  if (!weightOk(input.legs)) throw new Error("Weights have to add to 100, with at most 8 assets that already trade.");
  if (!(input.usd >= 1)) throw new Error("Set the dollars for the whole basket.");
  const row: Bundle = {
    id: `b-${Date.now().toString(36)}`,
    name: input.name.trim() || "Untitled basket",
    kind: input.legs.length === 1 ? "sleeve" : "index",
    usd: Math.round(input.usd * 100) / 100,
    legs: input.legs,
    created: new Date().toISOString(),
    fills: [],
  };
  save([row, ...load()]);
  return row;
}

export function dropBundle(id: string) {
  save(load().filter((row) => row.id !== id));
}

function legUsd(bundle: Bundle, leg: BundleLeg): number {
  return Math.round(bundle.usd * (leg.weight / 100) * 100) / 100;
}

/** Buy or sell every leg. Each one is a Jupiter swap the wallet signs. A stop keeps the legs that already signed. */
export async function fillBundle(owner: string, id: string, side: "buy" | "sell"): Promise<BundleFill[]> {
  const bundle = load().find((row) => row.id === id);
  if (!bundle) throw new Error("That basket is not on this browser.");
  const signed: BundleFill[] = [];
  for (const leg of bundle.legs) {
    const usd = legUsd(bundle, leg);
    if (usd < 1) throw new Error(`${leg.symbol} would be $${usd}. Raise the basket so every leg is at least $1.`);
    try {
      const done = await runPrestock({ owner, mint: leg.mint, side, usd, symbol: leg.symbol, desk: "bundle" });
      const fill: BundleFill = { at: new Date().toISOString(), symbol: leg.symbol, side, usd, signature: done.signature };
      signed.push(fill);
      const rows = load();
      save(rows.map((row) => (row.id === id ? { ...row, fills: [fill, ...row.fills].slice(0, 40) } : row)));
    } catch (e) {
      const why = e instanceof Error ? e.message : "The wallet did not sign.";
      if (!signed.length) throw e instanceof Error ? e : new Error(why);
      throw new Error(`${signed.map((f) => f.symbol).join(", ")} signed. Stopped on ${leg.symbol}: ${why}`);
    }
  }
  return signed;
}

const COIN_SET = ["SOL", "JUP", "RAY", "ORCA", "PYTH", "JTO", "JLP", "W"];

/** Only mints present on `book`. Missing symbols are skipped, never invented. */
export function presetLegs(kind: "coins" | "names" | "shares", book: Pickable[]): BundleLeg[] {
  let picks: Pickable[] = [];
  if (kind === "coins") {
    const bySymbol = new Map(book.map((row) => [row.symbol.toUpperCase(), row]));
    picks = COIN_SET.map((s) => bySymbol.get(s)).filter((row): row is Pickable => !!row).slice(0, 6);
  } else if (kind === "shares") {
    picks = book.filter((row) => /x$/i.test(row.symbol) && row.symbol.length > 2 && row.symbol.length < 8).slice(0, 6);
  } else {
    picks = book.slice(0, 4);
  }
  return equalWeights(picks.map((row) => ({ mint: row.mint, symbol: row.symbol, name: row.name, weight: 0 })));
}
