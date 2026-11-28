/** Twenty Solana protocols Senda did not already run. Rates are the live pools, not a guess. */

import { createServerFn } from "@tanstack/react-start";

export type Rail = {
  id: string;
  name: string;
  line: string;
  mint?: string;
  symbol?: string;
};

export const RAILS: Rail[] = [
  { id: "sanctum-infinity", name: "Sanctum", line: "LST basket. Swap SOL into INF.", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", symbol: "INF" },
  { id: "blazestake", name: "BlazeStake", line: "Staked SOL. Swap into bSOL.", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", symbol: "bSOL" },
  { id: "jpool", name: "JPool", line: "Stake pool. Swap into JSOL.", mint: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn", symbol: "JSOL" },
  { id: "helius-staked-sol", name: "Helius", line: "Validator stake. Swap into hSOL.", mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A", symbol: "hSOL" },
  { id: "jupiter-staked-sol", name: "JupSOL", line: "Jupiter's stake pool. Swap into JupSOL.", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", symbol: "JupSOL" },
  { id: "binance-staked-sol", name: "Binance SOL", line: "bnSOL stake rate." },
  { id: "bybit-staked-sol", name: "Bybit SOL", line: "bbSOL stake rate." },
  { id: "phantom-sol", name: "Phantom SOL", line: "pSOL stake rate." },
  { id: "the-vault-liquid-staking", name: "The Vault", line: "vSOL stake rate." },
  { id: "drift-staked-sol", name: "Drift stake", line: "dSOL stake rate. Not the perp book." },
  { id: "save", name: "Save", line: "Lending. The USDC supply rate." },
  { id: "loopscale-lending", name: "Loopscale", line: "Order-book lending." },
  { id: "onre", name: "OnRe", line: "Reinsurance yield, ONYC." },
  { id: "hastra", name: "Hastra", line: "AUTO yield." },
  { id: "blackrock-buidl", name: "BUIDL", line: "BlackRock's tokenized fund on Solana." },
  { id: "ondo-yield-assets", name: "Ondo", line: "USDY yield." },
  { id: "apollo-diversified-credit-securitize-fund", name: "Apollo", line: "ACRED credit fund." },
  { id: "vaneck-treasury-fund", name: "VanEck", line: "VBILL treasury fund." },
  { id: "plume-vaults", name: "Plume", line: "Vault yield." },
  { id: "kyros", name: "Kyros", line: "kySOL stake rate." },
];

export type LiveRail = Rail & { tvl: number; apy: number; pool: string };

type Pool = { project?: string; chain?: string; tvlUsd?: number; apy?: number; symbol?: string };

export function headlineRails(pools: Pool[]): LiveRail[] {
  return RAILS.map((rail) => {
    const rows = pools.filter((row) => row.project === rail.id && row.chain === "Solana" && (row.tvlUsd || 0) > 0);
    if (!rows.length) return null;
    const tvl = rows.reduce((sum, row) => sum + (row.tvlUsd || 0), 0);
    const top = [...rows].sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))[0];
    return { ...rail, tvl, apy: Number(top.apy) || 0, pool: top.symbol || rail.symbol || "" };
  }).filter((row): row is LiveRail => Boolean(row));
}

export async function fetchRails(): Promise<LiveRail[]> {
  const res = await fetch("https://yields.llama.fi/pools", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Rates ${res.status}`);
  const body = (await res.json()) as { data?: Pool[] };
  return headlineRails(body.data ?? []);
}

export const solanaRails = createServerFn({ method: "GET" }).handler(async () => fetchRails());
