/** One signed swap. Spot, xStock, and PreStock all go through here. The wallet signs. */

import { signStockSwap } from "@/lib/jup-sign";
import { splHolding } from "@/lib/phantom";
import { rememberTrade } from "@/lib/trade-log";

export async function executeTicket(input: {
  owner: string;
  mint: string;
  side: "buy" | "sell";
  usd: number;
  decimals?: number;
  price?: number;
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd >= 1)) throw new Error("A trade is at least $1.");
  if (input.side === "buy") {
    const done = await signStockSwap({
      owner: input.owner,
      mint: input.mint,
      side: "buy",
      usd: input.usd,
      decimals: input.decimals,
    });
    if (typeof window !== "undefined") {
      rememberTrade({
        symbol: input.mint.slice(0, 4),
        side: "buy",
        usd: input.usd,
        mint: input.mint,
        signature: done.signature,
      });
    }
    return done;
  }
  const holding = await splHolding(input.owner, input.mint);
  const have = BigInt(holding.raw || "0");
  if (have <= 0n) throw new Error("This wallet holds none of that.");
  const decimals = holding.decimals || input.decimals || 6;
  const px = input.price ?? 0;
  let tokenAmount = have;
  if (px > 0) {
    const want = BigInt(Math.max(1, Math.floor((input.usd / px) * 10 ** decimals)));
    tokenAmount = want > have ? have : want;
  }
  const done = await signStockSwap({
    owner: input.owner,
    mint: input.mint,
    side: "sell",
    usd: input.usd,
    decimals,
    tokenAmount,
  });
  if (typeof window !== "undefined") {
    rememberTrade({
      symbol: input.mint.slice(0, 4),
      side: input.side,
      usd: input.usd,
      mint: input.mint,
      signature: done.signature,
    });
  }
  return done;
}
