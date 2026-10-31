/** Pyth mark for the majors. A stale on-chain account is not used. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FEEDS: Record<string, string> = {
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

const ALIAS: Record<string, string> = { WSOL: "SOL", WBTC: "BTC", WETH: "ETH", CBETH: "ETH" };

export const pythMark = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ symbol: z.string().min(1).max(16) }).parse(input))
  .handler(async ({ data }) => {
    const key = ALIAS[data.symbol.toUpperCase()] || data.symbol.toUpperCase();
    const id = FEEDS[key];
    if (!id) return { ok: false as const, reason: "Pyth is on SOL, BTC, and ETH. This name keeps the pool price." };
    const headers: Record<string, string> = { accept: "application/json" };
    if (process.env.PYTH_API_KEY) headers.authorization = `Bearer ${process.env.PYTH_API_KEY}`;
    const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?parsed=true&ids[]=${id}`, {
      headers,
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (!res) return { ok: false as const, reason: "Pyth did not answer." };
    if (!res.ok) return { ok: false as const, reason: `Pyth refused the price update (${res.status}). The pool price is still the price on the ticket.` };
    const json = (await res.json()) as { parsed?: Array<{ price?: { price?: string; expo?: number } }> };
    const row = json.parsed?.[0]?.price;
    const n = Number(row?.price);
    const expo = Number(row?.expo);
    if (!(n > 0) || !Number.isFinite(expo)) return { ok: false as const, reason: "Pyth returned no price." };
    return { ok: true as const, symbol: key, price: n * 10 ** expo };
  });
