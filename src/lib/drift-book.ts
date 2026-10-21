/** Drift's Solana perp book. Prices are CoinGecko. SOL, ETH, and BTC are the ones this app can sign. */

import { createServerFn } from "@tanstack/react-start";

type Row = { symbol: string; index: number; gecko?: string; sign?: "SOL" | "ETH" | "BTC" };

const BOOK: Row[] = [
  { symbol: "SOL", index: 0, gecko: "solana", sign: "SOL" },
  { symbol: "BTC", index: 1, gecko: "bitcoin", sign: "BTC" },
  { symbol: "ETH", index: 2, gecko: "ethereum", sign: "ETH" },
  { symbol: "APT", index: 3, gecko: "aptos" },
  { symbol: "1MBONK", index: 4, gecko: "bonk" },
  { symbol: "POL", index: 5, gecko: "polygon-ecosystem-token" },
  { symbol: "ARB", index: 6, gecko: "arbitrum" },
  { symbol: "DOGE", index: 7, gecko: "dogecoin" },
  { symbol: "BNB", index: 8, gecko: "binancecoin" },
  { symbol: "SUI", index: 9, gecko: "sui" },
  { symbol: "1MPEPE", index: 10, gecko: "pepe" },
  { symbol: "OP", index: 11, gecko: "optimism" },
  { symbol: "RENDER", index: 12, gecko: "render-token" },
  { symbol: "XRP", index: 13, gecko: "ripple" },
  { symbol: "HNT", index: 14, gecko: "helium" },
  { symbol: "INJ", index: 15, gecko: "injective-protocol" },
  { symbol: "LINK", index: 16, gecko: "chainlink" },
  { symbol: "RLB", index: 17 },
  { symbol: "PYTH", index: 18, gecko: "pyth-network" },
  { symbol: "TIA", index: 19, gecko: "celestia" },
  { symbol: "JTO", index: 20, gecko: "jito-governance-token" },
  { symbol: "SEI", index: 21, gecko: "sei-network" },
  { symbol: "AVAX", index: 22, gecko: "avalanche-2" },
  { symbol: "WIF", index: 23, gecko: "dogwifcoin" },
  { symbol: "JUP", index: 24, gecko: "jupiter-exchange-solana" },
  { symbol: "DYM", index: 25 },
  { symbol: "TAO", index: 26, gecko: "bittensor" },
  { symbol: "W", index: 27, gecko: "wormhole" },
  { symbol: "KMNO", index: 28, gecko: "kamino" },
  { symbol: "TNSR", index: 29, gecko: "tensor" },
  { symbol: "DRIFT", index: 30, gecko: "drift-protocol" },
  { symbol: "CLOUD", index: 31 },
  { symbol: "IO", index: 32, gecko: "io-net" },
  { symbol: "ZEX", index: 33 },
  { symbol: "POPCAT", index: 34, gecko: "popcat" },
  { symbol: "1KWEN", index: 35 },
  { symbol: "TON", index: 42, gecko: "the-open-network" },
  { symbol: "MOTHER", index: 44 },
  { symbol: "MOODENG", index: 45, gecko: "moo-deng" },
  { symbol: "DBR", index: 47 },
  { symbol: "1KMEW", index: 51 },
  { symbol: "MICHI", index: 52 },
  { symbol: "GOAT", index: 53, gecko: "goatseus-maximus" },
  { symbol: "FWOG", index: 54, gecko: "fwog" },
  { symbol: "PNUT", index: 55, gecko: "peanut-the-squirrel" },
  { symbol: "RAY", index: 56, gecko: "raydium" },
  { symbol: "HYPE", index: 59, gecko: "hyperliquid" },
  { symbol: "LTC", index: 60, gecko: "litecoin" },
  { symbol: "ME", index: 61, gecko: "magic-eden" },
  { symbol: "PENGU", index: 62, gecko: "pudgy-penguins" },
  { symbol: "AI16Z", index: 63, gecko: "ai16z" },
  { symbol: "TRUMP", index: 64, gecko: "official-trump" },
  { symbol: "MELANIA", index: 65, gecko: "melania-meme" },
  { symbol: "BERA", index: 66, gecko: "berachain-bera" },
  { symbol: "KAITO", index: 69, gecko: "kaito" },
  { symbol: "IP", index: 70 },
  { symbol: "FARTCOIN", index: 71, gecko: "fartcoin" },
  { symbol: "ADA", index: 72, gecko: "cardano" },
  { symbol: "PAXG", index: 73, gecko: "pax-gold" },
  { symbol: "LAUNCHCOIN", index: 74 },
  { symbol: "PUMP", index: 75, gecko: "pump-fun" },
  { symbol: "ASTER", index: 76, gecko: "aster-2" },
  { symbol: "XPL", index: 77 },
  { symbol: "2Z", index: 78 },
  { symbol: "ZEC", index: 79, gecko: "zcash" },
  { symbol: "MNT", index: 80, gecko: "mantle" },
  { symbol: "1KPUMP", index: 81 },
  { symbol: "MET", index: 82 },
  { symbol: "1KMON", index: 83 },
  { symbol: "LIT", index: 84 },
  { symbol: "BP", index: 85 },
];

export const DRIFT_COUNT = BOOK.length;

export function driftMarkets() {
  return BOOK.map((row) => ({ symbol: row.symbol, index: row.index }));
}

export type DriftMarket = {
  symbol: string;
  index: number;
  price: number | null;
  change: number | null;
  sign: "SOL" | "ETH" | "BTC" | null;
};

const SCALE: Record<string, number> = { "1MBONK": 1_000_000, "1MPEPE": 1_000_000 };

export const driftBook = createServerFn({ method: "GET" }).handler(async (): Promise<DriftMarket[]> => {
  const ids = [...new Set(BOOK.map((row) => row.gecko).filter((id): id is string => Boolean(id)))];
  let prices: Record<string, { usd?: number; usd_24h_change?: number }> = {};
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(12_000) },
    );
    if (res.ok) prices = (await res.json()) as typeof prices;
  } catch {
    prices = {};
  }
  return BOOK.map((row) => {
    const quote = row.gecko ? prices[row.gecko] : undefined;
    const raw = Number(quote?.usd);
    const scale = SCALE[row.symbol] ?? 1;
    const price = raw > 0 ? raw * scale : null;
    const change = Number(quote?.usd_24h_change);
    return {
      symbol: row.symbol,
      index: row.index,
      price,
      change: Number.isFinite(change) ? change : null,
      sign: row.sign ?? null,
    };
  });
});
