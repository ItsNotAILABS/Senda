/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { USDC } from "@/lib/jup-exec";
import { PRESTOCK_MINTS } from "@/lib/phantom";
import { sendVersioned } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";

const QUOTE = "https://api.jup.ag/swap/v1/quote";
const QUOTE_LITE = "https://lite-api.jup.ag/swap/v1/quote";
const SWAP = "https://api.jup.ag/swap/v1/swap";
const SWAP_LITE = "https://lite-api.jup.ag/swap/v1/swap";

export const SOL = "So11111111111111111111111111111111111111112";

const ALLOWED = new Set<string>([SOL, USDC, ...PRESTOCK_MINTS.map(([, mint]) => mint)]);

/** A swap may only be SOL, USDC, or a PreStock mint. Anything else never reaches the wallet. */
export function assertPrestockRoute(inputMint: string, outputMint: string) {
  if (!ALLOWED.has(inputMint) || !ALLOWED.has(outputMint)) {
    throw new Error("That pair is not SOL, USDC, or a PreStock. The wallet was not asked to sign.");
  }
}

export type RouteQuote = {
  inAmount: string;
  outAmount: string;
  outUi: number;
  minUi: number;
  impact: number;
  route: string;
};

type RawQuote = {
  outAmount?: string;
  inAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  error?: string;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function quoteRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
}): Promise<RouteQuote> {
  if (!(input.amountRaw > 0)) throw new Error("Enter an amount.");
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=100&restrictIntermediateTokens=true`;
  let last = "Jupiter did not quote.";
  for (const base of [QUOTE, QUOTE_LITE]) {
    const res = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
    const text = await res.text();
    let quote: RawQuote = {};
    try {
      quote = JSON.parse(text) as RawQuote;
    } catch {
      last = res.status === 429 ? "Jupiter is busy. Wait a moment." : "Jupiter did not quote.";
      continue;
    }
    if (!res.ok || !quote.outAmount) {
      last = res.status === 429 ? "Jupiter is busy. Wait a moment." : quote.error || `Jupiter quote ${res.status}`;
      continue;
    }
    const impact = Number(quote.priceImpactPct ?? 0);
    const outUi = Number(quote.outAmount) / 10 ** input.outDecimals;
    const minRaw = Number(quote.otherAmountThreshold || quote.outAmount);
    return {
      inAmount: quote.inAmount || String(Math.floor(input.amountRaw)),
      outAmount: quote.outAmount,
      outUi,
      minUi: minRaw / 10 ** input.outDecimals,
      impact,
      route: (quote.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean).join(" → ") || "Jupiter",
    };
  }
  throw new Error(last);
}

export async function signRoute(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  usd: number;
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  assertPrestockRoute(input.inputMint, input.outputMint);
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about $${input.usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  const quoted = await quoteRoute(input);
  if (quoted.impact > 5) throw new Error(`Price impact is ${quoted.impact.toFixed(1)}%. The wallet was not asked to sign.`);
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=100&restrictIntermediateTokens=true`;
  let quote: RawQuote | null = null;
  for (const base of [QUOTE, QUOTE_LITE]) {
    const quoteRes = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
    const text = await quoteRes.text();
    try {
      const parsed = JSON.parse(text) as RawQuote;
      if (quoteRes.ok && parsed.outAmount) {
        quote = parsed;
        break;
      }
    } catch {
      /* try the other host */
    }
  }
  if (!quote?.outAmount) throw new Error("Jupiter did not quote.");
  let swapTx = "";
  let swapErr = "Jupiter did not build a transaction.";
  for (const base of [SWAP, SWAP_LITE]) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
      }),
    });
    const text = await swapRes.text();
    try {
      const swap = JSON.parse(text) as { swapTransaction?: string; error?: string };
      if (swap.swapTransaction) {
        swapTx = swap.swapTransaction;
        break;
      }
      if (swap.error) swapErr = swap.error;
    } catch {
      if (swapRes.status === 429) swapErr = "Jupiter is busy. Wait a moment.";
    }
  }
  if (!swapTx) throw new Error(swapErr);
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTx));
  const signature = await sendVersioned(tx);
  return { signature, outUi: quoted.outUi };
}

export async function signStockSwap(input: {
  owner: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  tokenAmount?: bigint;
  decimals?: number;
}): Promise<{ signature: string; outUi: number }> {
  const amount =
    input.side === "buy" ? Math.max(1, Math.round(input.usd * 1e6)) : Number(input.tokenAmount ?? 0n);
  if (!(amount > 0)) throw new Error("Nothing to sell.");
  return signRoute({
    owner: input.owner,
    inputMint: input.side === "buy" ? USDC : input.mint,
    outputMint: input.side === "buy" ? input.mint : USDC,
    amountRaw: amount,
    outDecimals: input.decimals ?? (input.side === "buy" ? 9 : 6),
    usd: input.usd,
  });
}
