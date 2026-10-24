/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { USDC } from "@/lib/jup-exec";
import { rpc as chainRpc, sendVersioned } from "@/lib/phantom";
import { verifyStableSpend, verifySwapQuote } from "@/lib/quote-guard.mjs";
import { assertNoPendingDuplicate } from "@/lib/tx-journal.mjs";
import { confirmTrackedSubmission } from "@/lib/tracked-confirmation.mjs";
import { spendCap } from "@/lib/spend-cap";

// Keep the quote and transaction builder on Jupiter's official gateway.
// Lite shuts down October 30, 2026; do not send signed intents to unofficial proxy hosts.
const QUOTE_URLS = [(qs: string) => `https://api.jup.ag/swap/v1/quote?${qs}`];
const SWAP_URLS = ["https://api.jup.ag/swap/v1/swap"];

export const SOL = "So11111111111111111111111111111111111111112";

/** One side is USDC or SOL. The other side is the mint Jupiter quoted. */
export function assertPrestockRoute(inputMint: string, outputMint: string) {
  const cash = new Set([SOL, USDC]);
  const ok = (cash.has(inputMint) && outputMint.length >= 32) || (cash.has(outputMint) && inputMint.length >= 32);
  if (!ok) throw new Error("That pair is not USDC or SOL against a mint. The wallet was not asked to sign.");
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
  inputMint?: string;
  outputMint?: string;
  swapMode?: string;
  slippageBps?: number;
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
  if (!Number.isSafeInteger(input.amountRaw) || input.amountRaw <= 0) throw new Error("Enter an exact raw token amount.");
  if (!Number.isInteger(input.outDecimals) || input.outDecimals < 0 || input.outDecimals > 18) throw new Error("Invalid mint decimals.");
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=100&restrictIntermediateTokens=true`;
  let last = "Jupiter did not quote.";
  for (const url of QUOTE_URLS) {
    const res = await fetch(url(qs), { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
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
    let checked: ReturnType<typeof verifySwapQuote>;
    try {
      checked = verifySwapQuote(quote, input);
    } catch (error) {
      last = error instanceof Error ? error.message : "Jupiter returned an unsafe quote.";
      continue;
    }
    return {
      inAmount: checked.inAmount,
      outAmount: checked.outAmount,
      outUi: Number(checked.outAmount) / 10 ** input.outDecimals,
      minUi: Number(checked.minOutAmount) / 10 ** input.outDecimals,
      impact: checked.impactPercent,
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
  if (!(input.usd > 0) || !Number.isFinite(input.usd)) throw new Error("Enter an amount.");
  if (!Number.isSafeInteger(input.amountRaw) || input.amountRaw <= 0) throw new Error("Enter an exact raw token amount.");
  if (!Number.isInteger(input.outDecimals) || input.outDecimals < 0 || input.outDecimals > 18) throw new Error("Invalid mint decimals.");
  assertPrestockRoute(input.inputMint, input.outputMint);
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about $${input.usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  verifyStableSpend({ inputMint: input.inputMint, amountRaw: input.amountRaw, capUsd: cap, stableMints: [USDC] });
  const journalDraft = {
    owner: input.owner,
    kind: "swap" as const,
    asset: input.inputMint,
    destination: input.outputMint,
    amountRaw: String(input.amountRaw),
  };
  // An unknown prior submission must be reconciled before the same action can be signed again.
  assertNoPendingDuplicate(window.localStorage, journalDraft);
  // Validate the SAME raw quote that will be passed to /swap, not a preview quote.
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${input.amountRaw}&slippageBps=100&restrictIntermediateTokens=true`;
  let quote: RawQuote | null = null;
  let checked: ReturnType<typeof verifySwapQuote> | null = null;
  let lastQuoteError = "Jupiter did not quote.";
  for (const base of QUOTE_URLS) {
    try {
      const quoteRes = await fetch(base(qs), { headers: { accept: "application/json" } });
      const text = await quoteRes.text();
      const parsed = JSON.parse(text) as RawQuote;
      if (!quoteRes.ok || !parsed.outAmount) {
        lastQuoteError = parsed.error || (quoteRes.status === 429 ? "Jupiter is busy." : `Jupiter quote ${quoteRes.status}`);
        continue;
      }
      checked = verifySwapQuote(parsed, input);
      quote = parsed;
      break;
    } catch (error) {
      lastQuoteError = error instanceof Error ? error.message : "Jupiter returned an unsafe quote.";
    }
  }
  if (!quote || !checked) throw new Error(lastQuoteError);
  let swapTx = "";
  let swapErr = "Jupiter did not build a transaction.";
  for (const base of SWAP_URLS) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        dynamicComputeUnitLimit: true,
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
  const { PublicKey, VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTx));
  if (!tx.message.staticAccountKeys[0]?.equals(new PublicKey(input.owner))) {
    throw new Error("Jupiter returned a different fee payer. The wallet was not asked to sign.");
  }
  const signature = await sendVersioned(tx);
  // A signature is a submission acknowledgment; do not report a completed swap until
  // Solana explicitly confirms success. Unknown status must be reconciled before retrying.
  await confirmTrackedSubmission(window.localStorage, { ...journalDraft, signature }, chainRpc);
  return { signature, outUi: Number(checked.outAmount) / 10 ** input.outDecimals };
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
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Swap size is zero or exceeds precise raw-unit limits.");
  return signRoute({
    owner: input.owner,
    inputMint: input.side === "buy" ? USDC : input.mint,
    outputMint: input.side === "buy" ? input.mint : USDC,
    amountRaw: amount,
    outDecimals: input.decimals ?? (input.side === "buy" ? 9 : 6),
    usd: input.usd,
  });
}
