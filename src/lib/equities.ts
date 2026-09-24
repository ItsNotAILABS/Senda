/** Listed tokenized equities (xStocks) and the Kamino market that lends against them. */

import { createServerFn } from "@tanstack/react-start";

export const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
export const KAMINO_MARKET = `https://kamino.com/markets/${XSTOCKS_MARKET}`;
const ASSETS = "https://api.xstocks.fi/api/v2/public/assets";
const METRICS = `https://api.kamino.finance/kamino-market/${XSTOCKS_MARKET}/reserves/metrics`;

export type ListedStock = {
  symbol: string;
  name: string;
  mint: string;
  open: boolean;
  halted: boolean;
  hours: string;
  period: string;
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

  const names = reserves.filter((r) => r.symbol !== "USDC");
  const stocks = await Promise.all(
    names.map(async (r): Promise<ListedStock> => {
      try {
        const res = await fetch(`${ASSETS}/${encodeURIComponent(r.symbol)}`, {
          headers: { accept: "application/json", "user-agent": "Senda" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const n = (await res.json()) as {
          name?: string;
          isTradingHalted?: boolean;
          trading?: { tradingHoursMode?: string; openNow?: boolean; currentPeriod?: string };
        };
        return {
          symbol: r.symbol,
          name: n.name || r.symbol,
          mint: r.mint,
          open: Boolean(n.trading?.openNow),
          halted: Boolean(n.isTradingHalted),
          hours: hoursLabel(n.trading?.tradingHoursMode),
          period: n.trading?.currentPeriod || "",
        };
      } catch {
        return { symbol: r.symbol, name: r.symbol, mint: r.mint, open: false, halted: false, hours: "24/5", period: "" };
      }
    }),
  );

  return { stocks, reserves };
}

export const getEquityBook = createServerFn({ method: "GET" }).handler(async () => fetchEquityBook());
