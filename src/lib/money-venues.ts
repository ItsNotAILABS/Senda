/** One size, five venues. A pool print is not a route. A paper score is not USDC. A miss is not a price. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchQuote, impactPct } from "@/lib/jup-exec";

const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const KAMINO = "https://api.kamino.finance/kamino-market/7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF/reserves/metrics";
const CAP = 5;

export type MoneyVenue = {
  id: "jupiter" | "raydium" | "orca" | "meteora" | "kamino";
  name: string;
  kind: "router" | "pool" | "lend";
  ok: boolean;
  error: string;
  solPx: number | null;
  solOut: number | null;
  impactPct: number | null;
  tvl: number | null;
  apy: number | null;
  note: string;
};

export type VenueTape = { usd: number; rows: MoneyVenue[] };

function miss(id: MoneyVenue["id"], name: string, kind: MoneyVenue["kind"], error: string): MoneyVenue {
  return { id, name, kind, ok: false, error, solPx: null, solOut: null, impactPct: null, tvl: null, apy: null, note: "" };
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function jupiter(usd: number): Promise<MoneyVenue> {
  const quote = await fetchQuote(SOL, usd, "buy");
  if ("error" in quote) return miss("jupiter", "Jupiter", "router", quote.error);
  const solOut = Number(quote.outAmount) / 1e9;
  if (!(solOut > 0)) return miss("jupiter", "Jupiter", "router", "Jupiter did not quote an amount.");
  const impact = impactPct(quote);
  const over = impact > CAP;
  const route = quote.route.length ? quote.route.join(" · ") : "Jupiter";
  return {
    id: "jupiter",
    name: "Jupiter",
    kind: "router",
    ok: true,
    error: "",
    solPx: usd / solOut,
    solOut,
    impactPct: impact,
    tvl: null,
    apy: null,
    note: over
      ? `${route}. Quoted, and over the 5% cap. This screen does not sign.`
      : `${route}. A route for this size. This screen does not sign.`,
  };
}

async function raydium(): Promise<MoneyVenue> {
  const body = (await getJson(
    `https://api-v3.raydium.io/pools/info/mint?mint1=${SOL}&mint2=${USDC}&poolType=all&poolSortField=liquidity&sortType=desc&pageSize=1&page=1`,
  )) as { data?: { data?: Array<{ price?: number; tvl?: number; mintA?: { address?: string }; mintB?: { address?: string } }> } };
  const row = body.data?.data?.[0];
  const raw = Number(row?.price) || 0;
  const a = row?.mintA?.address || "";
  const b = row?.mintB?.address || "";
  if (!row || !(raw > 0) || ![a, b].includes(SOL) || ![a, b].includes(USDC)) {
    return miss("raydium", "Raydium", "pool", "Raydium did not return a SOL/USDC pool.");
  }
  const solPx = a === SOL ? raw : 1 / raw;
  if (!(solPx > 0)) return miss("raydium", "Raydium", "pool", "Raydium did not price SOL.");
  return {
    id: "raydium",
    name: "Raydium",
    kind: "pool",
    ok: true,
    error: "",
    solPx,
    solOut: null,
    impactPct: null,
    tvl: Number(row.tvl) || null,
    apy: null,
    note: "Pool print. Not a fill for this size.",
  };
}

async function orca(): Promise<MoneyVenue> {
  const body = (await getJson(
    `https://api.orca.so/v2/solana/pools?size=5&sortBy=tvl&sortDirection=desc&tokensBothOf=${SOL},${USDC}`,
  )) as { data?: Array<{ price?: string; tvlUsdc?: string | number; tokenMintA?: string; tokenMintB?: string }> };
  const row = (body.data || []).find((item) => {
    const pair = new Set([item.tokenMintA, item.tokenMintB]);
    return pair.has(SOL) && pair.has(USDC) && Number(item.price) > 0;
  });
  if (!row) return miss("orca", "Orca", "pool", "Orca did not return a SOL/USDC pool.");
  const raw = Number(row.price);
  const solPx = row.tokenMintA === SOL ? raw : raw > 0 ? 1 / raw : 0;
  if (!(solPx > 0)) return miss("orca", "Orca", "pool", "Orca did not price SOL.");
  const tvl = Number(row.tvlUsdc);
  return {
    id: "orca",
    name: "Orca",
    kind: "pool",
    ok: true,
    error: "",
    solPx,
    solOut: null,
    impactPct: null,
    tvl: tvl > 0 ? tvl : null,
    apy: null,
    note: "Pool print. Not a fill for this size.",
  };
}

async function meteora(): Promise<MoneyVenue> {
  const body = (await getJson(
    "https://pool-discovery-api.datapi.meteora.ag/pools?query=SOL-USDC&sort_by=tvl&page_size=8",
  )) as {
    data?: Array<{
      tvl?: number;
      pool_price?: number;
      token_x?: { address?: string };
      token_y?: { address?: string };
    }>;
  };
  const rows = (body.data || [])
    .filter((item) => {
      const pair = new Set([item.token_x?.address, item.token_y?.address]);
      return pair.has(SOL) && pair.has(USDC) && Number(item.pool_price) > 0 && Number(item.tvl) > 0;
    })
    .sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  const row = rows[0];
  if (!row) return miss("meteora", "Meteora", "pool", "Meteora did not return a SOL/USDC pool.");
  const raw = Number(row.pool_price);
  const solPx = row.token_x?.address === SOL ? raw : raw > 0 ? 1 / raw : 0;
  if (!(solPx > 0)) return miss("meteora", "Meteora", "pool", "Meteora did not price SOL.");
  return {
    id: "meteora",
    name: "Meteora",
    kind: "pool",
    ok: true,
    error: "",
    solPx,
    solOut: null,
    impactPct: null,
    tvl: Number(row.tvl) || null,
    apy: null,
    note: "Pool print. Not a fill for this size.",
  };
}

async function kamino(): Promise<MoneyVenue> {
  const rows = (await getJson(KAMINO)) as Array<{ liquidityToken?: string; supplyApy?: string; totalSupplyUsd?: string }>;
  const usdc = rows
    .filter((row) => row.liquidityToken === "USDC" && Number(row.totalSupplyUsd) > 0)
    .sort((a, b) => Number(b.totalSupplyUsd) - Number(a.totalSupplyUsd))[0];
  if (!usdc) return miss("kamino", "Kamino", "lend", "Kamino did not return a USDC reserve.");
  const apy = Number(usdc.supplyApy);
  return {
    id: "kamino",
    name: "Kamino",
    kind: "lend",
    ok: Number.isFinite(apy),
    error: Number.isFinite(apy) ? "" : "Kamino did not return a supply rate.",
    solPx: null,
    solOut: null,
    impactPct: null,
    tvl: Number(usdc.totalSupplyUsd) || null,
    apy: Number.isFinite(apy) ? apy : null,
    note: "Supply rate on the largest USDC reserve. Not a price for this size.",
  };
}

async function one(id: MoneyVenue["id"], usd: number): Promise<MoneyVenue> {
  try {
    if (id === "jupiter") return await jupiter(usd);
    if (id === "raydium") return await raydium();
    if (id === "orca") return await orca();
    if (id === "meteora") return await meteora();
    return await kamino();
  } catch (e) {
    const name = id === "jupiter" ? "Jupiter" : id === "raydium" ? "Raydium" : id === "orca" ? "Orca" : id === "meteora" ? "Meteora" : "Kamino";
    const kind = id === "jupiter" ? "router" : id === "kamino" ? "lend" : "pool";
    const message = e instanceof Error ? e.message : "did not answer";
    return miss(id, name, kind, `${name} ${message}`);
  }
}

/** Each venue is asked on its own. A refusal is kept. It is not stored as a zero price. */
export async function readVenues(usd: number): Promise<VenueTape> {
  const ids: MoneyVenue["id"][] = ["jupiter", "raydium", "orca", "meteora", "kamino"];
  const rows = await Promise.all(ids.map((id) => one(id, usd)));
  return { usd, rows };
}

export const readMoneyVenues = createServerFn({ method: "POST" })
  .validator(z.object({ usd: z.number().positive().max(5000) }))
  .handler(async ({ data }) => readVenues(data.usd));
