/** Juno’s peso token. The address is the one mxnb.mx lists for Solana. */

import { createServerFn } from "@tanstack/react-start";

export const MXNB_MINT = "FbvEGABKDRgbkDpsmeFAGqACXaVu9w4CYK9rx9jtBNnh";

const RPCS = ["https://api.mainnet-beta.solana.com", "https://solana-rpc.publicnode.com"];

export type MxnbFacts = {
  ok: true;
  mint: string;
  supply: number;
  paused: boolean;
  decimals: number;
  token2022: boolean;
};

type Ext = { extension?: string; state?: { paused?: boolean } };

export function parseMxnb(body: unknown): MxnbFacts | { ok: false } {
  const value = (
    body as {
      result?: {
        value?: {
          data?: {
            program?: string;
            parsed?: { info?: { decimals?: number; supply?: string; extensions?: Ext[] } };
          };
        } | null;
      };
    }
  )?.result?.value;
  const info = value?.data?.parsed?.info;
  if (!info) return { ok: false };
  const decimals = Number(info.decimals);
  const raw = Number(info.supply);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || !Number.isFinite(raw) || raw < 0) return { ok: false };
  const paused = (info.extensions || []).some((row) => row.extension === "pausableConfig" && row.state?.paused === true);
  return {
    ok: true,
    mint: MXNB_MINT,
    supply: raw / 10 ** decimals,
    paused,
    decimals,
    token2022: value?.data?.program === "spl-token-2022",
  };
}

async function pull(url: string): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [MXNB_MINT, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export const readMxnb = createServerFn({ method: "GET" }).handler(async (): Promise<MxnbFacts | { ok: false }> => {
  for (const url of RPCS) {
    try {
      const parsed = parseMxnb(await pull(url));
      if (parsed.ok) return parsed;
    } catch {
      /* next rpc */
    }
  }
  return { ok: false };
});
