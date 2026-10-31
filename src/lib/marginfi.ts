/** Marginfi banks, only from a feed that actually answers. No invented rate. */

import { createServerFn } from "@tanstack/react-start";

export type MarginBank = {
  symbol: string;
  supplyApy: number;
  borrowApy: number;
  tvlUsd: number;
};

const HOSTS = [
  "https://api.marginfi.com/v1/banks",
  "https://production.api.marginfi.com/banks",
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function rowsFrom(body: unknown): MarginBank[] {
  const list = Array.isArray(body) ? body : (body as { banks?: unknown[] })?.banks;
  if (!Array.isArray(list)) return [];
  const out: MarginBank[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const symbol = String(row.symbol || row.tokenSymbol || "");
    if (!symbol) continue;
    const supply = num(row.supplyApy ?? row.lendingRate ?? row.depositApy);
    const borrow = num(row.borrowApy ?? row.borrowRate);
    const tvl = num(row.tvlUsd ?? row.totalDepositsUsd ?? row.totalSupplyUsd);
    if (!(supply > 0) && !(borrow > 0)) continue;
    out.push({ symbol, supplyApy: supply > 1 ? supply / 100 : supply, borrowApy: borrow > 1 ? borrow / 100 : borrow, tvlUsd: tvl });
  }
  return out.sort((a, b) => b.tvlUsd - a.tvlUsd).slice(0, 12);
}

export const marginfiBanks = createServerFn({ method: "GET" }).handler(async () => {
  for (const url of HOSTS) {
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(6000) }).catch(() => null);
    if (!res?.ok) continue;
    const rows = rowsFrom(await res.json().catch(() => null));
    if (rows.length) return { ok: true as const, rows, reason: "Marginfi banks." };
  }
  return {
    ok: false as const,
    rows: [] as MarginBank[],
    reason: "Marginfi’s bank list did not answer. No rate is shown, and no deposit is offered.",
  };
});
