/** Open Kamino rates. Not the announced BLSH market, and nothing here signs. */

import { createServerFn } from "@tanstack/react-start";
import { XSTOCKS_MARKET } from "@/lib/equities";

const MAIN = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

export type LendRow = {
  symbol: string;
  market: "xStocks" | "Main";
  supplyApy: number;
  borrowApy: number;
  maxLtv: number;
  supplyUsd: number;
};

async function pull(market: string, name: LendRow["market"]): Promise<LendRow[]> {
  const res = await fetch(`https://api.kamino.finance/kamino-market/${market}/reserves/metrics`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Kamino ${res.status}`);
  const rows = (await res.json()) as Array<{
    liquidityToken?: string;
    maxLtv?: string;
    borrowApy?: string;
    supplyApy?: string;
    totalSupplyUsd?: string;
  }>;
  return rows
    .filter((row) => row.liquidityToken)
    .map((row) => ({
      symbol: row.liquidityToken as string,
      market: name,
      supplyApy: Number(row.supplyApy) || 0,
      borrowApy: Number(row.borrowApy) || 0,
      maxLtv: Number(row.maxLtv) || 0,
      supplyUsd: Number(row.totalSupplyUsd) || 0,
    }))
    .sort((a, b) => b.supplyUsd - a.supplyUsd);
}

export const openLend = createServerFn({ method: "GET" }).handler(async () => {
  const [stocks, main] = await Promise.all([
    pull(XSTOCKS_MARKET, "xStocks").catch(() => [] as LendRow[]),
    pull(MAIN, "Main").catch(() => [] as LendRow[]),
  ]);
  const blsh = [...stocks, ...main].some((row) => row.symbol.toUpperCase().includes("BLSH"));
  return {
    stocks: stocks.slice(0, 8),
    usdc: main.find((row) => row.symbol === "USDC") ?? null,
    blsh,
    answered: stocks.length > 0 || main.length > 0,
    note: blsh
      ? "A symbol containing BLSH is on Kamino. That is not Jupiter Lend’s permissioned market, and this desk will not borrow it."
      : "BLSH is not on this Kamino book. Jupiter Lend’s market for it was announced and is not open.",
  };
});
