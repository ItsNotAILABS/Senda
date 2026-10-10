export const USDC_MAINNET: string;
export const SOLANA_MORE: ReadonlyArray<readonly [string, string, string]>;
export const CHAINS: ReadonlyArray<readonly [string, string, string, string]>;

export type TapeRow = {
  id: string;
  lane: "solana" | "chain";
  venue: string;
  symbol: string;
  name: string;
  usd: number;
  change24h: number | null;
  mint: string | null;
  href: string | null;
};

export function mapSolana(quotes: Record<string, { usdPrice?: number; priceChange24h?: number }> | null | undefined): TapeRow[];
export function mapChains(
  prices: { coins?: Record<string, { price?: number }> } | null | undefined,
  changes: { coins?: Record<string, number> } | null | undefined,
): TapeRow[];
