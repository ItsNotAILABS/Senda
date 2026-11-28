/** Reflect's public API. Mint, redeem, and launch return an unsigned transaction. The wallet signs it. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BASE = "https://prod.api.reflect.money";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

export type ReflectBook = {
  types: { index: number; name: string }[];
  rates: { stablecoin: number; receipt: number | null }[];
  users: number | null;
  supply: number | null;
  volume: number | null;
  apy: { index: number; apy: number }[];
};

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  return res.json();
}

export const reflectBook = createServerFn({ method: "GET" }).handler(async (): Promise<ReflectBook> => {
  const [typesRaw, ratesRaw, statsRaw, apyRaw] = await Promise.all([
    getJson("/stablecoin/types"),
    getJson("/stablecoin/exchange-rates"),
    getJson("/stats"),
    getJson("/stablecoin/apy"),
  ]);
  const types = ((typesRaw as { data?: { index?: number; name?: string }[] } | null)?.data ?? [])
    .filter((row) => typeof row.index === "number" && row.name)
    .map((row) => ({ index: row.index as number, name: row.name as string }));
  const rates = ((ratesRaw as { data?: { stablecoin?: number; receipt_usd_value_bps?: number }[] } | null)?.data ?? []).map((row) => ({
    stablecoin: row.stablecoin ?? 0,
    receipt: typeof row.receipt_usd_value_bps === "number" ? row.receipt_usd_value_bps / 1e9 : null,
  }));
  const stats = (statsRaw as { data?: { users?: number; supply?: string; cumulativeVolume?: string } } | null)?.data;
  const apy = ((apyRaw as { data?: { index?: number; apy?: number }[] } | null)?.data ?? [])
    .filter((row) => typeof row.index === "number" && typeof row.apy === "number")
    .map((row) => ({ index: row.index as number, apy: row.apy as number }));
  return {
    types,
    rates,
    users: typeof stats?.users === "number" ? stats.users : null,
    supply: stats?.supply ? Number(stats.supply) / 1e6 : null,
    volume: stats?.cumulativeVolume ? Number(stats.cumulativeVolume) / 1e6 : null,
    apy,
  };
});

async function postTx(path: string, body: Record<string, unknown>): Promise<{ transaction: string; integrationId?: string }> {
  const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
  const key = process.env.REFLECT_API_KEY;
  if (key) headers["X-API-Key"] = key;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
  const json = (await res.json().catch(() => null)) as { success?: boolean; data?: { transaction?: string; integrationId?: string }; error?: { message?: string } | string; message?: string } | null;
  const tx = json?.data?.transaction;
  if (!res.ok || !tx) {
    const why = (typeof json?.error === "string" ? json.error : json?.error?.message) || json?.message || `Reflect ${res.status}`;
    throw new Error(why);
  }
  return { transaction: tx, integrationId: json?.data?.integrationId };
}

export const reflectTx = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        kind: z.enum(["mint", "burn", "launch"]),
        signer: z.string().min(32).max(64),
        index: z.number().int().min(0).max(8),
        usd: z.number().positive().max(1_000_000).optional(),
        name: z.string().min(1).max(32).optional(),
        symbol: z.string().min(1).max(10).optional(),
        feeBps: z.number().int().min(0).max(10_000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const collateral = data.index === 1 ? USDT : USDC;
    if (data.kind === "launch") {
      if (!data.name || !data.symbol) throw new Error("Name the token and give it a symbol.");
      return postTx("/integration/initialize/flow", {
        signer: data.signer,
        authority: data.signer,
        stablecoin: data.index,
        feeBps: data.feeBps ?? 0,
        feePayer: data.signer,
        metadata: {
          name: data.name,
          symbol: data.symbol.toUpperCase(),
          description: "Issued from Senda. Backed by a Reflect plus asset. The wallet signs.",
          uri: "https://senda.pocketnova.app/favicon.svg",
        },
      });
    }
    if (!(data.usd && data.usd >= 1)) throw new Error("At least $1.");
    const amount = Math.round(data.usd * 1e6);
    return postTx(data.kind === "mint" ? "/stablecoin/mint" : "/stablecoin/burn", {
      stablecoinIndex: data.index,
      depositAmount: amount,
      signer: data.signer,
      collateralMint: collateral,
    });
  });
