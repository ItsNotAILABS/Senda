/** Venues the desk actually reads. A row is not a balance Senda holds. */

export const VENDORS: { name: string; kind: string; does: string }[] = [
  { name: "Jupiter", kind: "Router", does: "Quotes and swaps. The wallet signs the transaction." },
  { name: "Kamino", kind: "Loans", does: "Supply and borrow on the main market and the xStocks market. A swap does not enter a reserve." },
  { name: "Backpack Securities", kind: "Shares", does: "The stock mints Jupiter names as Backpack Securities, including the Sunrise listings." },
  { name: "xStocks", kind: "Shares", does: "Listed share tokens. Jupiter quotes the mint." },
  { name: "Ondo", kind: "Funds", does: "Tokenized funds and equities on the verified list." },
  { name: "PreStocks", kind: "Pre-IPO", does: "Price exposure to a private name. Not a share of the company." },
  { name: "Drift", kind: "Perps", does: "Solana perps. SOL, ETH, and BTC are the ones this desk can sign." },
  { name: "Jupiter Perps", kind: "Perps", does: "SOL, ETH, and BTC. Phantom signs. Senda does not hold the margin." },
  { name: "Hyperliquid", kind: "Perps", does: "The Ethereum account signs. Margin stays on Hyperliquid." },
  { name: "Ostium", kind: "Perps", does: "FX, metals, and stocks. USDC margin on Arbitrum." },
  { name: "Phoenix", kind: "Book", does: "On-chain order book. The wallet signs." },
  { name: "Marinade", kind: "Stake", does: "mSOL stays in the wallet." },
  { name: "Jito", kind: "Stake", does: "JitoSOL stays in the wallet." },
  { name: "Sanctum", kind: "Stake", does: "INF, a pool of staked SOL." },
  { name: "Meteora", kind: "Pools", does: "DLMM pools beside the Jupiter route." },
  { name: "Raydium", kind: "Pools", does: "AMM pools. A second venue, not a second balance." },
  { name: "Circle CCTP", kind: "Send", does: "USDC between Ethereum and Base. Phantom signs the burn." },
  { name: "Phantom", kind: "Wallet", does: "The signer. Senda does not hold a key." },
  { name: "DriveWealth", kind: "Brokerage", does: "Cashless model only. No deposit into Senda. Not connected until the server has a session, and this desk does not place the order." },
];
