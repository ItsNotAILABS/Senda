/** LI.FI quotes. The wallet sends the transaction. A missing transaction is not a fill. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVM_CHAINS, EVM_MARKETS, balanceOfCall, decodeBalance, quoteIsSane, rawAmount, readLifi, type LifiQuote } from "@/lib/trade-book.mjs";

const QUOTE = "https://li.quest/v1/quote";
const SOLANA_CHAIN = 1151111081099710;
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const USDC_RAILS = [
  { id: "solana", label: "Solana", kind: "solana", chainId: SOLANA_CHAIN, usdc: SOL_USDC, decimals: 6 },
  { id: "base", label: "Base", kind: "evm", chainId: 8453, usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  { id: "arbitrum", label: "Arbitrum", kind: "evm", chainId: 42161, usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  { id: "optimism", label: "Optimism", kind: "evm", chainId: 10, usdc: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
  { id: "ethereum", label: "Ethereum", kind: "evm", chainId: 1, usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { id: "polygon", label: "Polygon", kind: "evm", chainId: 137, usdc: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  { id: "avalanche", label: "Avalanche", kind: "evm", chainId: 43114, usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
] as const;

export type UsdcRailId = (typeof USDC_RAILS)[number]["id"];
export type BridgeRailId = Exclude<UsdcRailId, "solana">;
export const BRIDGE_RAILS: readonly { id: BridgeRailId; label: string }[] = USDC_RAILS.filter((row): row is Extract<(typeof USDC_RAILS)[number], { kind: "evm" }> => row.kind === "evm");

const RAIL_IDS = USDC_RAILS.map((row) => row.id) as [UsdcRailId, ...UsdcRailId[]];

export type UsdcMove =
  | { ok: false; error: string }
  | { ok: true; kind: "solana"; tool: string; toUi: number; fromUsd: string; toUsd: string; tx: string }
  | { ok: true; kind: "evm"; tool: string; toUi: number; fromUsd: string; toUsd: string; quote: LifiQuote; fromToken: string; fromChainId: number };

function rail(id: string) {
  return USDC_RAILS.find((row) => row.id === id) ?? null;
}

function lifiFault(status: number, text: string): string {
  if (status === 429) return "LI.FI is busy. Wait a moment.";
  try {
    const body = JSON.parse(text) as { message?: unknown };
    const msg = typeof body.message === "string" ? body.message.trim() : "";
    if (msg) return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
  } catch {
    /* not json */
  }
  return `LI.FI ${status}`;
}

async function lifiGet(params: Record<string, string>): Promise<{ error: string } | unknown> {
  const url = new URL(QUOTE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "Senda" } });
    const text = await res.text();
    if (!res.ok) return { error: lifiFault(res.status, text) };
    return JSON.parse(text) as unknown;
  } catch {
    return { error: "LI.FI did not quote." };
  }
}

function priced(body: unknown, outDecimals: number): { error: string } | { tool: string; toUi: number; fromUsd: string; toUsd: string; txTo: string; txData: string } {
  if (!body || typeof body !== "object") return { error: "LI.FI did not quote." };
  const estimate = (body as { estimate?: { tool?: unknown; toAmount?: unknown; fromAmountUSD?: unknown; toAmountUSD?: unknown } }).estimate;
  if (!estimate?.toAmount) return { error: "LI.FI did not quote." };
  const fromUsd = estimate.fromAmountUSD != null ? String(estimate.fromAmountUSD) : "";
  const toUsd = estimate.toAmountUSD != null ? String(estimate.toAmountUSD) : "";
  if (!fromUsd || !toUsd) return { error: "LI.FI did not price this in dollars. Nothing was signed." };
  if (!quoteIsSane(fromUsd, toUsd)) return { error: `The quote is more than 5% under the dollars in (${fromUsd} to ${toUsd}). Nothing was signed.` };
  const toUi = Number(estimate.toAmount) / 10 ** outDecimals;
  if (!(toUi > 0)) return { error: "LI.FI did not quote an amount." };
  const tx = (body as { transactionRequest?: { to?: unknown; data?: unknown } }).transactionRequest;
  return {
    tool: String(estimate.tool || "LI.FI"),
    toUi,
    fromUsd,
    toUsd,
    txTo: String(tx?.to || ""),
    txData: String(tx?.data || ""),
  };
}

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
  const params: Record<string, string> = {
    fromChain: String(market.chainId),
    toChain: String(market.chainId),
    fromToken: sell ? market.token : market.usdc,
    toToken: sell ? market.usdc : market.token,
    fromAmount: amount.toString(),
    slippage: "0.01",
  };
  if (input.fromAddress) params.fromAddress = input.fromAddress;
  const body = await lifiGet(params);
  if (body && typeof body === "object" && "error" in body && typeof (body as { error?: unknown }).error === "string" && !("estimate" in body)) {
    return { error: (body as { error: string }).error };
  }
  const parsed = readLifi(body);
  if (!parsed) return { error: "LI.FI did not quote." };
  return parsed;
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

function addressOk(kind: "solana" | "evm", address: string): boolean {
  if (kind === "evm") return /^0x[a-fA-F0-9]{40}$/.test(address) && !/^0x0{40}$/i.test(address);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

/** USDC on one chain to USDC on another. Returns a transaction only when the dollars out stay within 5%. */
export async function fetchUsdcMove(input: { from: UsdcRailId; to: UsdcRailId; usd: number; fromAddress: string; toAddress: string }): Promise<UsdcMove> {
  const source = rail(input.from);
  const dest = rail(input.to);
  if (!source || !dest) return { ok: false, error: "That chain is not on this rail." };
  if (source.id === dest.id) return { ok: false, error: "Pick two chains. USDC on the same chain is already USDC." };
  if (!addressOk(source.kind, input.fromAddress)) return { ok: false, error: source.kind === "solana" ? "That is not a Solana address." : "That is not an Ethereum address." };
  if (!addressOk(dest.kind, input.toAddress)) return { ok: false, error: dest.kind === "solana" ? "That is not a Solana address." : "That is not an Ethereum address." };
  const raw = Math.round(input.usd * 1_000_000);
  if (!(raw > 0)) return { ok: false, error: "Enter an amount." };
  const body = await lifiGet({
    fromChain: String(source.chainId),
    toChain: String(dest.chainId),
    fromToken: source.usdc,
    toToken: dest.usdc,
    fromAmount: String(raw),
    fromAddress: input.fromAddress,
    toAddress: input.toAddress,
    slippage: "0.01",
  });
  if (body && typeof body === "object" && "error" in body && !("estimate" in body)) return { ok: false, error: (body as { error: string }).error };
  const row = priced(body, dest.decimals);
  if ("error" in row) return { ok: false, error: row.error };
  if (!row.txData) return { ok: false, error: "LI.FI did not build a transaction. Nothing was signed." };
  if (source.kind === "solana") {
    if (row.txTo) return { ok: false, error: "LI.FI returned an Ethereum transaction for a Solana send. Nothing was signed." };
    if (!/^[A-Za-z0-9+/=]+$/.test(row.txData)) return { ok: false, error: "LI.FI returned a transaction this desk cannot sign." };
    return { ok: true, kind: "solana", tool: row.tool, toUi: row.toUi, fromUsd: row.fromUsd, toUsd: row.toUsd, tx: row.txData };
  }
  const quote = readLifi(body);
  if (!quote?.ready) return { ok: false, error: "LI.FI did not build a transaction. Nothing was signed." };
  return { ok: true, kind: "evm", tool: row.tool, toUi: row.toUi, fromUsd: row.fromUsd, toUsd: row.toUsd, quote, fromToken: source.usdc, fromChainId: source.chainId };
}

export const quoteUsdcMove = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        from: z.enum(RAIL_IDS),
        to: z.enum(RAIL_IDS),
        usd: z.number().positive().max(5000),
        fromAddress: z.string().min(32).max(66),
        toAddress: z.string().min(32).max(66),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchUsdcMove(data));

/** Solana USDC out, USDC on the chain they pick. Phantom signs the Solana transaction. */
export async function fetchUsdcBridge(input: { rail: BridgeRailId; usd: number; fromAddress: string; toAddress: string }): Promise<{ error: string } | { tool: string; toUi: number; tx: string }> {
  const move = await fetchUsdcMove({ from: "solana", to: input.rail, usd: input.usd, fromAddress: input.fromAddress, toAddress: input.toAddress });
  if (!move.ok) return { error: move.error };
  if (move.kind !== "solana") return { error: "LI.FI did not return a Solana transaction." };
  return { tool: move.tool, toUi: move.toUi, tx: move.tx };
}

export const getUsdcBridge = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        rail: z.enum(["base", "arbitrum", "optimism", "ethereum", "polygon", "avalanche"]),
        usd: z.number().positive().max(5000),
        fromAddress: z.string().min(32).max(44),
        toAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => fetchUsdcBridge(data));

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
