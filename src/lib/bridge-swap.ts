/** deBridge builds the cross-chain order. The source wallet signs it. */

import { bridgeAffiliate } from "@/lib/venue-cut";
import { Buffer } from "buffer";
import { VersionedTransaction } from "@solana/web3.js";
import { sendVersioned } from "@/lib/phantom";

const CREATE = "https://dln.debridge.finance/v1.0/dln/order/create-tx";

export type BridgeToken = { symbol: string; address: string; decimals: number };
export type BridgeChain = { id: string; name: string; chainId: number; kind: "solana" | "evm"; tokens: BridgeToken[] };

const NATIVE = "0x0000000000000000000000000000000000000000";

export const BRIDGE: BridgeChain[] = [
  {
    id: "solana",
    name: "Solana",
    chainId: 7565164,
    kind: "solana",
    tokens: [
      { symbol: "USDC", address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
      { symbol: "USDT", address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6 },
      { symbol: "SOL", address: "11111111111111111111111111111111", decimals: 9 },
    ],
  },
  {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
      { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
      { symbol: "ETH", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
      { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
      { symbol: "ETH", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    chainId: 42161,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
      { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
      { symbol: "ETH", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "polygon",
    name: "Polygon",
    chainId: 137,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
      { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
      { symbol: "POL", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "optimism",
    name: "Optimism",
    chainId: 10,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
      { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
      { symbol: "ETH", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
      { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
      { symbol: "AVAX", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "bnb",
    name: "BNB Chain",
    chainId: 56,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
      { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
      { symbol: "BNB", address: NATIVE, decimals: 18 },
    ],
  },
  {
    id: "monad",
    name: "Monad",
    chainId: 100000030,
    kind: "evm",
    tokens: [
      { symbol: "USDC", address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", decimals: 6 },
      { symbol: "MON", address: NATIVE, decimals: 18 },
    ],
  },
];

export type BridgeQuote = {
  send: number;
  receive: number;
  receiveSymbol: string;
  impact: number;
  tx: { data: string; to?: string; value?: string };
  srcKind: "solana" | "evm";
  cut: string;
};

type Raw = {
  errorMessage?: string;
  usdPriceImpact?: number;
  estimation?: { dstChainTokenOut?: { symbol?: string; amount?: string; decimals?: number } };
  tx?: { data?: string; to?: string; value?: string };
};

export async function quoteBridge(input: {
  src: BridgeChain;
  dst: BridgeChain;
  tokenIn: BridgeToken;
  tokenOut: BridgeToken;
  amount: number;
  sender: string;
  recipient: string;
}): Promise<BridgeQuote> {
  if (input.src.chainId === input.dst.chainId && input.tokenIn.address === input.tokenOut.address) {
    throw new Error("Pick a different chain or token.");
  }
  const atoms = BigInt(Math.round(input.amount * 10 ** input.tokenIn.decimals));
  if (atoms <= 0n) throw new Error("Enter an amount.");
  const affiliate = bridgeAffiliate();
  const qs = new URLSearchParams({
    srcChainId: String(input.src.chainId),
    srcChainTokenIn: input.tokenIn.address,
    srcChainTokenInAmount: atoms.toString(),
    dstChainId: String(input.dst.chainId),
    dstChainTokenOut: input.tokenOut.address,
    dstChainTokenOutRecipient: input.recipient,
    srcChainOrderAuthorityAddress: input.sender,
    dstChainOrderAuthorityAddress: input.recipient,
  });
  if (affiliate) {
    qs.set("affiliateFeePercent", affiliate.percent);
    qs.set("affiliateFeeRecipient", affiliate.wallet);
  }
  const first = await ask(qs);
  const quoted = first.ok ? first : await ask(clean(qs));
  const body = quoted.body;
  if (!body.tx?.data) throw new Error(body.errorMessage || "deBridge did not quote that route.");
  const out = body.estimation?.dstChainTokenOut;
  const dec = out?.decimals ?? input.tokenOut.decimals;
  const receive = Number(out?.amount || "0") / 10 ** dec;
  const cut = !affiliate
    ? "No Senda fee on this bridge. The gap is deBridge."
    : first.ok
      ? "deBridge keeps 4 bps for this desk. The other 4 bps was not added."
      : "The affiliate quote was refused, so this one has no desk fee.";
  return {
    send: input.amount,
    receive,
    receiveSymbol: out?.symbol || input.tokenOut.symbol,
    impact: Number(body.usdPriceImpact) || 0,
    tx: { data: body.tx.data, to: body.tx.to, value: body.tx.value },
    srcKind: input.src.kind,
    cut,
  };
}

function clean(qs: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(qs);
  next.delete("affiliateFeePercent");
  next.delete("affiliateFeeRecipient");
  return next;
}

async function ask(qs: URLSearchParams): Promise<{ ok: boolean; body: Raw }> {
  const res = await fetch(`${CREATE}?${qs.toString()}`, { headers: { accept: "application/json" } });
  const body = (await res.json()) as Raw;
  return { ok: res.ok && !!body.tx?.data, body };
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function signBridge(quote: BridgeQuote, from: string): Promise<string> {
  if (quote.receive < quote.send * 0.5) {
    throw new Error(`That route only returns about ${quote.receive.toFixed(2)} ${quote.receiveSymbol}. It was not sent.`);
  }
  if (quote.srcKind === "solana") {
    if (!globalThis.Buffer) globalThis.Buffer = Buffer;
    const tx = VersionedTransaction.deserialize(hexToBytes(quote.tx.data));
    return sendVersioned(tx);
  }
  const w = window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }; phantom?: { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } } };
  const provider = w.phantom?.ethereum || w.ethereum;
  if (!provider || !quote.tx.to) throw new Error("An Ethereum wallet has to sign this side.");
  const hash = await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: quote.tx.to, data: quote.tx.data, value: quote.tx.value || "0x0" }],
  });
  if (typeof hash !== "string") throw new Error("The wallet did not return a transaction.");
  return hash;
}
