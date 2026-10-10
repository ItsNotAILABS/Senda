/** LI.FI quote for a same-chain USDC swap. The wallet sends the transaction. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVM_CHAINS, EVM_MARKETS, balanceOfCall, decodeBalance, rawAmount, readLifi, type LifiQuote } from "@/lib/trade-book.mjs";

const QUOTE = "https://li.quest/v1/quote";

export async function fetchLifi(input: {
  tape: string;
  usd: number;
  side?: "buy" | "sell";
  tokenRaw?: string;
  fromAddress?: string;
}): Promise<LifiQuote | { error: string }> {
  const market = EVM_MARKETS.find((row) => row.tape === input.tape);
  if (!market) return { error: "This desk cannot sign that chain." };
  const sell = input.side === "sell";
  const amount = sell ? BigInt(input.tokenRaw || "0") : rawAmount(input.usd, market.usdcDecimals);
  if (amount <= 0n) return { error: "This wallet holds none of that token." };
  const url = new URL(QUOTE);
  url.searchParams.set("fromChain", String(market.chainId));
  url.searchParams.set("toChain", String(market.chainId));
  url.searchParams.set("fromToken", sell ? market.token : market.usdc);
  url.searchParams.set("toToken", sell ? market.usdc : market.token);
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
        side: z.enum(["buy", "sell"]).default("buy"),
        tokenRaw: z.string().regex(/^\d+$/).optional(),
        fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchLifi(data));

export async function fetchEvmBalance(chainId: number, token: string, owner: string): Promise<{ raw: string }> {
  const chain = EVM_CHAINS[chainId];
  const data = balanceOfCall(owner);
  if (!chain || !data) return { raw: "0" };
  const res = await fetch(chain.rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: token, data }, "latest"] }),
  });
  if (!res.ok) return { raw: "0" };
  const body = (await res.json()) as { result?: string };
  return { raw: decodeBalance(body.result).toString() };
}

export const readEvmBalance = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        chainId: z.number().int().positive(),
        token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchEvmBalance(data.chainId, data.token, data.owner));
