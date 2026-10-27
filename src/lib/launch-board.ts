/** Coins Jupiter marks as just created, including pump.fun. Phantom still signs the trade. */

import { createServerFn } from "@tanstack/react-start";

export type LaunchCoin = {
  mint: string;
  symbol: string;
  name: string;
  icon: string;
  price: number;
  mcap: number;
  pad: string;
  createdAt: string;
  chain: "Solana" | "Base";
  chainId: number;
  decimals: number;
};

export const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const loadLaunchBoard = createServerFn({ method: "GET" }).handler(async (): Promise<LaunchCoin[]> => {
  const [jup, clank] = await Promise.all([
    fetch("https://lite-api.jup.ag/tokens/v2/recent?limit=100", {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(12_000),
    }).then(async (res) => (res.ok ? ((await res.json()) as Array<{ id?: string; symbol?: string; name?: string; icon?: string; usdPrice?: number; mcap?: number; launchpad?: string; createdAt?: string; decimals?: number }>) : [])).catch(() => []),
    fetch("https://www.clanker.world/api/tokens?limit=20&sort=desc&sortBy=deployed-at", {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(12_000),
    }).then(async (res) => (res.ok ? ((await res.json()) as { data?: Array<{ contract_address?: string; symbol?: string; name?: string; chain_id?: number; img_url?: string; deployed_at?: string }> }) : { data: [] })).catch(() => ({ data: [] as Array<{ contract_address?: string; symbol?: string; name?: string; chain_id?: number; img_url?: string; deployed_at?: string }> })),
  ]);
  const rows: LaunchCoin[] = [];
  if (Array.isArray(jup)) {
    for (const row of jup) {
      const price = Number(row.usdPrice) || 0;
      if (!row.id || !row.symbol || !(price > 0)) continue;
      rows.push({
        mint: row.id,
        symbol: row.symbol,
        name: row.name || row.symbol,
        icon: row.icon || "",
        price,
        mcap: Number(row.mcap) || 0,
        pad: row.launchpad || "new",
        createdAt: row.createdAt || "",
        chain: "Solana",
        chainId: 7565164,
        decimals: row.decimals || 6,
      });
    }
  }
  for (const row of clank.data || []) {
    if (!row.contract_address || !row.symbol || row.chain_id !== 8453) continue;
    rows.push({
      mint: row.contract_address,
      symbol: row.symbol,
      name: row.name || row.symbol,
      icon: row.img_url || "",
      price: 0,
      mcap: 0,
      pad: "clanker",
      createdAt: row.deployed_at || "",
      chain: "Base",
      chainId: 8453,
      decimals: 18,
    });
  }
  return rows;
});

