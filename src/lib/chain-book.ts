/** Inventory of every chain and every desk. Add a row. Do not delete one to make room. */

export type ChainLane = {
  id: string;
  name: string;
  sign: string;
  clears: string;
  live: boolean;
};

export const CHAIN_LANES: ChainLane[] = [
  { id: "solana", name: "Solana", sign: "Phantom, Solflare, Backpack", clears: "Jupiter buys, USDC sends, PreStocks, xStocks, perps", live: true },
  { id: "bitcoin", name: "Bitcoin", sign: "The Solana wrappers, in the same wallet", clears: "WBTC and cbBTC. Native bitcoin is not signed here.", live: true },
  { id: "ethereum", name: "Ethereum", sign: "Phantom Ethereum or MetaMask", clears: "Portal ETH on Solana, plus the Ethereum account for Arbitrum and Base", live: true },
  { id: "arbitrum", name: "Arbitrum", sign: "The same Ethereum account", clears: "Ostium longs and shorts in USDC", live: true },
  { id: "monad", name: "Monad", sign: "Phantom Ethereum or MetaMask, chain 143", clears: "The wallet can add the chain. A Monad swap is not invented.", live: false },
  { id: "base", name: "Base", sign: "MetaMask", clears: "The Base account already in Wallets", live: true },
  { id: "btc-taproot", name: "Bitcoin · Taproot", sign: "Phantom receive address. Native bitcoin is not signed.", clears: "WBTC and cbBTC on Solana. Taproot only receives.", live: false },
  { id: "btc-segwit", name: "Bitcoin · Native Segwit", sign: "Phantom receive address. Native bitcoin is not signed.", clears: "The same bitcoin tokens. Segwit is the other receive address, not a second market.", live: false },
  { id: "robinhood", name: "Robinhood Chain", sign: "Phantom Ethereum account, chain 4663", clears: "Stock tokens with Chainlink prices, live since 1 July 2026. US persons are excluded. Senda adds the chain in Phantom. It does not invent a stock router.", live: true },
  { id: "bnb", name: "BNB Chain", sign: "Phantom holds the network. A BNB Chain swap is not signed.", clears: "BNB on the Jupiter book, when it is listed.", live: false },
  { id: "arc", name: "Arc", sign: "Circle's chain. An Arc transfer is not signed.", clears: "USDC and EURC you already spend on Solana.", live: false },
  { id: "polygon", name: "Polygon", sign: "Phantom holds the network. A Polygon swap is not signed.", clears: "POL or MATIC on the Jupiter book, when listed.", live: false },
  { id: "hyperevm", name: "HyperEVM", sign: "Phantom Ethereum account", clears: "The Hyperliquid desk. Main perps plus the builder books. Margin stays on Hyperliquid.", live: true },
];

export const KEPT_DESKS: { name: string; where: string; holds: string }[] = [
  { name: "Chart", where: "Trade", holds: "Full-screen chart and a ticket" },
  { name: "Quotes", where: "Trade", holds: "The whole Jupiter book" },
  { name: "Spot", where: "Trade", holds: "Coin cards with buy and sell" },
  { name: "PreStocks", where: "Trade and Pre", holds: "The private names" },
  { name: "xStocks", where: "Trade and Markets", holds: "Listed share tokens" },
  { name: "Perps", where: "Trade and Markets", holds: "Jupiter perps" },
  { name: "Hyperliquid", where: "Trade and Markets", holds: "Every perp their info API returns. The Ethereum account signs." },
  { name: "FX and metals", where: "Trade", holds: "The Ostium print and the tokens that match" },
  { name: "Commodities", where: "Trade and Markets", holds: "Metals, energy, softs" },
  { name: "Pairs", where: "Trade and Markets", holds: "The catalog. A mint means it signs." },
  { name: "Ostium", where: "Trade and Markets", holds: "Every Arbitrum perp the contract lists" },
  { name: "Options", where: "Trade", holds: "Calls and puts on the names" },
  { name: "Stakes", where: "Trade", holds: "Stake products" },
  { name: "Borrow", where: "Trade", holds: "Loans against what you hold" },
  { name: "Cover", where: "Trade and Cover", holds: "Downside cover you sign" },
  { name: "Send", where: "Send", holds: "USDC to an address" },
  { name: "Portfolio", where: "Portfolio", holds: "What the wallet holds, marked at the last print" },
  { name: "Vaults", where: "Markets and Portfolio", holds: "The USDC wrap, the stake receipts, and every Kamino vault share" },
  { name: "CCTP", where: "Chains", holds: "USDC mint closes in Phantom on Ethereum and Base. Arbitrum is an export." },
];

const MONAD = {
  chainId: "0x8f",
  chainName: "Monad",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: ["https://rpc1.monad.xyz"],
  blockExplorerUrls: ["https://monadscan.com"],
};

type Eth = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

function ethereum(): Eth {
  const w = window as unknown as {
    phantom?: { ethereum?: Eth };
    ethereum?: Eth & { isMetaMask?: boolean; providers?: Array<Eth & { isMetaMask?: boolean }> };
  };
  if (w.phantom?.ethereum) return w.phantom.ethereum;
  const mask = w.ethereum?.providers?.find((p) => p.isMetaMask);
  if (mask) return mask;
  if (w.ethereum) return w.ethereum;
  throw new Error("Open this page in Phantom or MetaMask to add Monad.");
}

export async function addMonad(): Promise<void> {
  const eth = ethereum();
  await eth.request({ method: "eth_requestAccounts" });
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD.chainId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902) throw e;
    await eth.request({ method: "wallet_addEthereumChain", params: [MONAD] });
  }
}

const ROBINHOOD = {
  chainId: "0x1237",
  chainName: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.chain.robinhood.com"],
  blockExplorerUrls: ["https://robinhoodchain.blockscout.com"],
};

/** Phantom added this network on 23 July 2026. Switching the chain is the wallet action. A stock swap is not built here. */
export async function addRobinhood(): Promise<void> {
  const eth = ethereum();
  await eth.request({ method: "eth_requestAccounts" });
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ROBINHOOD.chainId }] });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 4902) throw e;
    await eth.request({ method: "wallet_addEthereumChain", params: [ROBINHOOD] });
  }
}

export type PhantomNet = {
  id: string;
  name: string;
  badge?: string;
  mark: string;
  /** Exact symbols on the Jupiter book. Null means the whole Solana book. */
  symbols: string[] | null;
  tradable: string;
  native: string;
  href?: string;
};

/** Phantom's receive sheet, in the order Phantom shows it. A symbol here is a Solana token the wallet can sign. */
export const PHANTOM_NETS: PhantomNet[] = [
  {
    id: "solana",
    name: "Solana",
    mark: "◎",
    symbols: null,
    tradable: "The whole book. Coins, PreStocks, xStocks, and the Solana perps.",
    native: "Phantom signs the swap.",
  },
  {
    id: "ethereum",
    name: "Ethereum",
    mark: "◆",
    symbols: ["ETH", "WETH", "CBETH", "WEETH", "STETH", "WSTETH"],
    tradable: "Portal ETH and the liquid-staking tokens Jupiter lists.",
    native: "The Ethereum account also opens Base. A native Uniswap swap is not signed here.",
    href: "/metamask",
  },
  {
    id: "btc-taproot",
    name: "Bitcoin",
    badge: "Taproot",
    mark: "₿",
    symbols: ["BTC", "WBTC", "CBBTC", "ZBTC", "XBTC"],
    tradable: "WBTC, cbBTC, and any other bitcoin token on the Jupiter book.",
    native: "Taproot is a receive address in Phantom. Senda does not sign native bitcoin.",
  },
  {
    id: "btc-segwit",
    name: "Bitcoin",
    badge: "Native Segwit",
    mark: "₿",
    symbols: ["BTC", "WBTC", "CBBTC", "ZBTC", "XBTC"],
    tradable: "The same bitcoin tokens. Segwit is the other receive address, not a second market.",
    native: "Native segwit spends are not signed here.",
  },
  {
    id: "robinhood",
    name: "Robinhood Chain",
    mark: "R",
    symbols: ["HOOD", "HOODX"],
    tradable: "Phantom switches to chain 4663. Stock tokens live there, priced by Chainlink, and they are not offered to US persons. HOOD on Jupiter is the Solana token, when it is listed.",
    native: "Adding the chain is signed in Phantom. Senda does not build the stock swap.",
    href: "/wallets",
  },
  {
    id: "bnb",
    name: "BNB Chain",
    mark: "B",
    symbols: ["BNB", "WBNB"],
    tradable: "BNB on the Jupiter book, when it is listed.",
    native: "PancakeSwap on BNB Chain is not signed here.",
  },
  {
    id: "arc",
    name: "Arc",
    mark: "A",
    symbols: ["USDC", "EURC"],
    tradable: "USDC and EURC you already spend on Solana.",
    native: "Arc is Circle's chain. A transfer on Arc is not signed here.",
  },
  {
    id: "base",
    name: "Base",
    mark: "□",
    symbols: ["ETH", "USDC", "CBETH", "CBBTC"],
    tradable: "ETH and the Coinbase wrapped tokens on Solana. Native Base USDC send is the Base account.",
    native: "The Base account sends USDC and ETH you hold there.",
    href: "/metamask",
  },
  {
    id: "polygon",
    name: "Polygon",
    mark: "P",
    symbols: ["POL", "MATIC", "WMATIC"],
    tradable: "POL or MATIC on the Jupiter book, when listed.",
    native: "A Polygon swap is not signed here.",
  },
  {
    id: "hyperevm",
    name: "HyperEVM",
    badge: "Lite",
    mark: "H",
    symbols: ["HYPE"],
    tradable: "The Hyperliquid book. Crypto, stocks, metals, and FX they list.",
    native: "Phantom’s Ethereum account signs the order. Margin stays on Hyperliquid.",
  },
];

export function netMatches(net: PhantomNet, symbol: string): boolean {
  if (!net.symbols) return true;
  return net.symbols.includes(symbol.toUpperCase());
}
