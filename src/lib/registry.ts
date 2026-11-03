/** Live markets only. A row exists because a venue returned it. Nothing here is typed in as a price. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CHAIN_LANES, KEPT_DESKS } from "@/lib/chain-book";
import { listSolanaXStocks } from "@/lib/equities";
import { PERP_MARKETS } from "@/lib/jup-perps";
import { PAIR_MARKETS } from "@/lib/market-catalog";
import { fetchHouse } from "@/lib/sol-house";
import { loadHlMarkets } from "@/lib/hl-book";
import { loadKaminoVaults, VAULT_RECEIPTS } from "@/lib/vault-book";
import { loadTape } from "@/lib/world-book";

export type RegFamily = "coin" | "xstock" | "name" | "stake" | "vault" | "perp" | "ostium" | "hl" | "network" | "desk";

export type RegRow = {
  id: string;
  symbol: string;
  name: string;
  family: RegFamily;
  venue: string;
  chain: "Solana" | "Arbitrum" | "Hyperliquid";
  mint: string;
  price: number | null;
  change: number | null;
  sign: "jupiter" | "prestock" | "arbitrum" | "jup-perps" | "hyperliquid";
  note: string;
  liquidity: number | null;
  holders: number | null;
  fdv: number | null;
  perp: boolean;
  asset?: number;
  szDecimals?: number;
  maxLev?: number;
};

const RANK: Record<RegFamily, number> = { name: 0, xstock: 1, stake: 2, vault: 3, perp: 4, coin: 5, ostium: 6, hl: 7, network: 8, desk: 9 };
const GRAPH = "https://api.subgraph.ormilabs.com/api/public/67a599d5-c8d2-4cc4-9c4d-2975a97bc5d8/subgraphs/ost-prod/live/gn";
const TTL = 3 * 60 * 1000;

let cache: { at: number; rows: RegRow[] } | null = null;
let pending: Promise<RegRow[]> | null = null;

function add(map: Map<string, RegRow>, row: RegRow) {
  const id = row.mint.length >= 32 ? row.mint : row.id;
  const next = { ...row, id };
  const prev = map.get(id);
  if (!prev || RANK[next.family] < RANK[prev.family]) {
    if (prev) {
      if (next.price == null) next.price = prev.price;
      if (next.change == null) next.change = prev.change;
      next.perp = next.perp || prev.perp;
    }
    map.set(id, next);
    return;
  }
  if (prev.price == null && next.price != null) prev.price = next.price;
  if (prev.change == null && next.change != null) prev.change = next.change;
  prev.perp = prev.perp || next.perp;
}

async function ostiumPairs(): Promise<RegRow[]> {
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "Senda/1.0" },
    body: JSON.stringify({ query: "{ pairs(first: 200) { id from to maxLeverage } }" }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: { pairs?: { id?: string; from?: string; to?: string; maxLeverage?: string }[] } };
  const rows: RegRow[] = [];
  for (const pair of json.data?.pairs ?? []) {
    if (!pair.from || !pair.to || pair.id == null) continue;
    const max = Number(pair.maxLeverage) || 0;
    rows.push({
      id: `ostium-${pair.id}`,
      symbol: `${pair.from}/${pair.to}`,
      name: `${pair.from} / ${pair.to}`,
      family: "ostium",
      venue: "Ostium",
      chain: "Arbitrum",
      mint: "",
      price: null,
      change: null,
      sign: "arbitrum",
      note: max > 0 ? `Ostium pair ${pair.id}. Up to ${max / 100}×. USDC margin on Arbitrum.` : `Ostium pair ${pair.id}. USDC margin on Arbitrum.`,
      liquidity: null,
      holders: null,
      fdv: null,
      perp: true,
    });
  }
  return rows;
}

async function build(): Promise<RegRow[]> {
  const [tape, house, shares, vaults, ostium, hl] = await Promise.all([
    loadTape().catch(() => []),
    fetchHouse().catch(() => []),
    listSolanaXStocks().catch(() => []),
    loadKaminoVaults().catch(() => []),
    ostiumPairs().catch(() => []),
    loadHlMarkets().catch(() => []),
  ]);
  const map = new Map<string, RegRow>();
  const shareMints = new Set(shares.map((row) => row.mint));
  const stakeMints = new Set(VAULT_RECEIPTS.map((row) => row.mint));
  for (const row of tape) {
    if (row.id.length < 32 || !row.symbol) continue;
    const family: RegFamily = shareMints.has(row.id) || row.id.startsWith("Xs") ? "xstock" : stakeMints.has(row.id) ? "stake" : "coin";
    add(map, {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      family,
      venue: family === "xstock" ? "xStock" : family === "stake" ? "Stake" : "Jupiter",
      chain: "Solana",
      mint: row.id,
      price: row.price,
      change: row.change,
      sign: "jupiter",
      note: family === "xstock" ? "Listed token. Jupiter quotes it. The wallet signs." : family === "stake" ? "Staked SOL receipt. Jupiter quotes it. The wallet signs." : "Jupiter verified or liquid. The wallet signs.",
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  for (const row of shares) {
    if (row.mint.length < 32) continue;
    add(map, {
      id: row.mint,
      symbol: row.symbol,
      name: row.name,
      family: "xstock",
      venue: "xStock",
      chain: "Solana",
      mint: row.mint,
      price: null,
      change: null,
      sign: "jupiter",
      note: row.halted ? "Halted. The token is listed. Nothing is signed while it is halted." : row.open ? `Listed share. Session ${row.hours}. Jupiter quotes it.` : `Listed share. The session is ${row.hours}. Jupiter still quotes the token.`,
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  for (const row of house) {
    if (!row.mint || row.mint.length < 32 || !(row.last > 0)) continue;
    add(map, {
      id: row.mint,
      symbol: row.symbol,
      name: row.name,
      family: "name",
      venue: row.venue === "prestocks" ? "PreStocks" : "Tessera",
      chain: "Solana",
      mint: row.mint,
      price: row.last,
      change: row.change24h,
      sign: "prestock",
      note: "Pre-IPO token. Jupiter swaps it into the wallet. The FDV is the valuation, not the fill.",
      liquidity: row.liquidity > 0 ? row.liquidity : null,
      holders: row.holders > 0 ? row.holders : null,
      fdv: row.valuation > 0 ? row.valuation : null,
      perp: false,
    });
  }
  for (const row of VAULT_RECEIPTS) {
    add(map, {
      id: row.mint,
      symbol: row.symbol,
      name: row.name,
      family: "stake",
      venue: "Stake",
      chain: "Solana",
      mint: row.mint,
      price: null,
      change: null,
      sign: "jupiter",
      note: row.note,
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  for (const row of vaults) {
    if (row.sharesMint.length < 32) continue;
    add(map, {
      id: row.sharesMint,
      symbol: row.name.slice(0, 18),
      name: row.name,
      family: "vault",
      venue: "Kamino",
      chain: "Solana",
      mint: row.sharesMint,
      price: null,
      change: null,
      sign: "jupiter",
      note: "Kamino vault share. Jupiter quotes the share. Senda does not deposit.",
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  for (const market of PERP_MARKETS) {
    const prev = map.get(market.mint);
    if (prev) {
      prev.perp = true;
      prev.note = `${prev.note} Also a Jupiter perpetual.`;
      continue;
    }
    add(map, {
      id: market.mint,
      symbol: `${market.asset}-PERP`,
      name: `${market.name} perpetual`,
      family: "perp",
      venue: "Jupiter Perps",
      chain: "Solana",
      mint: market.mint,
      price: null,
      change: null,
      sign: "jup-perps",
      note: "Jupiter builds the perp. Phantom signs. Senda does not hold the margin.",
      liquidity: null,
      holders: null,
      fdv: null,
      perp: true,
    });
  }
  for (const row of ostium) add(map, row);
  for (const row of hl) {
    add(map, {
      id: `hl-${row.asset}`,
      symbol: row.label,
      name: row.id,
      family: "hl",
      venue: row.dex ? `Hyperliquid · ${row.dex}` : "Hyperliquid",
      chain: "Hyperliquid",
      mint: "",
      price: row.mark,
      change: row.change == null ? null : row.change / 100,
      sign: "hyperliquid",
      note: `${row.id} on ${row.dex || "Hyperliquid"}. ${row.kind}. Up to ${row.maxLeverage}×. The Ethereum account signs. Margin stays on Hyperliquid.`,
      liquidity: row.volume,
      holders: null,
      fdv: null,
      perp: true,
      asset: row.asset,
      szDecimals: row.szDecimals,
      maxLev: row.maxLeverage,
    });
  }
  for (const market of PAIR_MARKETS) {
    if (market.mint && map.has(market.mint)) continue;
    add(map, {
      id: market.mint && market.mint.length >= 32 ? market.mint : `pair-${market.id}`,
      symbol: market.symbol,
      name: market.name,
      family: market.group === "fx" || market.group === "metal" ? "ostium" : "coin",
      venue: market.mint ? "Jupiter" : "Ostium",
      chain: market.mint ? "Solana" : "Arbitrum",
      mint: market.mint ?? "",
      price: null,
      change: null,
      sign: market.mint ? "jupiter" : "arbitrum",
      note: market.ostium ? `Print ${market.ostium}.${market.mint ? " The token signs on Solana." : " No Solana token, so Arbitrum is the book."}` : "Jupiter quote. The wallet signs.",
      liquidity: null,
      holders: null,
      fdv: null,
      perp: !market.mint,
    });
  }
  for (const lane of CHAIN_LANES) {
    add(map, {
      id: `network-${lane.id}`,
      symbol: lane.name,
      name: lane.name,
      family: "network",
      venue: lane.name,
      chain: lane.id === "arbitrum" ? "Arbitrum" : "Solana",
      mint: "",
      price: null,
      change: null,
      sign: lane.id === "arbitrum" ? "arbitrum" : "jupiter",
      note: `${lane.sign}. ${lane.clears}`,
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  for (const desk of KEPT_DESKS) {
    const id = `desk-${desk.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    add(map, {
      id,
      symbol: desk.name,
      name: desk.name,
      family: "desk",
      venue: desk.where,
      chain: "Solana",
      mint: "",
      price: null,
      change: null,
      sign: "jupiter",
      note: desk.holds,
      liquidity: null,
      holders: null,
      fdv: null,
      perp: false,
    });
  }
  return [...map.values()].sort((a, b) => a.family.localeCompare(b.family) || a.symbol.localeCompare(b.symbol));
}

export function loadRegistry(): Promise<RegRow[]> {
  if (cache && Date.now() - cache.at < TTL) return Promise.resolve(cache.rows);
  if (!pending) {
    pending = build()
      .then((rows) => {
        cache = { at: Date.now(), rows };
        return rows;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

function counts(rows: RegRow[]) {
  const families: Record<string, number> = {};
  for (const row of rows) families[row.family] = (families[row.family] ?? 0) + 1;
  return families;
}

export const registryPage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(80).optional(),
        family: z.enum(["coin", "xstock", "name", "stake", "vault", "perp", "ostium", "hl", "network", "desk", "all"]).optional(),
        offset: z.number().int().min(0).max(20_000).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const all = await loadRegistry();
    const q = (data.q ?? "").trim().toLowerCase();
    const family = data.family ?? "all";
    const matched = all.filter((row) => {
      if (family !== "all" && row.family !== family) return false;
      if (!q) return true;
      return `${row.symbol} ${row.name} ${row.venue}`.toLowerCase().includes(q);
    });
    const offset = data.offset ?? 0;
    const limit = data.limit ?? 60;
    return { total: all.length, matched: matched.length, families: counts(all), rows: matched.slice(offset, offset + limit) };
  });

export const registryOne = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ id: z.string().min(2).max(80) }).parse(input))
  .handler(async ({ data }) => {
    const all = await loadRegistry();
    return all.find((row) => row.id === data.id) ?? null;
  });
