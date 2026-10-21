/** Listed tokenized equities (xStocks) and the Kamino market that lends against them. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
  underlying: string;
  exchange: string;
  isin: string;
  nextChange: string;
  minOrder: number;
  maxOrder: number;
  logo: string;
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

type AssetNode = {
  name?: string;
  symbol?: string;
  isin?: string;
  underlyingSymbol?: string;
  logo?: string;
  isTradingHalted?: boolean;
  trading?: {
    tradingHoursMode?: string;
    openNow?: boolean;
    currentPeriod?: string;
    nextChangeAt?: string;
    exchange?: { abbreviation?: string };
    limitsPerPeriod?: Record<string, { minOrderFiatValue?: number; maxOrderFiatValue?: number }>;
  };
  deployments?: Array<{ network?: string; address?: string }>;
};

function stockFromNode(n: AssetNode, fallbackMint: string): ListedStock | null {
  const sol = n.deployments?.find((d) => d.network === "Solana" && d.address);
  const mint = sol?.address || fallbackMint;
  if (!n.symbol || !mint) return null;
  const period = n.trading?.currentPeriod || "";
  const limits = n.trading?.limitsPerPeriod?.[period];
  return {
    symbol: n.symbol,
    name: n.name || n.symbol,
    mint,
    open: Boolean(n.trading?.openNow),
    halted: Boolean(n.isTradingHalted),
    hours: hoursLabel(n.trading?.tradingHoursMode),
    period,
    underlying: n.underlyingSymbol || "",
    exchange: n.trading?.exchange?.abbreviation || "",
    isin: n.isin || "",
    nextChange: n.trading?.nextChangeAt || "",
    minOrder: Number(limits?.minOrderFiatValue) || 0,
    maxOrder: Number(limits?.maxOrderFiatValue) || 0,
    logo: n.logo || "",
  };
}

export async function fetchEquityBook(): Promise<EquityBook> {
  const [metricsRes, assetsRes] = await Promise.all([
    fetch(METRICS, { headers: { accept: "application/json", "user-agent": "Senda" } }),
    fetch(ASSETS, { headers: { accept: "application/json", "user-agent": "Senda" } }),
  ]);
  if (!metricsRes.ok) throw new Error(`Kamino ${metricsRes.status}`);
  if (!assetsRes.ok) throw new Error(`xStocks ${assetsRes.status}`);
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

  const body = (await assetsRes.json()) as { nodes?: AssetNode[] } | AssetNode[];
  const nodes = Array.isArray(body) ? body : body.nodes || [];
  const bySymbol = new Map<string, ListedStock>();
  for (const node of nodes) {
    const row = stockFromNode(node, "");
    if (row) bySymbol.set(row.symbol, row);
  }
  for (const r of reserves) {
    if (r.symbol === "USDC" || bySymbol.has(r.symbol)) continue;
    bySymbol.set(r.symbol, {
      symbol: r.symbol,
      name: r.symbol,
      mint: r.mint,
      open: false,
      halted: false,
      hours: "24/5",
      period: "",
      underlying: "",
      exchange: "",
      isin: "",
      nextChange: "",
      minOrder: 0,
      maxOrder: 0,
      logo: "",
    });
  }
  const stocks = [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  return { stocks, reserves };
}

export const getEquityBook = createServerFn({ method: "GET" }).handler(async () => {
  const book = await fetchEquityBook();
  try {
    const { registerOfferings } = await import("./offering-book");
    await registerOfferings(
      book.stocks
        .filter((row) => row.mint && row.symbol)
        .map((row) => ({
          id: `listed:${row.mint}`,
          family: "listed",
          symbol: row.symbol,
          name: row.name || row.symbol,
          chain: "Solana",
          mint: row.mint,
          venue: "xStock",
          signPath: "jupiter",
          status: row.open ? "open" : "listed",
          note: row.open ? "A listed share. The wallet signs." : "Listed, not open for a swap right now.",
        })),
    );
  } catch {
    /* The equity book still returns. */
  }
  return book;
});

/** Jupiter last for listed mints. Used to price a digital the same way a PreStock last does. */
export const listedMarks = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.array(z.string().min(32).max(48)).max(30).parse(input))
  .handler(async ({ data }) => {
    const r = await fetch(`https://api.jup.ag/price/v3?ids=${data.join(",")}`, {
      headers: { accept: "application/json", "user-agent": "Senda" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return {} as Record<string, number>;
    const raw = (await r.json()) as Record<string, { usdPrice?: number }>;
    const out: Record<string, number> = {};
    for (const mint of data) {
      const n = Number(raw[mint]?.usdPrice);
      if (n > 0) out[mint] = n;
    }
    return out;
  });
