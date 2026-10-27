/** Names the ladder can price today. Each mint returned a live Jupiter price. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { cachedJson } from "@/lib/net-cache";
import { PRESTOCK_MINTS } from "@/lib/phantom";

export type BoardGroup = "company" | "crypto" | "listed" | "stake";

export type BoardName = { symbol: string; mint: string; group: BoardGroup };

const CRYPTO: BoardName[] = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112", group: "crypto" },
  { symbol: "ETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", group: "crypto" },
  { symbol: "BTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", group: "crypto" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", group: "crypto" },
  { symbol: "JLP", mint: "27G8MtK7VtTcCHkpASjSDdkWWYfoqT6ggEuKidVJidD4", group: "crypto" },
  { symbol: "PYTH", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3", group: "crypto" },
  { symbol: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", group: "crypto" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", group: "crypto" },
  { symbol: "RAY", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", group: "crypto" },
  { symbol: "JTO", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL", group: "crypto" },
  { symbol: "ORCA", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE", group: "crypto" },
  { symbol: "RENDER", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof", group: "crypto" },
  { symbol: "PENGU", mint: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv", group: "crypto" },
];

const LISTED: BoardName[] = [
  { symbol: "SPYx", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", group: "listed" },
  { symbol: "QQQx", mint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ", group: "listed" },
  { symbol: "SQQQx", mint: "XsSPkcE4GbHiBacr8awTTHpwFBuznazcwEKgdvBCkoz", group: "listed" },
  { symbol: "USOx", mint: "XsXJBom7kFSxA6hc2ArzUwe6o6zyRU1AdHTfvev1HkG", group: "listed" },
  { symbol: "EWZx", mint: "XsvsSHRUz5dAmUGH9jvVnkEZRcLkgo7uJf1VWhSuVLk", group: "listed" },
  { symbol: "EWJx", mint: "XsaXKP7GaPDA3bLwtuFoZ2oGsaukfeS1v2U1xUeqwrp", group: "listed" },
  { symbol: "AAPLx", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", group: "listed" },
  { symbol: "NVDAx", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", group: "listed" },
  { symbol: "TSLAx", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", group: "listed" },
  { symbol: "SPCXx", mint: "Xs3oZwbHvqis4NYcf4YKWmEia2eC84wSiVrcYcTqpH8", group: "listed" },
];

const STAKE: BoardName[] = [
  { symbol: "JitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", group: "stake" },
  { symbol: "JupSOL", mint: "jupSoLaHXQiZZTSfEWMTRRgpnyFm8f6sZdosWBjx93v", group: "stake" },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", group: "stake" },
  { symbol: "INF", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm", group: "stake" },
  { symbol: "bSOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", group: "stake" },
  { symbol: "hSOL", mint: "he1iusmfkpAdwvxLNGV8Y1iSbj4rUy6yMhEA3fotn9A", group: "stake" },
  { symbol: "dSOL", mint: "Dso1bDeDjCQxTrWHqUUi63oBvV7Mdm6WaobLbQ7gnPQ", group: "stake" },
  { symbol: "PSOL", mint: "pSo1f9nQXWgXibFtKf7NWYxb5enAM4qfP6UJSiXRQfL", group: "stake" },
  { symbol: "bbSOL", mint: "Bybit2vBJGhPF52GBdNaQfUJ6ZpThSgHBobjWZpLPb4B", group: "stake" },
  { symbol: "vSOL", mint: "vSoLxydx6akxyMD9XEcPvGYNGq6Nn66oqVb3UkGkei7", group: "stake" },
  { symbol: "JSOL", mint: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn", group: "stake" },
  { symbol: "BNSOL", mint: "BNso1VUJnh4zcfpZa6986Ea66P6TCp59hvtNJ8b1X85", group: "stake" },
  { symbol: "bonkSOL", mint: "BonK1YhkXEGLZzwtcvRTip3gAL9nCeQD7ppZBLXhtTs", group: "stake" },
  { symbol: "bpSOL", mint: "BPSoLzmLQn47EP5aa7jmFngRL8KC3TWAeAwXwZD8ip3P", group: "stake" },
  { symbol: "hyloSOL", mint: "hy1oXYgrBW6PVcJ4s6s2FKavRdwgWTXdfE69AxT7kPT", group: "stake" },
];

export const UNIVERSE: BoardName[] = [
  ...PRESTOCK_MINTS.filter(([s]) => s !== "POLYMARKET").map(([symbol, mint]) => ({ symbol, mint, group: "company" as const })),
  ...CRYPTO,
  ...STAKE,
  ...LISTED,
];

export type TapeRow = BoardName & { price: number; change: number };

/** One Jupiter price call for every name on the ladder. */
export const loadTape = createServerFn({ method: "GET" }).handler(async (): Promise<TapeRow[]> => {
  const ids = UNIVERSE.map((n) => n.mint).join(",");
  const r = await cachedJson(`https://lite-api.jup.ag/price/v3?ids=${ids}`, 15_000);
  if (!r.ok) throw new Error("Prices did not come back.");
  const body = r.body as Record<string, { usdPrice?: number; priceChange24h?: number }>;
  return UNIVERSE.map((n) => {
    const row = body[n.mint] || {};
    return { ...n, price: Number(row.usdPrice) || 0, change: Number(row.priceChange24h) || 0 };
  }).filter((n) => n.price > 0);
});

export type Pulse = { rows: TapeRow[]; slot: number; ms: number };

/** Prices and the latest processed slot, timed as one round trip. */
export const loadPulse = createServerFn({ method: "GET" }).handler(async (): Promise<Pulse> => {
  const t0 = Date.now();
  const ids = UNIVERSE.map((n) => n.mint).join(",");
  const [price, slot] = await Promise.all([
    cachedJson(`https://lite-api.jup.ag/price/v3?ids=${ids}`, 15_000).then((r) => {
      if (!r.ok) throw new Error("Prices did not come back.");
      return r.body as Record<string, { usdPrice?: number; priceChange24h?: number }>;
    }),
    fetch("https://solana-rpc.publicnode.com", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSlot", params: [{ commitment: "processed" }] }),
    })
      .then(async (r) => {
        const j = (await r.json()) as { result?: number };
        return Number(j.result) || 0;
      })
      .catch(() => 0),
  ]);
  const rows = UNIVERSE.map((n) => {
    const row = price[n.mint] || {};
    return { ...n, price: Number(row.usdPrice) || 0, change: Number(row.priceChange24h) || 0 };
  }).filter((n) => n.price > 0);
  return { rows, slot, ms: Date.now() - t0 };
});

const SPOT: Record<string, string> = {
  So11111111111111111111111111111111111111112: "solana",
  "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh": "bitcoin",
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": "ethereum",
  "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW": "pax-gold",
};
const EURC = "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr";
const MXNE = "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa";

async function spotFallback(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const names = [...new Set(ids.map((id) => SPOT[id]).filter(Boolean))];
  if (names.length) {
    const r = await cachedJson(`https://api.coingecko.com/api/v3/simple/price?ids=${names.join(",")}&vs_currencies=usd`, 20_000);
    if (r.ok) {
      const body = r.body as Record<string, { usd?: number }>;
      for (const id of ids) {
        const px = Number(body[SPOT[id] || ""]?.usd);
        if (px > 0) out.set(id, px);
      }
    }
  }
  if (ids.includes(EURC) || ids.includes(MXNE)) {
    const r = await cachedJson("https://api.frankfurter.app/latest?from=USD&to=EUR,MXN", 60_000);
    if (r.ok) {
      const rates = (r.body as { rates?: { EUR?: number; MXN?: number } }).rates || {};
      if (rates.EUR && rates.EUR > 0) out.set(EURC, 1 / rates.EUR);
      if (rates.MXN && rates.MXN > 0) out.set(MXNE, 1 / rates.MXN);
    }
  }
  return out;
}

/** Prices for mints this wallet holds that are not already on the ladder. */
export const priceMints = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ ids: z.array(z.string().min(32).max(48)).max(40) }).parse(input))
  .handler(async ({ data }): Promise<Array<{ mint: string; price: number }>> => {
    if (!data.ids.length) return [];
    const r = await cachedJson(`https://lite-api.jup.ag/price/v3?ids=${data.ids.join(",")}`, 15_000);
    const body = r.ok ? (r.body as Record<string, { usdPrice?: number }>) : {};
    const missing = data.ids.filter((mint) => !(Number(body[mint]?.usdPrice) > 0));
    const fallback = missing.length ? await spotFallback(missing) : new Map<string, number>();
    return data.ids.map((mint) => ({ mint, price: Number(body[mint]?.usdPrice) || fallback.get(mint) || 0 }));
  });

