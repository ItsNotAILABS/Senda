export declare const SWAP_SLIPPAGE_BPS: 100;
export declare const MAX_PRICE_IMPACT_PERCENT: 5;
export declare function verifySwapQuote(quote: unknown, intent: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
}): {
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  impactPercent: number;
};

export declare function verifyStableSpend(input: {
  inputMint: string;
  amountRaw: number;
  capUsd: number;
  stableMints: readonly string[];
}): void;
