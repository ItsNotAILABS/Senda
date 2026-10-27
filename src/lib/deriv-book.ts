/** FX, metals, energy, indexes, and names. Ostium prints the price. Avantis is the Base book when one is listed. A Solana mint, when one exists, is the thing you can keep. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DerivLane = "fx" | "metals" | "energy" | "softs" | "index" | "crypto" | "shares";

export type DerivPair = {
  id: string;
  base: string;
  quote: string;
  lane: DerivLane;
  ostium: string | null;
  avantis: string | null;
  hold: { mint: string; symbol: string; note: string } | null;
};

export const DERIVS: DerivPair[] = [
  { id: "eurusd", base: "EUR", quote: "USD", lane: "fx", ostium: "EUR-USD", avantis: "EUR/USD", hold: { mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", symbol: "EURC", note: "One euro, kept in the wallet. Not the perp." } },
  { id: "gbpusd", base: "GBP", quote: "USD", lane: "fx", ostium: "GBP-USD", avantis: "GBP/USD", hold: null },
  { id: "usdjpy", base: "USD", quote: "JPY", lane: "fx", ostium: "USD-JPY", avantis: "USD/JPY", hold: null },
  { id: "audusd", base: "AUD", quote: "USD", lane: "fx", ostium: "AUD-USD", avantis: "AUD/USD", hold: null },
  { id: "nzdusd", base: "NZD", quote: "USD", lane: "fx", ostium: "NZD-USD", avantis: "NZD/USD", hold: null },
  { id: "usdcad", base: "USD", quote: "CAD", lane: "fx", ostium: "USD-CAD", avantis: "USD/CAD", hold: null },
  { id: "usdchf", base: "USD", quote: "CHF", lane: "fx", ostium: "USD-CHF", avantis: "USD/CHF", hold: null },
  { id: "usdmxn", base: "USD", quote: "MXN", lane: "fx", ostium: "USD-MXN", avantis: "USD/MXN", hold: null },
  { id: "usdbrl", base: "USD", quote: "BRL", lane: "fx", ostium: null, avantis: "USD/BRL", hold: null },
  { id: "xau", base: "XAU", quote: "USD", lane: "metals", ostium: "XAU-USD", avantis: "XAU/USD", hold: { mint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW", symbol: "PAXG", note: "One ounce of gold in the wallet. The perp is separate." } },
  { id: "xag", base: "XAG", quote: "USD", lane: "metals", ostium: "XAG-USD", avantis: "XAG/USD", hold: { mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo", symbol: "SLV", note: "The silver trust, kept in the wallet." } },
  { id: "xpt", base: "XPT", quote: "USD", lane: "metals", ostium: "XPT-USD", avantis: null, hold: null },
  { id: "xpd", base: "XPD", quote: "USD", lane: "metals", ostium: "XPD-USD", avantis: null, hold: null },
  { id: "xcu", base: "XCU", quote: "USD", lane: "metals", ostium: "XCU-USD", avantis: null, hold: null },
  { id: "btc", base: "BTC", quote: "USD", lane: "crypto", ostium: "BTC-USD", avantis: "BTC/USD", hold: { mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", symbol: "BTC", note: "Portal bitcoin on Solana. Not the perp." } },
  { id: "eth", base: "ETH", quote: "USD", lane: "crypto", ostium: "ETH-USD", avantis: "ETH/USD", hold: { mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", note: "Portal ether on Solana. Not the perp." } },
  { id: "sol", base: "SOL", quote: "USD", lane: "crypto", ostium: "SOL-USD", avantis: "SOL/USD", hold: { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", note: "SOL itself. Not the perp." } },
  { id: "xrp", base: "XRP", quote: "USD", lane: "crypto", ostium: "XRP-USD", avantis: null, hold: null },
  { id: "ada", base: "ADA", quote: "USD", lane: "crypto", ostium: "ADA-USD", avantis: null, hold: null },
  { id: "bnb", base: "BNB", quote: "USD", lane: "crypto", ostium: "BNB-USD", avantis: null, hold: null },
  { id: "link", base: "LINK", quote: "USD", lane: "crypto", ostium: "LINK-USD", avantis: null, hold: null },
  { id: "hype", base: "HYPE", quote: "USD", lane: "crypto", ostium: "HYPE-USD", avantis: null, hold: null },
  { id: "trx", base: "TRX", quote: "USD", lane: "crypto", ostium: "TRX-USD", avantis: null, hold: null },
  { id: "wti", base: "WTI", quote: "USD", lane: "energy", ostium: "WTI-USD", avantis: null, hold: null },
  { id: "brent", base: "BRENT", quote: "USD", lane: "energy", ostium: "BRENT-USD", avantis: null, hold: null },
  { id: "diesel", base: "DIESEL", quote: "USD", lane: "energy", ostium: "DIESEL-USD", avantis: null, hold: null },
  { id: "ung", base: "UNG", quote: "USD", lane: "energy", ostium: "UNG-USD", avantis: null, hold: null },
  { id: "xom", base: "XOM", quote: "USD", lane: "energy", ostium: "XOM-USD", avantis: null, hold: null },
  { id: "cvx", base: "CVX", quote: "USD", lane: "energy", ostium: "CVX-USD", avantis: null, hold: null },
  { id: "shel", base: "SHEL", quote: "USD", lane: "energy", ostium: "SHEL-USD", avantis: null, hold: null },
  { id: "cocoa", base: "COCOA", quote: "USD", lane: "softs", ostium: "COCOA-USD", avantis: null, hold: null },
  { id: "coffee", base: "COFFEE", quote: "USD", lane: "softs", ostium: "COFFEE-USD", avantis: null, hold: null },
  { id: "cotton", base: "COTTON", quote: "USD", lane: "softs", ostium: "COTTON-USD", avantis: null, hold: null },
  { id: "sugar", base: "SUGAR", quote: "USD", lane: "softs", ostium: "SUGAR-USD", avantis: null, hold: null },
  { id: "us500", base: "US500", quote: "USD", lane: "index", ostium: "US500-USD", avantis: null, hold: null },
  { id: "us100", base: "US100", quote: "USD", lane: "index", ostium: "US100-USD", avantis: null, hold: null },
  { id: "us30", base: "US30", quote: "USD", lane: "index", ostium: "US30-USD", avantis: null, hold: null },
  { id: "ger40", base: "GER40", quote: "EUR", lane: "index", ostium: "GER40-EUR", avantis: null, hold: null },
  { id: "uk100", base: "UK100", quote: "GBP", lane: "index", ostium: "UK100-GBP", avantis: null, hold: null },
  { id: "jp225", base: "JP225", quote: "JPY", lane: "index", ostium: "JP225-JPY", avantis: null, hold: null },
  { id: "hk50", base: "HK50", quote: "HKD", lane: "index", ostium: "HK50-HKD", avantis: null, hold: null },
  { id: "nvda", base: "NVDA", quote: "USD", lane: "shares", ostium: "NVDA-USD", avantis: null, hold: null },
  { id: "aapl", base: "AAPL", quote: "USD", lane: "shares", ostium: "AAPL-USD", avantis: null, hold: null },
  { id: "tsla", base: "TSLA", quote: "USD", lane: "shares", ostium: "TSLA-USD", avantis: null, hold: null },
  { id: "msft", base: "MSFT", quote: "USD", lane: "shares", ostium: "MSFT-USD", avantis: null, hold: null },
  { id: "amzn", base: "AMZN", quote: "USD", lane: "shares", ostium: "AMZN-USD", avantis: null, hold: null },
  { id: "meta", base: "META", quote: "USD", lane: "shares", ostium: "META-USD", avantis: null, hold: null },
  { id: "goog", base: "GOOG", quote: "USD", lane: "shares", ostium: "GOOG-USD", avantis: null, hold: null },
  { id: "nflx", base: "NFLX", quote: "USD", lane: "shares", ostium: "NFLX-USD", avantis: null, hold: null },
  { id: "amd", base: "AMD", quote: "USD", lane: "shares", ostium: "AMD-USD", avantis: null, hold: null },
  { id: "avgo", base: "AVGO", quote: "USD", lane: "shares", ostium: "AVGO-USD", avantis: null, hold: null },
  { id: "coin", base: "COIN", quote: "USD", lane: "shares", ostium: "COIN-USD", avantis: null, hold: null },
  { id: "pltr", base: "PLTR", quote: "USD", lane: "shares", ostium: "PLTR-USD", avantis: null, hold: null },
  { id: "hyg", base: "HYG", quote: "USD", lane: "shares", ostium: "HYG-USD", avantis: null, hold: null },
  { id: "tlt", base: "TLT", quote: "USD", lane: "shares", ostium: "TLT-USD", avantis: null, hold: null },
  { id: "xle", base: "XLE", quote: "USD", lane: "shares", ostium: "XLE-USD", avantis: null, hold: null },
  { id: "ura", base: "URA", quote: "USD", lane: "shares", ostium: "URA-USD", avantis: null, hold: null },
];

export type DerivRow = DerivPair & {
  mid: number | null;
  bid: number | null;
  ask: number | null;
  open: boolean | null;
  maxLev: number | null;
  oi: number | null;
  openFee: number | null;
  minNotional: number | null;
  /** Jupiter price of the Solana hold, when this pair has one. */
  spot: number | null;
};

type OstiumPx = { pair?: string; mid?: number; bid?: number; ask?: number; isMarketOpen?: boolean };
type AvPair = {
  from?: string;
  to?: string;
  isPairListed?: boolean;
  leverages?: { maxLeverage?: number };
  pairOI?: number;
  openFeeP?: number;
  minLevPosUSDC?: number;
  pairMinLevPosUSDC?: number;
  feed?: { attributes?: { isOpen?: boolean } };
};

export const derivBook = createServerFn({ method: "GET" }).handler(async () => {
  const [ostRes, avRes] = await Promise.all([
    fetch("https://builder.prod.bedrock.ostium.io/v1/prices", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null),
    fetch("https://data.avantisfi.com/v2/trading", { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) }).catch(() => null),
  ]);
  const ostium = new Map<string, OstiumPx>();
  if (ostRes?.ok) {
    const body = (await ostRes.json()) as { prices?: OstiumPx[] };
    for (const row of body.prices ?? []) if (row.pair) ostium.set(row.pair, row);
  }
  const avantis = new Map<string, AvPair>();
  if (avRes?.ok) {
    const body = (await avRes.json()) as { pairInfos?: Record<string, AvPair> };
    for (const row of Object.values(body.pairInfos ?? {})) {
      if (row.from && row.to) avantis.set(`${row.from}/${row.to}`, row);
    }
  }
  const holds = [...new Set(DERIVS.map((p) => p.hold?.mint).filter((m): m is string => Boolean(m)))];
  const spot = new Map<string, number>();
  if (holds.length) {
    const px = await fetch(`https://api.jup.ag/price/v3?ids=${holds.join(",")}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (px?.ok) {
      const body = (await px.json()) as Record<string, { usdPrice?: number }>;
      for (const mint of holds) {
        const usd = Number(body[mint]?.usdPrice);
        if (usd > 0) spot.set(mint, usd);
      }
    }
  }
  const knownOst = new Set(DERIVS.map((pair) => pair.ostium).filter((id): id is string => Boolean(id)));
  const knownAv = new Set(DERIVS.map((pair) => pair.avantis).filter((id): id is string => Boolean(id)));
  const fill = (pair: DerivPair): DerivRow => {
    const ostKey = pair.ostium || `${pair.base}-${pair.quote}`;
    const px = ostium.get(ostKey);
    const av = pair.avantis ? avantis.get(pair.avantis) : undefined;
    return {
      ...pair,
      ostium: px ? ostKey : pair.ostium,
      mid: px?.mid && px.mid > 0 ? px.mid : null,
      bid: px?.bid && px.bid > 0 ? px.bid : null,
      ask: px?.ask && px.ask > 0 ? px.ask : null,
      open: px?.isMarketOpen ?? av?.feed?.attributes?.isOpen ?? null,
      maxLev: av?.leverages?.maxLeverage ?? null,
      oi: typeof av?.pairOI === "number" ? av.pairOI : null,
      openFee: typeof av?.openFeeP === "number" ? av.openFeeP : null,
      minNotional: av?.minLevPosUSDC ?? av?.pairMinLevPosUSDC ?? null,
      spot: pair.hold ? spot.get(pair.hold.mint) ?? null : null,
    };
  };
  const rows = DERIVS.map(fill);
  const seen = new Set(rows.map((row) => `${row.base}/${row.quote}`));
  for (const [id, px] of ostium) {
    if (knownOst.has(id) || seen.has(id.replace("-", "/"))) continue;
    const [base, quote] = id.split("-");
    if (!base || !quote) continue;
    const key = `${base}/${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(fill({ id: id.toLowerCase(), base, quote, lane: laneOf(base), ostium: id, avantis: avantis.has(key) ? key : null, hold: null }));
  }
  for (const [id, av] of avantis) {
    if (knownAv.has(id) || seen.has(id) || av.isPairListed === false) continue;
    const [base, quote] = id.split("/");
    if (!base || !quote) continue;
    seen.add(id);
    rows.push(fill({ id: id.toLowerCase().replace("/", "-"), base, quote, lane: laneOf(base), ostium: null, avantis: id, hold: null }));
  }
  return rows;
});

function laneOf(base: string): DerivLane {
  if (["XAU", "XAG", "XPT", "XPD", "XCU"].includes(base)) return "metals";
  if (["WTI", "BRENT", "NATGAS", "UNG"].includes(base)) return "energy";
  if (["COCOA", "COFFEE", "SUGAR", "COTTON"].includes(base)) return "softs";
  if (["US500", "US100", "US30", "GER40", "UK100", "JP225", "HK50", "SPX", "NDX"].includes(base)) return "index";
  if (["EUR", "GBP", "JPY", "AUD", "NZD", "CAD", "CHF", "MXN", "BRL", "USD"].includes(base)) return "fx";
  if (base.length <= 5 && base === base.toUpperCase() && !/^[A-Z]{2,5}$/.test(base)) return "crypto";
  return /^[A-Z]{1,5}$/.test(base) && base.length <= 5 && !["BTC", "ETH", "SOL", "XRP", "DOGE", "BNB", "ADA", "LINK", "AVAX", "HYPE"].includes(base) ? "shares" : "crypto";
}

export type BuiltTx = { to: string; data: string; chainId: number; description?: string };

export const avantisOpen = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        pair: z.string().min(3).max(16),
        trader: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        side: z.enum(["long", "short"]),
        collateral: z.number().positive().max(1_000_000),
        leverage: z.number().positive().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const headers = { accept: "application/json", "content-type": "application/json" };
    const allowance = await fetch("https://tx-builder.avantisfi.com/v2/allowance", {
      method: "POST",
      headers,
      body: JSON.stringify({ trader: data.trader }),
      signal: AbortSignal.timeout(12_000),
    });
    const allowBody = (await allowance.json()) as { ok?: boolean; data?: { allowanceUsdc?: string | number } };
    const have = Number(allowBody.data?.allowanceUsdc ?? 0);
    let approve: BuiltTx | null = null;
    if (!(have >= data.collateral)) {
      const approved = await fetch("https://tx-builder.avantisfi.com/v2/token/approve", {
        method: "POST",
        headers,
        body: JSON.stringify({ trader: data.trader, amountUsdc: data.collateral }),
        signal: AbortSignal.timeout(12_000),
      });
      const body = (await approved.json()) as { ok?: boolean; data?: BuiltTx; error?: { message?: string } };
      if (!body.ok || !body.data?.to || !body.data.data) throw new Error(body.error?.message || "Avantis did not build the approval.");
      if (body.data.chainId !== 8453) throw new Error("That builder is not Base.");
      approve = { to: body.data.to, data: body.data.data, chainId: body.data.chainId };
    }
    const opened = await fetch("https://tx-builder.avantisfi.com/v2/trade/open", {
      method: "POST",
      headers,
      body: JSON.stringify({
        pair: data.pair,
        trader: data.trader,
        side: data.side,
        orderType: "market",
        collateralUsdc: data.collateral,
        leverage: data.leverage,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const tradeBody = (await opened.json()) as {
      ok?: boolean;
      data?: BuiltTx & { meta?: { openPrice?: number } };
      error?: { message?: string };
    };
    if (!tradeBody.ok || !tradeBody.data?.to || !tradeBody.data.data) {
      throw new Error(tradeBody.error?.message || "Avantis did not build the trade.");
    }
    if (tradeBody.data.chainId !== 8453) throw new Error("That builder is not Base.");
    return {
      approve,
      trade: {
        to: tradeBody.data.to,
        data: tradeBody.data.data,
        chainId: 8453,
        description: tradeBody.data.description,
      },
      openPrice: tradeBody.data.meta?.openPrice ?? null,
    };
  });
