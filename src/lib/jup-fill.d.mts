export const PRODUCTION_SLIPPAGE_BPS: number;
export const FILL_PROBE_USD: number;

export function impactBps(priceImpactPct: unknown): number;

export function fillsAtProductionSlippage(quote: {
  error?: string;
  outAmount?: string;
  priceImpactPct?: string;
  slippageBps?: number;
  inUsd?: number;
  swapUsdValue?: string | null;
} | null): boolean;

export function keepListed<T extends { mint?: string | null; symbol?: string }>(rows: T[], fillableMints: Iterable<string>): T[];

export type WeightLeg = {
  symbol: string;
  mint: string;
  filled: boolean;
  exec: number;
  mark: number;
  impactBps: number | null;
  outAmount: string;
  spendUsd: number;
  targetWeight: number;
  filledWeight: number;
};

export function weightBook(
  legs: Array<{ symbol?: string; mint?: string; mark?: number; target?: number; decimals?: number }>,
  quotes: Record<string, { inAmount?: string; outAmount?: string; priceImpactPct?: string; slippageBps?: number; swapUsdValue?: string | null; inUsd?: number; error?: string } | null>,
): { level: number | null; legs: WeightLeg[] };

export function mapPool<T, R>(items: Iterable<T>, limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]>;
