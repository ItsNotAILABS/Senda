import { createServerFn } from "@tanstack/react-start";
import { FALLBACK_USD, type Ccy } from "@/lib/wallet";

const CACHE_MS = 60_000;
let cache: { at: number; usdPer: Record<Ccy, number> } | null = null;

async function getJson(url: string, ms = 3500): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function fetchUsdPer(): Promise<Record<Ccy, number>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.usdPer;
  const usdPer: Record<Ccy, number> = { ...FALLBACK_USD };
  usdPer.USDC = 1;
  try {
    const fx = (await getJson("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,MXN")) as {
      rates?: Record<string, number>;
    };
    const r = fx.rates ?? {};
    if (r.EUR > 0) usdPer.EUR = 1 / r.EUR;
    if (r.GBP > 0) usdPer.GBP = 1 / r.GBP;
    if (r.MXN > 0) usdPer.MXN = 1 / r.MXN;
  } catch {
    /* keep fallback */
  }
  try {
    const jup = (await getJson(
      "https://api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112",
    )) as Record<string, { usdPrice?: number }>;
    const px = jup.So11111111111111111111111111111111111111112?.usdPrice;
    if (px && px > 0) usdPer.SOL = px;
  } catch {
    /* keep fallback */
  }
  cache = { at: Date.now(), usdPer };
  return usdPer;
}

export const getFx = createServerFn({ method: "GET" }).handler(async () => fetchUsdPer());

export function rate(from: Ccy, to: Ccy, usdPer: Record<Ccy, number>): number {
  if (from === to) return 1;
  const a = usdPer[from] || 0;
  const b = usdPer[to] || 0;
  if (!(a > 0) || !(b > 0)) return 0;
  return a / b;
}

export function quoteLine(from: Ccy, to: Ccy, amount: number, usdPer: Record<Ccy, number>): string {
  const r = rate(from, to, usdPer);
  if (!(r > 0)) return "—";
  return `1 ${from} = ${r.toFixed(4)} ${to}`;
}