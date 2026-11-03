/** Perpl's Monad perp book. Public context. No key. */

import { createServerFn } from "@tanstack/react-start";

export type PerplMarket = {
  id: number;
  name: string;
  price: number;
  marginBps: number;
  open: boolean;
  sizeDecimals: number;
};

type Raw = {
  markets?: Array<{
    id?: number;
    name?: string;
    config?: { is_open?: boolean; price_decimals?: number; initial_margin?: number; size_decimals?: number };
    state?: { mrk?: number | string };
  }>;
};

export const perplBook = createServerFn({ method: "GET" }).handler(async (): Promise<PerplMarket[]> => {
  const res = await fetch("https://app.perpl.xyz/api/v1/pub/context", { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) return [];
  const body = (await res.json()) as Raw;
  return (body.markets ?? []).flatMap((row) => {
    const decimals = row.config?.price_decimals ?? 0;
    const price = Number(row.state?.mrk) / 10 ** decimals;
    if (!row.name || !(price > 0)) return [];
    return [{
      id: Number(row.id) || 0,
      name: row.name,
      price,
      marginBps: Number(row.config?.initial_margin) || 0,
      open: Boolean(row.config?.is_open),
      sizeDecimals: Number(row.config?.size_decimals) || 0,
    }];
  });
});

const ALLOWED = new Set(["/v1/api-key/payload", "/v1/api-key/enroll", "/v1/trading/wallet", "/v1/trading/orders", "/v1/trading/positions"]);

export const perplRelay = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const row = input as { method?: string; target?: string; body?: string; headers?: Record<string, string> };
    if (row.method !== "GET" && row.method !== "POST") throw new Error("Bad method.");
    if (!row.target || !ALLOWED.has(row.target)) throw new Error("That Perpl path is not used.");
    return {
      method: row.method,
      target: row.target,
      body: row.body ?? "",
      headers: row.headers ?? {},
    };
  })
  .handler(async ({ data }) => {
    const headers: Record<string, string> = { accept: "application/json" };
    for (const [key, value] of Object.entries(data.headers)) {
      if (/^x-api-/i.test(key) || key.toLowerCase() === "content-type") headers[key] = value;
    }
    const res = await fetch(`https://app.perpl.xyz/api${data.target}`, {
      method: data.method,
      headers,
      body: data.method === "POST" ? data.body : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    return { status: res.status, text };
  });
