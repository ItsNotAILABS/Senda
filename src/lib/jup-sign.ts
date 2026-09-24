/** Jupiter builds the swap. Phantom signs and sends it. Senda never holds the key. */

import { USDC } from "@/lib/jup-exec";
import { sendVersioned } from "@/lib/phantom";

const QUOTE = "https://lite-api.jup.ag/swap/v1/quote";
const SWAP = "https://lite-api.jup.ag/swap/v1/swap";

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signStockSwap(input: {
  owner: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  /** Raw token amount when selling. Ignored on a buy. */
  tokenAmount?: bigint;
}): Promise<{ signature: string; outUi: number }> {
  const amount =
    input.side === "buy"
      ? Math.max(1, Math.round(input.usd * 1e6))
      : Number(input.tokenAmount ?? 0n);
  if (!(amount > 0)) throw new Error("Nothing to sell.");
  const inputMint = input.side === "buy" ? USDC : input.mint;
  const outputMint = input.side === "buy" ? input.mint : USDC;
  const quoteUrl = `${QUOTE}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=100&restrictIntermediateTokens=true`;
  const quoteRes = await fetch(quoteUrl, { headers: { accept: "application/json" } });
  const quote = (await quoteRes.json()) as { outAmount?: string; error?: string };
  if (!quoteRes.ok || !quote.outAmount) throw new Error(quote.error || `Jupiter quote ${quoteRes.status}`);

  const swapRes = await fetch(SWAP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: input.owner,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
    }),
  });
  const swap = (await swapRes.json()) as { swapTransaction?: string; error?: string };
  if (!swap.swapTransaction) throw new Error(swap.error || "Jupiter did not build a transaction.");

  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swap.swapTransaction));
  const signature = await sendVersioned(tx);
  const decimals = input.side === "buy" ? 8 : 6;
  return { signature, outUi: Number(quote.outAmount) / 10 ** decimals };
}
