/** LI.FI quote for a same-chain USDC swap. The wallet sends the transaction. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVM_MARKETS, rawAmount, readLifi, type LifiQuote } from "@/lib/trade-book.mjs";

const QUOTE = "https://li.quest/v1/quote";

export async function fetchLifi(input: {
  tape: string;
  usd: number;
  fromAddress?: string;
}): Promise<LifiQuote | { error: string }> {
  const market = EVM_MARKETS.find((row) => row.tape === input.tape);
  if (!market) return { error: "This desk cannot sign that chain." };
  const amount = rawAmount(input.usd, market.usdcDecimals);
  const url = new URL(QUOTE);
  url.searchParams.set("fromChain", String(market.chainId));
  url.searchParams.set("toChain", String(market.chainId));
  url.searchParams.set("fromToken", market.usdc);
  url.searchParams.set("toToken", market.token);
  url.searchParams.set("fromAmount", amount.toString());
  url.searchParams.set("slippage", "0.01");
  if (input.fromAddress) url.searchParams.set("fromAddress", input.fromAddress);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" } });
    const text = await res.text();
    if (!res.ok) return { error: res.status === 429 ? "LI.FI is busy. Wait a moment." : `LI.FI ${res.status}` };
    const parsed = readLifi(JSON.parse(text));
    if (!parsed) return { error: "LI.FI did not quote." };
    return parsed;
  } catch {
    return { error: "LI.FI did not quote." };
  }
}

export const getLifiQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        tape: z.string().min(2).max(12),
        usd: z.number().positive().max(5000),
        fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchLifi(data));
