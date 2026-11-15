/** Mayan quote. The referrer is Senda's Solana address. The person pays 8 bps. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MAYAN_FEE_ADDRESS = "4mwAnghwCjCEe9FaMQxEx6B1hmfrXwwPjoeq9MyGG4fF";
export const MAYAN_FEE_BPS = 8;

export const MOVE_LANES = [
  { id: "hl-perps", label: "Hyperliquid perps", where: "USDC collateral", chain: "hypercore", token: "0x0000000000000000000000000000000000000000", dest: "evm" as const },
  { id: "hl-spot", label: "Hyperliquid spot", where: "USDC spot", chain: "hypercore", token: "0x000000000000000000000000000000000000ffff", dest: "evm" as const },
  { id: "base", label: "Base", where: "USDC", chain: "base", token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", dest: "evm" as const },
  { id: "ethereum", label: "Ethereum", where: "USDC", chain: "ethereum", token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", dest: "evm" as const },
  { id: "arbitrum", label: "Arbitrum", where: "USDC", chain: "arbitrum", token: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", dest: "evm" as const },
  { id: "optimism", label: "Optimism", where: "USDC", chain: "optimism", token: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", dest: "evm" as const },
  { id: "polygon", label: "Polygon", where: "USDC", chain: "polygon", token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", dest: "evm" as const },
  { id: "avalanche", label: "Avalanche", where: "USDC", chain: "avalanche", token: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", dest: "evm" as const },
  { id: "bsc", label: "BNB", where: "USDC", chain: "bsc", token: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", dest: "evm" as const },
] as const;

export type MoveLaneId = (typeof MOVE_LANES)[number]["id"];

export type FeeLine = { name: string; value: string; note: string };

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type MoveQuote = {
  lane: MoveLaneId;
  amount: number;
  out: number;
  seconds: number | null;
  route: string;
  lines: FeeLine[];
  quote: Json;
  quotedAt: number;
};

function money(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function num(v: Json | undefined): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function lines(amount: number, quote: Json): FeeLine[] {
  const row = quote && typeof quote === "object" && !Array.isArray(quote) ? quote : {};
  const out = num(row.expectedAmountOut);
  const protocol = num(row.protocolFeeUsd);
  const bridge = num(row.bridgeFee);
  const hcBox = row.hcSwiftDeposit;
  const hc = hcBox && typeof hcBox === "object" && !Array.isArray(hcBox) ? num(hcBox.relayerFee64) / 1e6 : 0;
  const referrer = num(row.referrerFeeUsd);
  const named = protocol + bridge + hc + referrer;
  const spread = Math.max(0, Math.round((amount - out - named) * 1e6) / 1e6);
  const who = `${MAYAN_FEE_ADDRESS.slice(0, 4)}…${MAYAN_FEE_ADDRESS.slice(-4)}`;
  return [
    { name: "You send", value: `$${money(amount)} USDC`, note: "Solana" },
    { name: "Mayan Swift", value: hc > 0 ? `$${money(hc)}` : "None on this route", note: hc > 0 ? "Hyperliquid deposit" : "No separate Swift line" },
    { name: "Circle CCTP", value: bridge > 0 ? `$${money(bridge)}` : "None on this route", note: bridge > 0 ? "Named on the quote" : "Not itemized inside this route" },
    { name: "Mayan protocol", value: protocol > 0 ? `$${money(protocol)}` : "$0.00", note: "Their fee" },
    { name: "Senda", value: referrer > 0 ? `$${money(referrer)}` : "$0.00", note: `${MAYAN_FEE_BPS} bps. You pay it. It lands at ${who}.` },
    { name: "Route spread", value: spread > 0 ? `$${money(spread)}` : "$0.00", note: "Send minus receive, after the lines above." },
    { name: "You receive", value: `$${money(out)}`, note: typeof row.clientEta === "string" ? row.clientEta : "Quote" },
  ];
}

export const mayanQuote = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ lane: z.string(), amount: z.number().min(5).max(5000) }).parse(input))
  .handler(async ({ data }): Promise<MoveQuote> => {
    const lane = MOVE_LANES.find((row) => row.id === data.lane);
    if (!lane) throw new Error("That destination is not on this rail.");
    const q = new URLSearchParams({
      amountIn: String(data.amount),
      fromToken: USDC,
      fromChain: "solana",
      toToken: lane.token,
      toChain: lane.chain,
      slippageBps: "50",
      gasDrop: "0",
      swift: "true",
      mctp: "true",
      fastMctp: "true",
      sdkVersion: "15_3_0",
      solanaProgram: "FC4eXxkyrMPTjiYUpp4EAnkmwMbQyZ6NDCh1kfLn6vsf",
      forwarderAddress: "0x337685fdaB40D39bd02028545a4FfA7D287cC3E2",
      referrer: MAYAN_FEE_ADDRESS,
      referrerBps: String(MAYAN_FEE_BPS),
    });
    const res = await fetch(`https://price-api.mayan.finance/v3/quote?${q}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await res.json()) as { quotes?: Json[]; msg?: string };
    const quote = body.quotes?.[0];
    if (!res.ok || !quote || typeof quote !== "object" || Array.isArray(quote)) throw new Error(body.msg || "Mayan did not quote.");
    if (num(quote.referrerBps) !== MAYAN_FEE_BPS) throw new Error("Mayan did not attach the Senda fee. The quote was not used.");
    return {
      lane: lane.id,
      amount: data.amount,
      out: num(quote.expectedAmountOut),
      seconds: num(quote.etaSeconds) || null,
      route: String(quote.type || "Mayan"),
      lines: lines(data.amount, quote),
      quote,
      quotedAt: Date.now(),
    };
  });
