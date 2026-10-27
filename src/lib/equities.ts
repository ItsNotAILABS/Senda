/** Listed tokenized equities (xStocks) and the Kamino market that lends against them. */

import { createServerFn } from "@tanstack/react-start";
import { fetchStockFlow } from "@/lib/stock-flow";

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
  kind: "etf" | "stock";
  /** Jupiter 24h pool volume, in dollars. Zero means it was not in the live flow. */
  volume: number;
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

function kindOf(name: string, symbol: string): "etf" | "stock" {
  if (/ETF|Fund|Trust|Index|iShares|SPDR|Invesco|Vanguard|ProShares|Direxion|GraniteShares|Roundhill|Global X|Sprott|Leverage Shares|2X|3X|Ultra/i.test(name)) return "etf";
  if (/^(SPY|QQQ|SQQQ|TQQQ|IWM|DIA|VTI|VOO|GLD|SLV|TLT|USO|EEM|ARKK|XBI|EWZ|EWJ|EWT)/.test(symbol.replace(/x$/i, ""))) return "etf";
  return "stock";
}

type CatalogNode = {
  symbol?: string;
  name?: string;
  isTradingHalted?: boolean;
  trading?: { tradingHoursMode?: string; openNow?: boolean; currentPeriod?: string };
  deployments?: { network?: string; address?: string }[];
};

async function solanaCatalog(): Promise<ListedStock[]> {
  const out: ListedStock[] = [];
  const seen = new Set<string>();
  let page = 0;
  while (page < 40) {
    const batch = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        fetch(`${ASSETS}?page=${page + i}`, { headers: { accept: "application/json", "user-agent": "Senda" } })
          .then(async (res) => (res.ok ? ((await res.json()) as { nodes?: CatalogNode[]; page?: { hasNextPage?: boolean } }) : null))
          .catch(() => null),
      ),
    );
    let more = false;
    let empty = true;
    for (const body of batch) {
      if (!body) continue;
      empty = false;
      if (body.page?.hasNextPage) more = true;
      for (const n of body.nodes || []) {
        const sol = n.deployments?.find((d) => d.network === "Solana" && d.address);
        if (!sol?.address || seen.has(sol.address)) continue;
        seen.add(sol.address);
        const symbol = n.symbol || sol.address.slice(0, 4);
        const name = n.name || symbol;
        out.push({
          symbol,
          name,
          mint: sol.address,
          open: Boolean(n.trading?.openNow),
          halted: Boolean(n.isTradingHalted),
          hours: hoursLabel(n.trading?.tradingHoursMode),
          period: n.trading?.currentPeriod || "",
          kind: kindOf(name, symbol),
          volume: 0,
        });
      }
    }
    if (empty || !more) break;
    page += 4;
  }
  return out;
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
  const listed = await solanaCatalog();
  const bySymbol = new Set(listed.map((s) => s.symbol));
  const extra = names
    .filter((r) => !bySymbol.has(r.symbol))
    .map((r): ListedStock => ({
      symbol: r.symbol,
      name: r.symbol,
      mint: r.mint,
      open: false,
      halted: false,
      hours: "24/5",
      period: "",
      kind: kindOf(r.symbol, r.symbol),
      volume: 0,
    }));
  const flow = await fetchStockFlow().catch(() => []);
  const vol = new Map(flow.map((row) => [row.mint, row.volume]));
  const have = new Set(listed.map((s) => s.mint));
  for (const row of flow) {
    if (have.has(row.mint)) continue;
    listed.push({
      symbol: row.symbol,
      name: row.name,
      mint: row.mint,
      open: true,
      halted: false,
      hours: "24/5",
      period: "",
      kind: row.kind,
      volume: row.volume,
    });
  }
  const stocks = [...listed, ...extra]
    .map((s) => ({ ...s, volume: vol.get(s.mint) || s.volume || 0 }))
    .sort((a, b) => {
      if (a.halted !== b.halted) return a.halted ? 1 : -1;
      if (b.volume !== a.volume) return b.volume - a.volume;
      if (a.open !== b.open) return a.open ? -1 : 1;
      return a.symbol.localeCompare(b.symbol);
    });
  return { stocks, reserves };
}

export const getEquityBook = createServerFn({ method: "GET" }).handler(async () => fetchEquityBook());
