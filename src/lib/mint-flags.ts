/** One read of a mint. USDC and SOL are known. Anything else is the chain, or unknown. */

import { parseMintFlags, type MintFlags } from "./book-check.ts";

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_MINT = "So11111111111111111111111111111111111111112";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];
const TTL = 5 * 60 * 1000;

const KNOWN: Record<string, MintFlags> = {
  [USDC_MINT]: { ok: true, decimals: 6, token2022: false, paused: false, frozenDefault: false, fees: [] },
  [SOL_MINT]: { ok: true, decimals: 9, token2022: false, paused: false, frozenDefault: false, fees: [] },
};

const cache = new Map<string, { at: number; flags: MintFlags }>();

const UNKNOWN: MintFlags = { ok: false, decimals: 0, token2022: false, paused: false, frozenDefault: false, fees: [] };

export async function readMintFlags(mint: string): Promise<MintFlags> {
  const known = KNOWN[mint];
  if (known) return known;
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < TTL) return hit.flags;
  for (const url of RPCS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getAccountInfo",
          params: [mint, { encoding: "jsonParsed" }],
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const flags = parseMintFlags(await res.json());
      if (!flags.ok) continue;
      cache.set(mint, { at: Date.now(), flags });
      return flags;
    } catch {
      /* next rpc */
    }
  }
  return UNKNOWN;
}
