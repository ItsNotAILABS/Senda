/** The same product on more than one listing. A gap is not a trade until both sides can be signed. */

import { createServerFn } from "@tanstack/react-start";

export type Listing = {
  label: string;
  chain: string;
  chainId: number;
  address: string;
  decimals: number;
  pay: string;
  payDecimals: number;
  signs: boolean;
  price: number | null;
  dex: string;
};

export type TwoProduct = {
  id: string;
  symbol: string;
  name: string;
  note: string;
  listings: Listing[];
  gapBps: number | null;
};

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PAY: Record<number, { pay: string; payDecimals: number; chain: string }> = {
  1: { pay: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", payDecimals: 6, chain: "Ethereum" },
  56: { pay: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", payDecimals: 18, chain: "BNB" },
};

const WRAPS: { symbol: string; name: string; mint: string; decimals: number; binance: string }[] = [
  { symbol: "BTC", name: "Bitcoin", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, binance: "BTCUSDT" },
  { symbol: "ETH", name: "Ether", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, binance: "ETHUSDT" },
  { symbol: "SOL", name: "Solana", mint: "So11111111111111111111111111111111111111112", decimals: 9, binance: "SOLUSDT" },
  { symbol: "XRP", name: "XRP", mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2", decimals: 6, binance: "XRPUSDT" },
  { symbol: "SUI", name: "Sui", mint: "suifhC9gU1VbJAPYPTBkHJyyyStKGLLYPVDTmPoqbvA", decimals: 8, binance: "SUIUSDT" },
  { symbol: "NEAR", name: "NEAR", mint: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG", decimals: 9, binance: "NEARUSDT" },
  { symbol: "DOGE", name: "Dogecoin", mint: "DoGEV7LASBkQbibMc5k5vKnTZoMg423GpJ5QtJEGfm7R", decimals: 8, binance: "DOGEUSDT" },
  { symbol: "BNB", name: "BNB", mint: "9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa", decimals: 8, binance: "BNBUSDT" },
  { symbol: "AVAX", name: "Avalanche", mint: "KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE", decimals: 8, binance: "AVAXUSDT" },
];

const WANT = ["AAPLon", "TSLAon", "NVDAon", "MSFTon", "GOOGLon", "AMZNon", "METAon", "SPYon", "QQQon", "COINon"];

type Pair = { priceUsd?: string; chainId?: string; dexId?: string; liquidity?: { usd?: number }; baseToken?: { address?: string } };

function gapOf(prices: Array<number | null>): number | null {
  const live = prices.filter((n): n is number => n != null && n > 0);
  if (live.length < 2) return null;
  const hi = Math.max(...live);
  const lo = Math.min(...live);
  if (!(lo > 0)) return null;
  return Math.round(((hi - lo) / lo) * 10_000);
}

async function dexPrices(chain: string, addresses: string[]): Promise<Map<string, { price: number; dex: string; liq: number }>> {
  const out = new Map<string, { price: number; dex: string; liq: number }>();
  if (!addresses.length) return out;
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${addresses.join(",")}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!res?.ok) return out;
  const rows = (await res.json()) as Pair[];
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    const address = row.baseToken?.address;
    const price = Number(row.priceUsd);
    if (!address || !(price > 0)) continue;
    const id = chain === "solana" ? address : address.toLowerCase();
    const prev = out.get(id);
    if (!prev || (row.liquidity?.usd || 0) > prev.liq) out.set(id, { price, dex: row.dexId || chain, liq: row.liquidity?.usd || 0 });
  }
  return out;
}

async function binance(symbols: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(symbols))}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!res?.ok) return out;
  const rows = (await res.json()) as Array<{ symbol?: string; price?: string }>;
  for (const row of rows) {
    const price = Number(row.price);
    if (row.symbol && price > 0) out.set(row.symbol, price);
  }
  return out;
}

async function ostium(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const res = await fetch("https://builder.prod.bedrock.ostium.io/v1/prices", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  if (!res?.ok) return out;
  const body = (await res.json()) as { prices?: Array<{ pair?: string; mid?: number }> };
  for (const row of body.prices || []) {
    if (row.pair && Number(row.mid) > 0) out.set(row.pair, Number(row.mid));
  }
  return out;
}

async function ondoBoth(): Promise<Array<{ symbol: string; name: string; eth: string; bnb: string; decimals: number }>> {
  const res = await fetch("https://raw.githubusercontent.com/ondoprotocol/ondo-global-markets-token-list/main/tokenlist.json", {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const body = (await res.json()) as { tokens?: Array<{ chainId?: number; address?: string; symbol?: string; name?: string; decimals?: number }> };
  const by = new Map<string, { name: string; eth?: string; bnb?: string; decimals: number }>();
  for (const tok of body.tokens || []) {
    if (!tok.symbol || !tok.address) continue;
    const row = by.get(tok.symbol) || { name: tok.name || tok.symbol, decimals: tok.decimals || 18 };
    if (tok.chainId === 1) row.eth = tok.address;
    if (tok.chainId === 56) row.bnb = tok.address;
    by.set(tok.symbol, row);
  }
  const both = [...by.entries()].filter(([, row]) => row.eth && row.bnb);
  both.sort((a, b) => WANT.indexOf(a[0]) - WANT.indexOf(b[0]) || a[0].localeCompare(b[0]));
  const ranked = both.sort((a, b) => {
    const ai = WANT.indexOf(a[0]);
    const bi = WANT.indexOf(b[0]);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  return ranked.slice(0, 20).map(([symbol, row]) => ({ symbol, name: row.name, eth: row.eth || "", bnb: row.bnb || "", decimals: row.decimals }));
}

async function xstockBoth(): Promise<Array<{ symbol: string; name: string; sol: string; eth: string }>> {
  const res = await fetch("https://api.xstocks.fi/api/v2/public/assets?page=0", {
    headers: { accept: "application/json", "user-agent": "Senda" },
    signal: AbortSignal.timeout(12_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const body = (await res.json()) as { nodes?: Array<{ symbol?: string; name?: string; deployments?: Array<{ network?: string; address?: string }> }> };
  const rows: Array<{ symbol: string; name: string; sol: string; eth: string }> = [];
  for (const node of body.nodes || []) {
    const sol = node.deployments?.find((d) => d.network === "Solana")?.address;
    const eth = node.deployments?.find((d) => d.network === "Ethereum")?.address;
    if (!node.symbol || !sol || !eth) continue;
    rows.push({ symbol: node.symbol, name: node.name || node.symbol, sol, eth });
    if (rows.length >= 12) break;
  }
  return rows;
}

function listing(input: Omit<Listing, "price" | "dex"> & { price: number | null; dex: string }): Listing {
  return input;
}

export const loadTwoListings = createServerFn({ method: "GET" }).handler(async (): Promise<TwoProduct[]> => {
  const [ondo, xs, spot, marks, perps] = await Promise.all([
    ondoBoth(),
    xstockBoth(),
    dexPrices("solana", [...WRAPS.map((w) => w.mint)]),
    binance(WRAPS.map((w) => w.binance)),
    ostium(),
  ]);
  const [ethPx, bnbPx, xSol] = await Promise.all([
    dexPrices("ethereum", [...ondo.map((r) => r.eth), ...xs.map((r) => r.eth)]),
    dexPrices("bsc", ondo.map((r) => r.bnb)),
    dexPrices("solana", xs.map((r) => r.sol)),
  ]);

  const products: TwoProduct[] = [];
  for (const row of WRAPS) {
    const token = spot.get(row.mint);
    const ref = marks.get(row.binance) ?? null;
    const perp = perps.get(`${row.symbol}-USD`) ?? null;
    const listings: Listing[] = [
      listing({ label: "Solana token", chain: "Solana", chainId: 7565164, address: row.mint, decimals: row.decimals, pay: USDC, payDecimals: 6, signs: true, price: token?.price ?? null, dex: token?.dex || "solana" }),
      listing({ label: "Binance", chain: "Reference", chainId: 0, address: "", decimals: 0, pay: "", payDecimals: 0, signs: false, price: ref, dex: "binance" }),
    ];
    if (perp) listings.push(listing({ label: "Ostium perp", chain: "Arbitrum", chainId: 42161, address: "", decimals: 0, pay: "", payDecimals: 0, signs: false, price: perp, dex: "ostium" }));
    products.push({
      id: `wrap:${row.symbol}`,
      symbol: row.symbol,
      name: row.name,
      note: "The Solana token can be signed. Binance and the perp cannot, from this row. The gap is not a locked trade.",
      listings,
      gapBps: gapOf(listings.map((item) => item.price)),
    });
  }
  for (const row of ondo) {
    const eth = ethPx.get(row.eth.toLowerCase());
    const bnb = bnbPx.get(row.bnb.toLowerCase());
    const listings: Listing[] = [
      listing({ label: "Ondo", chain: "Ethereum", chainId: 1, address: row.eth, decimals: row.decimals, pay: PAY[1].pay, payDecimals: PAY[1].payDecimals, signs: true, price: eth?.price ?? null, dex: eth?.dex || "ethereum" }),
      listing({ label: "Ondo", chain: "BNB", chainId: 56, address: row.bnb, decimals: row.decimals, pay: PAY[56].pay, payDecimals: PAY[56].payDecimals, signs: true, price: bnb?.price ?? null, dex: bnb?.dex || "bsc" }),
    ];
    products.push({
      id: `ondo:${row.symbol}`,
      symbol: row.symbol,
      name: row.name,
      note: "Same Ondo token, two chains. Both can be signed. It is not the xStocks token and not the share.",
      listings,
      gapBps: gapOf(listings.map((item) => item.price)),
    });
  }
  for (const row of xs) {
    const sol = xSol.get(row.sol);
    const eth = ethPx.get(row.eth.toLowerCase());
    const listings: Listing[] = [
      listing({ label: "xStocks", chain: "Solana", chainId: 7565164, address: row.sol, decimals: 8, pay: USDC, payDecimals: 6, signs: true, price: sol?.price ?? null, dex: sol?.dex || "solana" }),
      listing({ label: "xStocks", chain: "Ethereum", chainId: 1, address: row.eth, decimals: 18, pay: PAY[1].pay, payDecimals: PAY[1].payDecimals, signs: true, price: eth?.price ?? null, dex: eth?.dex || "ethereum" }),
    ];
    products.push({
      id: `xstocks:${row.symbol}`,
      symbol: row.symbol,
      name: row.name,
      note: "Same xStocks token, two chains. Both can be signed. It is not the Ondo token.",
      listings,
      gapBps: gapOf(listings.map((item) => item.price)),
    });
  }
  return products.sort((a, b) => (b.gapBps ?? -1) - (a.gapBps ?? -1));
});
