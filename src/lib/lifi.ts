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

const SOLANA_CHAIN = "1151111081099710";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/** USDC on Solana to USDC on another chain. The connected wallet signs the Solana transaction. */
export const BRIDGE_RAILS = [
  { id: "base", label: "Base", chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
  { id: "eth", label: "Ethereum", chainId: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  { id: "arb", label: "Arbitrum", chainId: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
  { id: "pol", label: "Polygon", chainId: 137, usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
] as const;

export type BridgeRailId = (typeof BRIDGE_RAILS)[number]["id"];

export async function fetchUsdcBridge(input: {
  rail: BridgeRailId;
  usd: number;
  fromAddress: string;
  toAddress: string;
}): Promise<{ toUi: number; tx: string; tool: string } | { error: string }> {
  const rail = BRIDGE_RAILS.find((row) => row.id === input.rail);
  if (!rail) return { error: "That chain is not on this desk." };
  if (!(input.usd > 0) || input.usd > 5000) return { error: "Enter an amount under $5,000." };
  const url = new URL(QUOTE);
  url.searchParams.set("fromChain", SOLANA_CHAIN);
  url.searchParams.set("toChain", String(rail.chainId));
  url.searchParams.set("fromToken", SOL_USDC);
  url.searchParams.set("toToken", rail.usdc);
  url.searchParams.set("fromAmount", String(Math.round(input.usd * 1_000_000)));
  url.searchParams.set("fromAddress", input.fromAddress);
  url.searchParams.set("toAddress", input.toAddress);
  url.searchParams.set("slippage", "0.01");
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" } });
    const text = await res.text();
    if (!res.ok) return { error: res.status === 429 ? "LI.FI is busy. Wait a moment." : `LI.FI ${res.status}` };
    const body = JSON.parse(text) as {
      tool?: string;
      estimate?: { toAmount?: string };
      transactionRequest?: { data?: string };
    };
    const tx = body.transactionRequest?.data || "";
    const raw = Number(body.estimate?.toAmount || 0);
    if (!tx || !(raw > 0)) return { error: "LI.FI did not build a transaction." };
    return { toUi: raw / 1_000_000, tx, tool: body.tool || "LI.FI" };
  } catch {
    return { error: "LI.FI did not quote." };
  }
}

export const getUsdcBridge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        rail: z.enum(["base", "eth", "arb", "pol"]),
        usd: z.number().positive().max(5000),
        fromAddress: z.string().min(32).max(48),
        toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchUsdcBridge(data));

