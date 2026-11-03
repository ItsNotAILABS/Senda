/**
 * PreStocks prints Jupiter still indexes after the issuer marked them
 * refunded or replaced. They stay on the book so the old names are visible.
 * There is no pool, so this desk never asks a wallet to buy one.
 */

import { createServerFn } from "@tanstack/react-start";
import { sectorFor } from "@/lib/sol-house";

export type ClosedPrint = {
  mint: string;
  symbol: string;
  name: string;
  status: "refunded" | "outdated";
  sector: string;
  note: string;
};

type Known = {
  mint: string;
  symbol: string;
  name: string;
  status: "refunded" | "outdated";
  note: string;
};

/** Issuer-labeled mints from Jupiter, 11 Oct 2026. Not guessed. */
const KNOWN: Known[] = [
  {
    mint: "PrekBgzytydXoDTrH5NW9ABP68c96twxML8oV1NnV8d",
    symbol: "DISCORD",
    name: "Discord",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PregdTtARmfoDGB7XsbyyZc4RmKbKdmiPFXvinBpjTa",
    symbol: "DATABRICKS",
    name: "Databricks",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreGJxNkwFp8KmtA5rnvgv2z3zAa8c2UQMfN4FjPh4Z",
    symbol: "EPIC",
    name: "Epic Games",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "Pres43hQWdY6HaHWckmgzqyQgVwYCXen3VPrXMoKWeY",
    symbol: "KRAKEN",
    name: "Kraken",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreG98Hxr4GNswTNTQfBVqRQe6DNCjJ9Rg5jqFzmiXA",
    symbol: "PERPLEXITY",
    name: "Perplexity",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreZdBV5d4XDUa7diCGZmyZXQSpbAdrTEzmgvUWY5Dd",
    symbol: "GLEAN",
    name: "Glean",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "Pre8wtN7sLADKn8qekjQipcSiYTGg5tafWqeH49s1wQ",
    symbol: "GROQ",
    name: "Groq",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PrevLYRs2HreKvo2bEQsAo839m38ws5TH2WHYFzqsWt",
    symbol: "HARVEY",
    name: "Harvey",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "Pre2Y4gaf97C4T8ckygDpYbja3w6mH6zmCEs3SA8ALH",
    symbol: "SSI",
    name: "Safe Superintelligence",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreJuqZjkL2QFkx78MkEGv8P6Zk8qqpTx9GSjLtfvXW",
    symbol: "SARONIC",
    name: "Saronic",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PrejfFQH6y6aQBfR43zuBqnPXvQrDU5EugwVEBQZVK3",
    symbol: "CHAOS",
    name: "CHAOS Industries",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreZsfo4N5J16vpJWvaTubLpNHrBe1fNgvoFuqZ21xK",
    symbol: "APPTRONIK",
    name: "Apptronik",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreDmU41w1LZaDqiEQdd75ffWaDndMMN8bJPfNno4AM",
    symbol: "ADDEPAR",
    name: "Addepar",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreQ1REpwo4v5d8QMF58h3jpqKww9k5NMbvBXMVo7A5",
    symbol: "BLABLACAR",
    name: "BlaBlaCar",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreQhJLE9YMSVtJpVLJ3bAWE2BQ5AqBniG7aA2bGRRz",
    symbol: "IMPOSSIBLE",
    name: "Impossible Foods",
    status: "refunded",
    note: "Refunded. No Jupiter price.",
  },
  {
    mint: "PreAYsissANcRXg5uTniKqdCrrUSGdvtrKDVPHS1ib6",
    symbol: "FIGURE",
    name: "Figure AI",
    status: "refunded",
    note: "Old print. The one you can buy is FIGUREAI.",
  },
  {
    mint: "Pre5X98d9ZvgGirEcWqeCVDK6wQ52stKkmU3HsH6bfE",
    symbol: "NEURAL",
    name: "Neuralink",
    status: "refunded",
    note: "Old print. The one you can buy is NEURALINK.",
  },
  {
    mint: "Prep57BLk9uKWRzKigtQBbrYFxcDXtHuCjxFRM5UXAS",
    symbol: "ANDURIL-OLD",
    name: "Anduril",
    status: "outdated",
    note: "Replaced. The live print is ANDURIL.",
  },
  {
    mint: "PreGERrFuZAJqTxJ5oC3DeQmfdrniNzJgqKGFb2ZLE6",
    symbol: "ANTHROPIC-OLD",
    name: "Anthropic",
    status: "outdated",
    note: "Replaced. The live print is ANTHROPIC.",
  },
  {
    mint: "PreYKD2kJ5xGgoZ644VPfbEN7sW8bWCUREHr5S3ebV9",
    symbol: "OPENAI-OLD",
    name: "OpenAI",
    status: "outdated",
    note: "Replaced. The live print is OPENAI.",
  },
  {
    mint: "Preb5VKsmKgMGhMKUhDpe7A2AhMDmrZtMMZmvFEhLbU",
    symbol: "SPACEX-OLD",
    name: "SpaceX",
    status: "outdated",
    note: "Replaced. The live print is SPACEX.",
  },
  {
    mint: "PreYPq1LdVBhKsYC3nRmZW5Y9yJXwSuDYmUSikFCwGS",
    symbol: "XAI-OLD",
    name: "xAI",
    status: "outdated",
    note: "Replaced. The live print is XAI.",
  },
];

function knownRows(): ClosedPrint[] {
  return KNOWN.map((row) => ({ ...row, sector: sectorFor(row.symbol, sectorFor(row.name)) }));
}

type JupAsset = {
  id?: string;
  symbol?: string;
  name?: string;
  tags?: string[];
};

function fromSearch(asset: JupAsset): ClosedPrint | null {
  const mint = String(asset.id ?? "");
  const rawName = String(asset.name ?? "");
  const rawSymbol = String(asset.symbol ?? "");
  const tags = asset.tags ?? [];
  if (!mint.startsWith("Pre")) return null;
  if (!tags.includes("prestocks") && !rawName.includes("PreStock")) return null;
  const outdated = rawName.startsWith("[OUTDATED]") || rawSymbol.startsWith("OUTDATED");
  const refunded = rawName.startsWith("[REFUNDED]") || rawSymbol.startsWith("REFUNDED");
  if (!outdated && !refunded) return null;
  const name = rawName.replace(/^\[(REFUNDED|OUTDATED)\]\s*/, "").replace(/\s*PreStocks$/, "").trim();
  const symbol = rawSymbol.replace(/^(REFUNDED|OUTDATED)-/, "").replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12);
  if (!name || !symbol) return null;
  return {
    mint,
    symbol,
    name,
    status: outdated ? "outdated" : "refunded",
    sector: sectorFor(symbol, sectorFor(name)),
    note: outdated ? "Replaced. The live print is on the book above." : "Refunded. No Jupiter price.",
  };
}

async function search(q: string): Promise<JupAsset[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(`https://datapi.jup.ag/v1/assets/search?query=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
      headers: { accept: "application/json", "user-agent": "Senda/1.0" },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as JupAsset[]) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

let cache: { at: number; rows: ClosedPrint[] } | null = null;

export async function fetchClosedPrints(): Promise<ClosedPrint[]> {
  if (cache && Date.now() - cache.at < 60_000) return cache.rows;
  const base = knownRows();
  const seen = new Set(base.map((row) => row.mint));
  const extra = await Promise.all([search("[REFUNDED] PreStocks"), search("[OUTDATED] PreStocks")]);
  const rows = [...base];
  for (const asset of extra.flat()) {
    const row = fromSearch(asset);
    if (!row || seen.has(row.mint)) continue;
    seen.add(row.mint);
    rows.push(row);
  }
  rows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "refunded" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  cache = { at: Date.now(), rows };
  return rows;
}

export const getClosedPrints = createServerFn({ method: "GET" }).handler(async () => fetchClosedPrints());
