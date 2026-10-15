/** Listed tokenized equities (xStocks) and the Kamino market that lends against them. */

import { createServerFn } from "@tanstack/react-start";
import { FILL_PROBE_USD } from "@/lib/jup-fill.mjs";
import { fillableMints } from "@/lib/jup-exec";
import { mintDecimalsExact } from "@/lib/phantom";

export const XSTOCKS_MARKET = "5wJeMrUYECGq41fxRESKALVcHnNX26TAWy4W98yULsua";
export const KAMINO_MARKET = `https://kamino.com/markets/${XSTOCKS_MARKET}`;
const ASSETS = "https://api.xstocks.fi/api/v2/public/assets";
const METRICS = `https://api.kamino.finance/kamino-market/${XSTOCKS_MARKET}/reserves/metrics`;
const VERIFIED = "https://lite-api.jup.ag/tokens/v2/tag?query=verified";
const SEARCH = "https://lite-api.jup.ag/tokens/v2/search?query=xStock&limit=100";
const HEADERS = { accept: "application/json", "user-agent": "Senda" };
const CACHE_MS = 3 * 60_000;

/** PreStock SPVs. Same mints as the house seeds. Not shares of those companies. */
const PRE_IPO = [
  { symbol: "OPENAI", name: "OpenAI", mint: "PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF" },
  { symbol: "SPACEX", name: "SpaceX", mint: "PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh" },
] as const;

export type ListedStock = {
  symbol: string;
  name: string;
  mint: string;
  open: boolean;
  halted: boolean;
  hours: string;
  period: string;
  /** xStock is a tokenized equity. spv is PreStock exposure, not a share. */
  kind: "xstock" | "spv";
  decimals: number;
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

export type EquityBook = {
  stocks: ListedStock[];
  reserves: StockReserve[];
  /** Unhalted xStocks catalog rows that have a Solana mint. Null when that catalog did not load. */
  universe: number | null;
  probeUsd: number;
};

type CatalogNode = {
  symbol?: string;
  name?: string;
  isTradingHalted?: boolean;
  trading?: { tradingHoursMode?: string; openNow?: boolean; currentPeriod?: string };
  deployments?: Array<{ network?: string; address?: string }>;
};

type CatalogMeta = {
  symbol: string;
  name: string;
  open: boolean;
  halted: boolean;
  hours: string;
  period: string;
};

type JupToken = { id?: string; symbol?: string; name?: string; decimals?: number; tags?: string[] };

let bookCache: { at: number; book: EquityBook } | null = null;
let inflight: Promise<EquityBook> | null = null;

function hoursLabel(mode: string | undefined): string {
  if (mode === "TwentyFourFive") return "24/5";
  if (mode === "TwentyFourSeven") return "24/7";
  return mode || "session";
}

function solanaMint(node: CatalogNode): string | null {
  for (const dep of node.deployments || []) {
    if (String(dep.network || "").toLowerCase() === "solana" && dep.address) return dep.address;
  }
  return null;
}

function takeTagged(rows: unknown, into: Map<string, { symbol: string; name: string; decimals: number }>) {
  if (!Array.isArray(rows)) return;
  for (const row of rows as JupToken[]) {
    if (!row?.id || !row.symbol || !row.tags?.includes("xstocks")) continue;
    into.set(row.id, {
      symbol: row.symbol,
      name: row.name || row.symbol,
      decimals: Number.isInteger(row.decimals) ? (row.decimals as number) : 8,
    });
  }
}

async function jupiterXStocks(): Promise<Map<string, { symbol: string; name: string; decimals: number }>> {
  const into = new Map<string, { symbol: string; name: string; decimals: number }>();
  const [verified, search] = await Promise.all([
    fetch(VERIFIED, { headers: HEADERS }),
    fetch(SEARCH, { headers: HEADERS }),
  ]);
  if (verified.ok) takeTagged(await verified.json(), into);
  if (search.ok) takeTagged(await search.json(), into);
  if (into.size === 0) throw new Error("Jupiter xStocks list did not load.");
  return into;
}

async function unhaltedCatalog(): Promise<{ universe: number; byMint: Map<string, CatalogMeta> }> {
  const byMint = new Map<string, CatalogMeta>();
  let universe = 0;
  for (let page = 0; page < 40; page += 1) {
    const res = await fetch(`${ASSETS}?isTradingHalted=false&page=${page}&pageSize=100`, { headers: HEADERS });
    if (!res.ok) throw new Error(`xStocks ${res.status}`);
    const body = (await res.json()) as { nodes?: CatalogNode[]; page?: { hasNextPage?: boolean } };
    const nodes = body.nodes || [];
    for (const node of nodes) {
      const mint = solanaMint(node);
      if (!mint) continue;
      universe += 1;
      byMint.set(mint, {
        symbol: node.symbol || mint.slice(0, 4),
        name: node.name || node.symbol || mint.slice(0, 4),
        open: Boolean(node.trading?.openNow),
        halted: Boolean(node.isTradingHalted),
        hours: hoursLabel(node.trading?.tradingHoursMode),
        period: node.trading?.currentPeriod || "",
      });
    }
    if (!body.page?.hasNextPage || nodes.length === 0) break;
  }
  return { universe, byMint };
}

async function kaminoReserves(): Promise<StockReserve[]> {
  const metricsRes = await fetch(METRICS, { headers: HEADERS });
  if (!metricsRes.ok) return [];
  const metrics = (await metricsRes.json()) as Array<{
    liquidityToken?: string;
    liquidityTokenMint?: string;
    maxLtv?: string;
    borrowApy?: string;
    supplyApy?: string;
    totalSupplyUsd?: string;
    totalBorrowUsd?: string;
  }>;
  return metrics
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
}

async function buildEquityBook(): Promise<EquityBook> {
  const [reserves, tagged, catalog] = await Promise.all([
    kaminoReserves(),
    jupiterXStocks(),
    unhaltedCatalog().catch(() => null),
  ]);
  const candidates = [...tagged.keys()].filter((mint) => (catalog ? catalog.byMint.has(mint) : true));
  const fillable = await fillableMints(candidates, FILL_PROBE_USD);
  const stocks: ListedStock[] = candidates
    .filter((mint) => fillable.has(mint))
    .map((mint) => {
      const token = tagged.get(mint)!;
      const meta = catalog?.byMint.get(mint);
      return {
        symbol: meta?.symbol || token.symbol,
        name: meta?.name || token.name,
        mint,
        open: meta?.open ?? false,
        halted: false,
        hours: meta?.hours || "session",
        period: meta?.period || "",
        kind: "xstock" as const,
        decimals: token.decimals,
      };
    })
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  const spvFill = await fillableMints(PRE_IPO.map((row) => row.mint), FILL_PROBE_USD);
  for (const row of PRE_IPO) {
    if (!spvFill.has(row.mint)) continue;
    const decimals = (await mintDecimalsExact(row.mint)) ?? 6;
    stocks.push({
      symbol: row.symbol,
      name: row.name,
      mint: row.mint,
      open: true,
      halted: false,
      hours: "SPV",
      period: "",
      kind: "spv",
      decimals,
    });
  }

  return { stocks, reserves, universe: catalog?.universe ?? null, probeUsd: FILL_PROBE_USD };
}

export async function fetchEquityBook(): Promise<EquityBook> {
  if (bookCache && Date.now() - bookCache.at < CACHE_MS) return bookCache.book;
  if (!inflight) {
    inflight = buildEquityBook()
      .then((book) => {
        bookCache = { at: Date.now(), book };
        return book;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export const getEquityBook = createServerFn({ method: "GET" }).handler(async () => fetchEquityBook());
