/** PreStocks rails on Solana. Live venues, not demo links. */

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export function jupiterSwap(mint: string): string {
  return `https://jup.ag/swap/${USDC}-${mint}`;
}

export function rails(mint: string, symbol: string) {
  const slug = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  return {
    jupiter: jupiterSwap(mint),
    jupiterToken: `https://jup.ag/tokens/${mint}`,
    screener: "https://jup.ag/prestocks",
    raydium: `https://raydium.io/swap/?inputMint=${USDC}&outputMint=${mint}`,
    meteora: "https://app.meteora.ag",
    birdeye: `https://birdeye.so/token/${mint}?chain=solana`,
    dexscreener: `https://dexscreener.com/solana/${mint}`,
    solscan: `https://solscan.io/token/${mint}`,
    product: `https://www.prestocks.com/${slug}`,
    api: "https://prestocks.com/api/prestocks",
  };
}

export const PARTNERS: { name: string; href: string; blurb: string }[] = [
  { name: "Jupiter", href: "https://jup.ag/prestocks", blurb: "Primary DEX aggregator. Swap USDC for the PreStock mint. Limit orders on the same pair." },
  { name: "Meteora", href: "https://app.meteora.ag", blurb: "DLMM pools and DBC launch liquidity for tokenized names." },
  { name: "Raydium", href: "https://raydium.io", blurb: "AMM pools. Second venue next to Jupiter." },
  { name: "Phantom", href: "https://phantom.app", blurb: "SPL wallet. Link a pubkey in Account; Senda can issue one." },
  { name: "Solana", href: "https://solana.com", blurb: "Settlement. 24/7, no exchange hours. SPL Token program." },
  { name: "Pyth", href: "https://www.pyth.network", blurb: "Oracle stack for equities and xStocks. PreStocks last vs mark is the SPV print." },
  { name: "Birdeye", href: "https://birdeye.so/?chain=solana", blurb: "Token tape, holders, liquidity." },
  { name: "Dexscreener", href: "https://dexscreener.com/solana", blurb: "Pool prints and 24h volume." },
  { name: "Solscan", href: "https://solscan.io", blurb: "Mint, holders, transactions on mainnet." },
  { name: "CoinGecko", href: "https://www.coingecko.com", blurb: "Market pages for PreStocks names." },
  { name: "DefiLlama", href: "https://defillama.com", blurb: "TVL / RWA tracking." },
  { name: "Nansen", href: "https://www.nansen.ai", blurb: "Holder and flow analytics." },
  { name: "PreStocks", href: "https://prestocks.com/products", blurb: "Issuer. 1:1 SPV-backed economic exposure. KYC only on mint/redeem." },
];

export const LEGAL =
  "PreStocks are SPL tokens tracking private-company valuation, 1:1 SPV-backed. No ownership, vote, or dividend. Not for U.S. persons. Senda is agent: Jupiter fills the mint. We do not warehouse. ISO 20022 pain.001 on send. ISO 8583 on card auth.";
