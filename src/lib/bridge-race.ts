/** Live quotes for the same  USDC move. The number on the screen is the number just returned. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const USDC_SOL = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_ETH = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const SOL = "4mwAnghwCjCEe9FaMQxEx6B1hmfrXwwPjoeq9MyGG4fF";
const ETH = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export type RaceRow = { name: string; out: number | null; ms: number; note: string };

async function timed(name: string, run: () => Promise<{ out: number; note: string }>): Promise<RaceRow> {
  const started = Date.now();
  try {
    const got = await run();
    return { name, out: got.out, ms: Date.now() - started, note: got.note };
  } catch (e) {
    return { name, out: null, ms: Date.now() - started, note: e instanceof Error ? e.message : "No quote." };
  }
}

export const bridgeRace = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ usd: z.number().min(10).max(10_000) }).parse(input))
  .handler(async ({ data }): Promise<{ at: number; usd: number; rows: RaceRow[] }> => {
    const atoms = Math.round(data.usd * 1e6).toString();
    const rows = await Promise.all([
      timed("Relay", async () => {
        const res = await fetch("https://api.relay.link/quote/v2", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            user: SOL,
            recipient: ETH,
            originChainId: 792703809,
            destinationChainId: 1,
            originCurrency: USDC_SOL,
            destinationCurrency: USDC_ETH,
            amount: atoms,
            tradeType: "EXACT_INPUT",
          }),
          signal: AbortSignal.timeout(12_000),
        });
        const body = (await res.json()) as { message?: string; details?: { currencyOut?: { amount?: string } } };
        const raw = body.details?.currencyOut?.amount;
        if (!res.ok || !raw) throw new Error(body.message || "Relay did not quote.");
        return { out: Number(raw) / 1e6, note: "Solana USDC to Ethereum USDC" };
      }),
      timed("deBridge", async () => {
        const q = new URLSearchParams({
          srcChainId: "7565164",
          srcChainTokenIn: USDC_SOL,
          srcChainTokenInAmount: atoms,
          dstChainId: "1",
          dstChainTokenOut: USDC_ETH,
          dstChainTokenOutRecipient: ETH,
          srcChainOrderAuthorityAddress: SOL,
          dstChainOrderAuthorityAddress: ETH,
        });
        const res = await fetch(`https://dln.debridge.finance/v1.0/dln/order/create-tx?${q}`, { signal: AbortSignal.timeout(12_000) });
        const body = (await res.json()) as { errorMessage?: string; estimation?: { dstChainTokenOut?: { amount?: string; decimals?: number } } };
        const out = body.estimation?.dstChainTokenOut;
        if (!res.ok || !out?.amount) throw new Error(body.errorMessage || "deBridge did not quote.");
        return { out: Number(out.amount) / 10 ** (out.decimals ?? 6), note: "The order this desk can ask the wallet to sign" };
      }),
      timed("Mayan", async () => {
        const q = new URLSearchParams({
          amountIn: String(data.usd),
          fromToken: USDC_SOL,
          fromChain: "solana",
          toToken: USDC_ETH,
          toChain: "ethereum",
          slippageBps: "50",
          gasDrop: "0",
          swift: "true",
          mctp: "true",
          fastMctp: "true",
          sdkVersion: "15_3_0",
          solanaProgram: "FC4eXxkyrMPTjiYUpp4EAnkmwMbQyZ6NDCh1kfLn6vsf",
          forwarderAddress: "0x337685fdaB40D39bd02028545a4FfA7D287cC3E2",
        });
        const res = await fetch(`https://price-api.mayan.finance/v3/quote?${q}`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });
        const body = (await res.json()) as { quotes?: { expectedAmountOut?: number }[]; msg?: string };
        const out = body.quotes?.[0]?.expectedAmountOut;
        if (!res.ok || typeof out !== "number") throw new Error(body.msg || "Mayan did not quote.");
        return { out, note: "No Robinhood route on Mayan" };
      }),
    ]);
    return { at: Date.now(), usd: data.usd, rows };
  });
