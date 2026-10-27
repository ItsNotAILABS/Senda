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
};

export const loadLaunchBoard = createServerFn({ method: "GET" }).handler(async (): Promise<LaunchCoin[]> => {
  const res = await fetch("https://lite-api.jup.ag/tokens/v2/recent?limit=100", {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Launch board ${res.status}`);
  const body = (await res.json()) as Array<{
    id?: string;
    symbol?: string;
    name?: string;
    icon?: string;
    usdPrice?: number;
    mcap?: number;
    launchpad?: string;
    createdAt?: string;
  }>;
  if (!Array.isArray(body)) return [];
  const rows: LaunchCoin[] = [];
  for (const row of body) {
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
    });
  }
  return rows;
});
