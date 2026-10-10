/** Which listed markets can actually be signed, and by which protocol. */

import { SOLANA_DECIMALS, SOLANA_MORE, SOL_MINT, USDC_MAINNET } from "./chain-tape-map.mjs";

export { SOLANA_DECIMALS, SOL_MINT, USDC_MAINNET };

/** USDC in, this token out, same chain. Wrapped assets are labeled as wrapped. */
export const EVM_MARKETS = [
  { tape: "ETH", symbol: "WETH", name: "Wrapped Ether", chain: "Ethereum", chainId: 1, token: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcDecimals: 6, decimals: 18 },
  { tape: "BTC", symbol: "WBTC", name: "Wrapped Bitcoin", chain: "Ethereum", chainId: 1, token: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcDecimals: 6, decimals: 8 },
  { tape: "LINK", symbol: "LINK", name: "Chainlink", chain: "Ethereum", chainId: 1, token: "0x514910771AF9Ca656af840dff83E8264EcF986CA", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcDecimals: 6, decimals: 18 },
  { tape: "UNI", symbol: "UNI", name: "Uniswap", chain: "Ethereum", chainId: 1, token: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcDecimals: 6, decimals: 18 },
  { tape: "AAVE", symbol: "AAVE", name: "Aave", chain: "Ethereum", chainId: 1, token: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", usdcDecimals: 6, decimals: 18 },
  { tape: "ARB", symbol: "ARB", name: "Arbitrum", chain: "Arbitrum", chainId: 42161, token: "0x912CE59144191C1204E64559FE8253a0e49E6548", usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", usdcDecimals: 6, decimals: 18 },
  { tape: "OP", symbol: "OP", name: "Optimism", chain: "Optimism", chainId: 10, token: "0x4200000000000000000000000000000000000042", usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", usdcDecimals: 6, decimals: 18 },
  { tape: "BNB", symbol: "WBNB", name: "Wrapped BNB", chain: "BNB Chain", chainId: 56, token: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", usdcDecimals: 18, decimals: 18 },
  { tape: "AVAX", symbol: "WAVAX", name: "Wrapped AVAX", chain: "Avalanche", chainId: 43114, token: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", usdcDecimals: 6, decimals: 18 },
];

const SOLANA_MINTS = new Set(SOLANA_MORE.map((row) => row[2]));

export function solanaDecimals(mint) {
  return SOLANA_DECIMALS[mint] ?? null;
}

export function evmMarketFor(symbol) {
  return EVM_MARKETS.find((row) => row.tape === symbol) ?? null;
}

/** SOL, USDC, a listed Solana market, or a PreStock. Anything else never reaches a wallet. */
export function pairAllowed(inputMint, outputMint, prestockMints = []) {
  const allowed = new Set([USDC_MAINNET, SOL_MINT, ...SOLANA_MINTS, ...prestockMints]);
  return allowed.has(inputMint) && allowed.has(outputMint);
}

export function rawAmount(usd, decimals) {
  if (!(usd > 0) || decimals < 0) return 0n;
  return BigInt(Math.max(1, Math.round(usd * 10 ** decimals)));
}

/** True when the quoted dollars out are within 5% of the dollars in. */
export function quoteIsSane(fromUsd, toUsd) {
  const spent = Number(fromUsd);
  const received = Number(toUsd);
  if (!(spent > 0) || !(received > 0)) return false;
  return received >= spent * 0.95;
}

export const EVM_CHAINS = {
  1: { name: "Ethereum", rpc: "https://ethereum.publicnode.com", symbol: "ETH", explorer: "https://etherscan.io" },
  10: { name: "Optimism", rpc: "https://mainnet.optimism.io", symbol: "ETH", explorer: "https://optimistic.etherscan.io" },
  56: { name: "BNB Smart Chain", rpc: "https://bsc-dataseed.binance.org", symbol: "BNB", explorer: "https://bscscan.com" },
  42161: { name: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc", symbol: "ETH", explorer: "https://arbiscan.io" },
  43114: { name: "Avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc", symbol: "AVAX", explorer: "https://snowtrace.io" },
};

/** Token units to sell for about `usd`, never more than the wallet holds. */
export function sellRaw(usd, price, decimals, heldRaw) {
  if (!(usd > 0) || !(price > 0) || decimals < 0) return 0n;
  const held = BigInt(heldRaw || "0");
  if (held <= 0n) return 0n;
  const want = BigInt(Math.max(1, Math.floor((usd / price) * 10 ** decimals)));
  return want > held ? held : want;
}

export function balanceOfCall(owner) {
  const addr = String(owner || "").toLowerCase().replace(/^0x/, "");
  if (!/^[\da-f]{40}$/.test(addr)) return "";
  return `0x70a08231${addr.padStart(64, "0")}`;
}

export function decodeBalance(hex) {
  if (!hex || hex === "0x") return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

export function txLink(chainId, hash) {
  const chain = EVM_CHAINS[Number(chainId)];
  if (!chain || !hash) return "";
  return `${chain.explorer}/tx/${hash}`;
}

export function solTxLink(signature) {
  if (!signature) return "";
  return `https://solscan.io/tx/${signature}`;
}

export function readLifi(body) {
  const estimate = body?.estimate;
  if (!estimate?.toAmount) return null;
  const tx = body.transactionRequest;
  const fromToken = body?.action?.fromToken;
  return {
    tool: String(estimate.tool || "LI.FI"),
    toAmount: String(estimate.toAmount),
    toAmountMin: String(estimate.toAmountMin || estimate.toAmount),
    fromAmountUSD: estimate.fromAmountUSD != null ? String(estimate.fromAmountUSD) : "",
    toAmountUSD: estimate.toAmountUSD != null ? String(estimate.toAmountUSD) : "",
    approvalAddress: String(estimate.approvalAddress || ""),
    fromToken: String(fromToken?.address || ""),
    ready: Boolean(tx?.to && tx?.data),
    to: String(tx?.to || ""),
    data: String(tx?.data || ""),
    value: String(tx?.value || "0x0"),
    chainId: Number(tx?.chainId || body?.action?.fromChainId || 0),
    gasLimit: tx?.gasLimit != null ? String(tx.gasLimit) : "",
  };
}
