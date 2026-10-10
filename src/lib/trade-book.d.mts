export const SOLANA_DECIMALS: Record<string, number>;
export const SOL_MINT: string;
export const USDC_MAINNET: string;

export type EvmMarket = {
  tape: string;
  symbol: string;
  name: string;
  chain: string;
  chainId: number;
  token: string;
  usdc: string;
  usdcDecimals: number;
  decimals: number;
};

export const EVM_MARKETS: readonly EvmMarket[];

export function solanaDecimals(mint: string): number | null;
export function evmMarketFor(symbol: string): EvmMarket | null;
export function pairAllowed(inputMint: string, outputMint: string, prestockMints?: readonly string[]): boolean;
export function rawAmount(usd: number, decimals: number): bigint;
export function quoteIsSane(fromUsd: string | number, toUsd: string | number): boolean;

export const EVM_CHAINS: Record<number, { name: string; rpc: string; symbol: string; explorer: string }>;

export function sellRaw(usd: number, price: number, decimals: number, heldRaw: string): bigint;
export function balanceOfCall(owner: string): string;
export function decodeBalance(hex: string | null | undefined): bigint;
export function txLink(chainId: number, hash: string): string;
export function solTxLink(signature: string): string;

export type LifiQuote = {
  tool: string;
  toAmount: string;
  toAmountMin: string;
  fromAmountUSD: string;
  toAmountUSD: string;
  approvalAddress: string;
  fromToken: string;
  ready: boolean;
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
};

export function readLifi(body: unknown): LifiQuote | null;
