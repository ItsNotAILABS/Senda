/** Listed tokenized equities (xStocks) and the Kamino market that lends against them. */

import { createServerFn } from "@tanstack/react-start";

export const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
export const KAMINO_MARKET = `https://kamino.com/markets/${XSTOCKS_MARKET}`;
const ASSETS = "https://api.xstocks.fi/api/v2/public/assets";
const METRICS = `https://api.kamino.finance/kamino-market/${XSTOCKS_MARKET}/reserves/metrics`;
const LIST_TTL_MS = 5 * 60 * 1000;

type AssetNode = {
  symbol?: string;
  name?: string;
  isTradingHalted?: boolean;
  trading?: { tradingHoursMode?: string; openNow?: boolean; currentPeriod?: string };
  deployments?: Array<{ network?: string; address?: string }>;
};

let listCache: { at: number; rows: ListedStock[] } | null = null;

function solAddress(node: AssetNode): string {
  const row = (node.deployments ?? []).find((d) => d.network === "Solana" && (d.address?.length ?? 0) >= 32);
  return row?.address ?? "";
}

/** One paged catalog. Do not request each symbol. Those calls 404. */
export async function listSolanaXStocks(): Promise<ListedStock[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.rows;
  const rows: ListedStock[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${ASSETS}?page=${page}`, { headers: { accept: "application/json", "user-agent": "Senda" } });
    if (!res.ok) break;
    const body = (await res.json()) as { nodes?: AssetNode[]; page?: { hasNextPage?: boolean } };
    for (const node of body.nodes ?? []) {
      const mint = solAddress(node);
      const symbol = node.symbol || "";
      if (!mint || !symbol || seen.has(mint)) continue;
      seen.add(mint);
      rows.push({
        symbol,
        name: node.name || symbol,
        mint,
        open: Boolean(node.trading?.openNow),
        halted: Boolean(node.isTradingHalted),
        hours: hoursLabel(node.trading?.tradingHoursMode),
        period: node.trading?.currentPeriod || "",
      });
    }
    if (!body.page?.hasNextPage) break;
  }
  if (rows.length) listCache = { at: Date.now(), rows };
  return rows;
}

export type ListedStock = {
  symbol: string;
  name: string;
  mint: string;
  open: boolean;
  halted: boolean;
  hours: string;
  period: string;
  impactPct?: number;
  route?: string;
};

export type StockReserve = {
  symbol: string;
  mint: string;
  maxLtv: number;
  borrowApy: number;
  supplyApy: number;
  supplyUsd: number;
  borrowUsd: number;
};

export type EquityBook = { stocks: ListedStock[]; reserves: StockReserve[] };

function hoursLabel(mode: string | undefined): string {
  if (mode === "TwentyFourFive") return "24/5";
  if (mode === "TwentyFourSeven") return "24/7";
  return mode || "session";
}

export async function fetchEquityBook(): Promise<EquityBook> {
  const metricsRes = await fetch(METRICS, { headers: { accept: "application/json", "user-agent": "Senda" } });
  if (!metricsRes.ok) throw new Error(`Kamino ${metricsRes.status}`);
  const metrics = (await metricsRes.json()) as Array<{
    liquidityToken?: string;
    liquidityTokenMint?: string;
    maxLtv?: string;
    borrowApy?: string;
    supplyApy?: string;
    totalSupplyUsd?: string;
    totalBorrowUsd?: string;
  }>;
  const reserves: StockReserve[] = metrics
    .filter((m) => m.liquidityToken && m.liquidityTokenMint)
    .map((m) => ({
      symbol: m.liquidityToken as string,
      mint: m.liquidityTokenMint as string,
      maxLtv: Number(m.maxLtv) || 0,
      borrowApy: Number(m.borrowApy) || 0,
      supplyApy: Number(m.supplyApy) || 0,
      supplyUsd: Number(m.totalSupplyUsd) || 0,
      borrowUsd: Number(m.totalBorrowUsd) || 0,
    }));

  const stocks = await listSolanaXStocks();

  return { stocks, reserves };
}

export const getEquityBook = createServerFn({ method: "GET" }).handler(async () => fetchEquityBook());
