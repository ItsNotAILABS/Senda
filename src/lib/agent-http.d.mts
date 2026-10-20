export function handleAgentHttp(
  method: string,
  rawBody?: string,
): Promise<{ status: number; headers: Record<string, string>; body: string }>;

export function quoteSwap(args: { mint: string; usd: number; side?: string }): Promise<{
  offered: boolean;
  sign: string;
  side: string;
  inMint: string;
  outMint: string;
  inAmount: string;
  outAmount: string;
  listed: boolean;
  sane: boolean;
}>;
