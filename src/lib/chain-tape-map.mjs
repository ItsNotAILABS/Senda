/** Price rows only. A row is not a position and not a fill. */

export const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const SOLANA_MORE = [
  ["USDC", "USD Coin", USDC_MAINNET],
  ["USDT", "Tether", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"],
  ["PYUSD", "PayPal USD", "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"],
  ["mSOL", "Marinade SOL", "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So"],
  ["jitoSOL", "Jito SOL", "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"],
  ["bSOL", "BlazeStake SOL", "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"],
  ["INF", "Sanctum INF", "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm"],
  ["BONK", "Bonk", "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"],
  ["WIF", "dogwifhat", "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm"],
];

export const CHAINS = [
  ["BTC", "Bitcoin", "Bitcoin", "bitcoin"],
  ["ETH", "Ether", "Ethereum", "ethereum"],
  ["BNB", "BNB", "BNB Chain", "binancecoin"],
  ["XRP", "XRP", "XRP Ledger", "ripple"],
  ["ADA", "Cardano", "Cardano", "cardano"],
  ["AVAX", "Avalanche", "Avalanche", "avalanche-2"],
  ["DOT", "Polkadot", "Polkadot", "polkadot"],
  ["LINK", "Chainlink", "Ethereum", "chainlink"],
  ["UNI", "Uniswap", "Ethereum", "uniswap"],
  ["AAVE", "Aave", "Ethereum", "aave"],
  ["ARB", "Arbitrum", "Arbitrum", "arbitrum"],
  ["OP", "Optimism", "Optimism", "optimism"],
  ["SUI", "Sui", "Sui", "sui"],
  ["APT", "Aptos", "Aptos", "aptos"],
  ["NEAR", "NEAR", "NEAR", "near"],
  ["TON", "Toncoin", "TON", "the-open-network"],
  ["TRX", "TRON", "TRON", "tron"],
  ["ATOM", "Cosmos", "Cosmos", "cosmos"],
  ["DOGE", "Dogecoin", "Dogecoin", "dogecoin"],
  ["LTC", "Litecoin", "Litecoin", "litecoin"],
];

function num(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function row(lane, venue, symbol, name, usd, change, mint) {
  if (usd == null || !(usd > 0)) return null;
  return {
    id: `${lane}:${symbol}`,
    lane,
    venue,
    symbol,
    name,
    usd,
    change24h: change,
    mint: mint || null,
    href: mint ? `https://jup.ag/swap/${USDC_MAINNET}-${mint}` : null,
  };
}

/** Jupiter priceChange24h is a percent. The tape stores a fraction. */
export function mapSolana(quotes) {
  const book = quotes && typeof quotes === "object" ? quotes : {};
  const rows = [];
  for (const [symbol, name, mint] of SOLANA_MORE) {
    const quote = book[mint] || {};
    const move = num(quote.priceChange24h);
    const item = row("solana", "Jupiter", symbol, name, num(quote.usdPrice), move == null ? null : move / 100, mint);
    if (item) rows.push(item);
  }
  return rows;
}

/** DefiLlama percentage is a percent. A coin with no price is left off. */
export function mapChains(prices, changes) {
  const book = prices?.coins || {};
  const moves = changes?.coins || {};
  const rows = [];
  for (const [symbol, name, chain, gecko] of CHAINS) {
    const key = `coingecko:${gecko}`;
    const coin = book[key] || {};
    const move = num(moves[key]);
    const item = row("chain", chain, symbol, name, num(coin.price), move == null ? null : move / 100, null);
    if (item) rows.push(item);
  }
  return rows;
}
