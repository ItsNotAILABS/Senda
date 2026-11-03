/** Jupiter Perps on Solana. SOL, ETH, and BTC. Phantom signs the transaction Jupiter builds. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://perps-api.jup.ag/v1";
const HEADERS = {
  accept: "application/json",
  "content-type": "application/json",
  "x-perps-api-version": "v2",
};

export const JUP_PERPS = [
  { asset: "SOL", pair: "SOL-USD", mint: "So11111111111111111111111111111111111111112" },
  { asset: "ETH", pair: "ETH-USD", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs" },
  { asset: "BTC", pair: "BTC-USD", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh" },
] as const;

export type JupAsset = (typeof JUP_PERPS)[number]["asset"];

export type JupPerpMarket = {
  asset: JupAsset;
  pair: string;
  mint: string;
  price: number | null;
  change: number | null;
};

export type JupPerpQuote = {
  leverage: string;
  liquidationPriceUsd: string;
  positionSizeUsd: string;
  collateralUsdDelta: string;
  openFeeUsd: string;
};

function usdRaw(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return n / 1e6;
}

async function post(path: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    parsed = { message: text.slice(0, 180) };
  }
  if (!res.ok) {
    const message = typeof parsed.message === "string" ? parsed.message : `Jupiter perps ${res.status}`;
    throw new Error(message);
  }
  return parsed;
}

export const jupPerpBook = createServerFn({ method: "GET" }).handler(async (): Promise<JupPerpMarket[]> => {
  const rows = await Promise.all(
    JUP_PERPS.map(async (pair) => {
      try {
        const res = await fetch(`${BASE}/market-stats?mint=${pair.mint}`, {
          headers: { accept: "application/json", "x-perps-api-version": "v2" },
          signal: AbortSignal.timeout(8000),
        });
        const body = (await res.json()) as { price?: string; priceChange24H?: string };
        const price = Number(body.price);
        const change = Number(body.priceChange24H);
        return { ...pair, price: price > 0 ? price : null, change: Number.isFinite(change) ? change : null };
      } catch {
        return { ...pair, price: null, change: null };
      }
    }),
  );
  return rows;
});

export const jupPerpOpen = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        owner: z.string().min(32).max(50),
        asset: z.enum(["SOL", "ETH", "BTC"]),
        side: z.enum(["long", "short"]),
        collateral: z.number().min(10).max(5000),
        leverage: z.number().min(1.1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const body = await post("/positions/increase", {
      walletAddress: data.owner,
      asset: data.asset,
      inputToken: "USDC",
      inputTokenAmount: String(Math.round(data.collateral * 1e6)),
      side: data.side,
      leverage: String(Math.round(data.leverage * 10) / 10),
      maxSlippageBps: "100",
    });
    const tx = typeof body.serializedTxBase64 === "string" ? body.serializedTxBase64 : "";
    if (!tx) throw new Error("Jupiter did not build the position.");
    const quote = (body.quote ?? {}) as JupPerpQuote;
    return {
      tx,
      quote: {
        leverage: Number(quote.leverage) || data.leverage,
        liquidation: usdRaw(quote.liquidationPriceUsd),
        size: usdRaw(quote.positionSizeUsd),
        collateral: usdRaw(quote.collateralUsdDelta) || data.collateral,
        fee: usdRaw(quote.openFeeUsd),
      },
    };
  });

export type JupPosition = {
  pubkey: string;
  asset: string;
  side: "long" | "short";
  leverage: number;
  size: number;
  collateral: number;
  entry: number;
  mark: number;
  liq: number;
  pnl: number;
};

export const jupPerpPositions = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ owner: z.string().min(32).max(50) }).parse(input))
  .handler(async ({ data }): Promise<JupPosition[]> => {
    const res = await fetch(`${BASE}/positions?walletAddress=${data.owner}`, {
      headers: { accept: "application/json", "x-perps-api-version": "v2" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { dataList?: Array<Record<string, string>> };
    return (body.dataList ?? []).map((row) => ({
      pubkey: String(row.positionPubkey ?? ""),
      asset: String(row.asset ?? ""),
      side: row.side === "short" ? "short" : "long",
      leverage: Number(row.leverage) > 1000 ? Number(row.leverage) / 1e6 : Number(row.leverage) || 0,
      size: usdRaw(row.sizeUsd),
      collateral: usdRaw(row.collateralUsd),
      entry: usdRaw(row.entryPriceUsd),
      mark: usdRaw(row.markPriceUsd),
      liq: usdRaw(row.liquidationPriceUsd),
      pnl: usdRaw(row.pnlAfterFeesUsd),
    }));
  });

export const jupPerpClose = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ position: z.string().min(32).max(50) }).parse(input))
  .handler(async ({ data }) => {
    const body = await post("/positions/decrease", {
      positionPubkey: data.position,
      receiveToken: "USDC",
      entirePosition: true,
      maxSlippageBps: "100",
    });
    const tx = typeof body.serializedTxBase64 === "string" ? body.serializedTxBase64 : "";
    if (!tx) throw new Error("Jupiter did not build the close.");
    return { tx };
  });
