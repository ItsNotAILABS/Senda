/** FX, metals, and the large coins. Ostium prints on Arbitrum. Avantis margins on Base. A mint, when one exists, is the Solana hold. */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type DerivLane = "fx" | "metals" | "energy" | "index" | "softs" | "crypto" | "shares";

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
  { id: "usdmxn", base: "USD", quote: "MXN", lane: "fx", ostium: "USD-MXN", avantis: "USD/MXN", hold: { mint: "6zYgzrT7X2wi9a9NeMtUvUWLLmf2a8vBsbYkocYdB9wa", symbol: "MXNe", note: "One peso, kept in the wallet. Not the perp." } },
  { id: "usdbrl", base: "USD", quote: "BRL", lane: "fx", ostium: null, avantis: "USD/BRL", hold: null },
  { id: "xau", base: "XAU", quote: "USD", lane: "metals", ostium: "XAU-USD", avantis: "XAU/USD", hold: { mint: "5GgRAEmv8ZxF2PR5hY72Qs5x1bnQ6UK2RbTPoqJ3wSwW", symbol: "PAXG", note: "One ounce of gold in the wallet. The perp is separate." } },
  { id: "xag", base: "XAG", quote: "USD", lane: "metals", ostium: "XAG-USD", avantis: "XAG/USD", hold: { mint: "iy11ytbSGcUnrjE6Lfv78TFqxKyUESfku1FugS9ondo", symbol: "SLV", note: "The silver trust, kept in the wallet." } },
  { id: "xpt", base: "XPT", quote: "USD", lane: "metals", ostium: "XPT-USD", avantis: null, hold: null },
  { id: "xpd", base: "XPD", quote: "USD", lane: "metals", ostium: "XPD-USD", avantis: null, hold: null },
  { id: "xcu", base: "XCU", quote: "USD", lane: "metals", ostium: "XCU-USD", avantis: null, hold: null },
  { id: "wti", base: "WTI", quote: "USD", lane: "energy", ostium: "WTI-USD", avantis: "WTI/USD", hold: null },
  { id: "brent", base: "BRENT", quote: "USD", lane: "energy", ostium: "BRENT-USD", avantis: "BRENT/USD", hold: null },
  { id: "us500", base: "US500", quote: "USD", lane: "index", ostium: "US500-USD", avantis: "US500/USD", hold: null },
  { id: "us100", base: "US100", quote: "USD", lane: "index", ostium: "US100-USD", avantis: "US100/USD", hold: null },
  { id: "us30", base: "US30", quote: "USD", lane: "index", ostium: "US30-USD", avantis: null, hold: null },
  { id: "cocoa", base: "COCOA", quote: "USD", lane: "softs", ostium: "COCOA-USD", avantis: null, hold: null },
  { id: "coffee", base: "COFFEE", quote: "USD", lane: "softs", ostium: "COFFEE-USD", avantis: null, hold: null },
  { id: "sugar", base: "SUGAR", quote: "USD", lane: "softs", ostium: "SUGAR-USD", avantis: null, hold: null },
  { id: "btc", base: "BTC", quote: "USD", lane: "crypto", ostium: "BTC-USD", avantis: "BTC/USD", hold: { mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", symbol: "BTC", note: "Portal bitcoin on Solana. Not the perp." } },
  { id: "eth", base: "ETH", quote: "USD", lane: "crypto", ostium: "ETH-USD", avantis: "ETH/USD", hold: { mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", symbol: "ETH", note: "Portal ether on Solana. Not the perp." } },
  { id: "sol", base: "SOL", quote: "USD", lane: "crypto", ostium: "SOL-USD", avantis: "SOL/USD", hold: { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", note: "SOL itself. Not the perp." } },
  { id: "bnb", base: "BNB", quote: "USD", lane: "crypto", ostium: "BNB-USD", avantis: "BNB/USD", hold: null },
  { id: "link", base: "LINK", quote: "USD", lane: "crypto", ostium: "LINK-USD", avantis: "LINK/USD", hold: null },
  { id: "hype", base: "HYPE", quote: "USD", lane: "crypto", ostium: "HYPE-USD", avantis: "HYPE/USD", hold: null },
  ...listed("crypto", ["AAVE", "AERO", "ARB", "ASTER", "AVAX", "BERA", "DOGE", "EIGEN", "ENA", "FARTCOIN", "INJ", "JUP", "KAITO", "LDO", "LIT", "NEAR", "OP", "PENDLE", "PENGU", "POL", "PUMP", "RENDER", "SEI", "SUI", "TAO", "TIA", "TRUMP", "VIRTUAL", "WIF", "WLD", "XMR", "XPL", "XRP", "ZEC", "ZRO"]),
  ...listed("fx", ["USDCNH", "USDSEK", "USDSGD"]),
  ...listed("shares", ["AAPL", "ABNB", "ADBE", "ADI", "ADP", "ADSK", "ALAB", "AMD", "AMGN", "AMZN", "ANET", "APP", "ARM", "ASTS", "AVGO", "AXON", "BA", "BABA", "BB", "BE", "BKNG", "CDNS", "CEG", "COIN", "CRCL", "CRWV", "CSCO", "DASH", "DDOG", "DELL", "FTNT", "GILD", "GOOG", "GRAB", "HON", "HOOD", "INTC", "INTU", "IREN", "ISRG", "KLAC", "LIN", "LITE", "LLY", "LRCX", "MCHP", "MELI", "META", "MPWR", "MRNA", "MRVL", "MSFT", "MSTR", "MU", "NBIS", "NFLX", "NOW", "NVDA", "NXPI", "PANW", "PDD", "PLTR", "PYPL", "REGN", "RKLB", "SHOP", "SNDK", "SNPS", "SOFI", "STX", "TER", "TMUS", "TSLA", "TTWO", "TXN", "UBER", "VRTX", "VST", "WDAY", "WDC", "WMT"]),
];

function listed(lane: DerivLane, names: string[]): DerivPair[] {
  return names.map((name) => {
    const fx = name.startsWith("USD") && name.length === 6;
    const base = fx ? "USD" : name;
    const quote = fx ? name.slice(3) : "USD";
    return { id: name.toLowerCase(), base, quote, lane, ostium: null, avantis: `${base}/${quote}`, hold: null };
  });
}

export type DerivRow = DerivPair & {
  mid: number | null;
  bid: number | null;
  ask: number | null;
  open: boolean | null;
  maxLev: number | null;
  oi: number | null;
  maxOi: number | null;
  openFee: number | null;
  minNotional: number | null;
  /** Avantis fundingFeePerHourP. Percent per hour. Zero is a real reading. */
  fundingPctPerHour: number | null;
  /** Their rollover figures. The period is not in the field, so these are not turned into dollars. */
  rollLong: number | null;
  rollShort: number | null;
  spot: number | null;
};

type OstiumPx = { pair?: string; mid?: number; bid?: number; ask?: number; isMarketOpen?: boolean };
type AvPair = {
  from?: string;
  to?: string;
  leverages?: { maxLeverage?: number };
  pairOI?: number;
  pairMaxOI?: number;
  openFeeP?: number;
  minLevPosUSDC?: number;
  pairMinLevPosUSDC?: number;
  fundingFeePerHourP?: number;
  marginFee?: { long?: number; short?: number };
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
  return DERIVS.map((pair): DerivRow => {
    const px = pair.ostium ? ostium.get(pair.ostium) : undefined;
    const av = pair.avantis ? avantis.get(pair.avantis) : undefined;
    const fund = av?.fundingFeePerHourP;
    return {
      ...pair,
      mid: px?.mid && px.mid > 0 ? px.mid : null,
      bid: px?.bid && px.bid > 0 ? px.bid : null,
      ask: px?.ask && px.ask > 0 ? px.ask : null,
      open: px?.isMarketOpen ?? av?.feed?.attributes?.isOpen ?? null,
      maxLev: av?.leverages?.maxLeverage ?? null,
      oi: typeof av?.pairOI === "number" ? av.pairOI : null,
      maxOi: typeof av?.pairMaxOI === "number" ? av.pairMaxOI : null,
      openFee: typeof av?.openFeeP === "number" ? av.openFeeP : null,
      minNotional: av?.minLevPosUSDC ?? av?.pairMinLevPosUSDC ?? null,
      fundingPctPerHour: typeof fund === "number" ? fund : null,
      rollLong: typeof av?.marginFee?.long === "number" ? av.marginFee.long : null,
      rollShort: typeof av?.marginFee?.short === "number" ? av.marginFee.short : null,
      spot: pair.hold ? (spot.get(pair.hold.mint) ?? null) : null,
    };
  });
});

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
        stopLoss: z.number().positive().optional(),
        takeProfit: z.number().positive().optional(),
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
        ...(data.stopLoss ? { stopLoss: data.stopLoss } : {}),
        ...(data.takeProfit ? { takeProfit: data.takeProfit } : {}),
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
      trade: { to: tradeBody.data.to, data: tradeBody.data.data, chainId: 8453, description: tradeBody.data.description },
      openPrice: tradeBody.data.meta?.openPrice ?? null,
    };
  });

export type CandleTf = "1" | "5" | "15" | "60" | "240" | "1D";

export type DerivBar = { time: number; open: number; high: number; low: number; close: number; volume?: number };

const WINDOW: Record<CandleTf, number> = {
  "1": 12 * 3600,
  "5": 2 * 86400,
  "15": 7 * 86400,
  "60": 30 * 86400,
  "240": 120 * 86400,
  "1D": 420 * 86400,
};

/** Ostium OHLC. Time is unix seconds. Empty when the pair has no print. */
export const derivCandles = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ pair: z.string().min(3).max(24), tf: z.enum(["1", "5", "15", "60", "240", "1D"]) }).parse(input))
  .handler(async ({ data }) => {
    const now = Math.floor(Date.now() / 1000);
    const res = await fetch("https://builder.prod.bedrock.ostium.io/v1/ohlc", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        pair: data.pair,
        fromTimestampSeconds: now - WINDOW[data.tf],
        toTimestampSeconds: now,
        resolution: data.tf,
      }),
      signal: AbortSignal.timeout(12_000),
    }).catch(() => null);
    if (!res?.ok) return [] as DerivBar[];
    const body = (await res.json()) as { data?: { open?: number; high?: number; low?: number; close?: number; time?: number }[] };
    const out: DerivBar[] = [];
    for (const bar of body.data ?? []) {
      if (!(bar.open && bar.high && bar.low && bar.close && bar.time)) continue;
      const time = Math.floor(bar.time > 10_000_000_000 ? bar.time / 1000 : bar.time);
      if (out.length && out[out.length - 1].time === time) out.pop();
      out.push({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
    }
    return out.slice(-800);
  });


