/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { impactFromRaw, USDC } from "@/lib/jup-exec";
import { sendVersioned } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { routeEarn } from "@/lib/desk-fee";

const QUOTE_URLS = [
  (qs: string) => `https://public.jupiterapi.com/quote?${qs}`,
  (qs: string) => `https://lite-api.jup.ag/swap/v1/quote?${qs}`,
  (qs: string) => `https://api.jup.ag/swap/v1/quote?${qs}`,
];
const SWAP_URLS = [
  "https://public.jupiterapi.com/swap",
  "https://lite-api.jup.ag/swap/v1/swap",
  "https://api.jup.ag/swap/v1/swap",
];

export const SOL = "So11111111111111111111111111111111111111112";
export const CASH = "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH";

/** Both sides are mints. One may be any coin the wallet holds. Jupiter still builds the route. */
export function assertPrestockRoute(inputMint: string, outputMint: string) {
  const ok = inputMint.length >= 32 && outputMint.length >= 32 && inputMint !== outputMint;
  if (!ok) throw new Error("That pair is not two different mints. The wallet was not asked to sign.");
}

export type RouteQuote = {
  inAmount: string;
  outAmount: string;
  outUi: number;
  minUi: number;
  impact: number;
  route: string;
};

type RawQuote = {
  outAmount?: string;
  inAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  error?: string;
  routePlan?: Array<{ swapInfo?: { label?: string } }>;
};

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export async function quoteRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  slippageBps?: number;
  onlyDirect?: boolean;
  maxImpact?: number;
}): Promise<RouteQuote> {
  if (!(input.amountRaw > 0)) throw new Error("Enter an amount.");
  const slip = input.slippageBps ?? 100;
  const direct = input.onlyDirect ? "&onlyDirectRoutes=true" : "";
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=${slip}&restrictIntermediateTokens=true${direct}`;
  let last = "Jupiter did not quote.";
  for (const url of QUOTE_URLS) {
    const res = await fetch(url(qs), { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
    const text = await res.text();
    let quote: RawQuote = {};
    try {
      quote = JSON.parse(text) as RawQuote;
    } catch {
      last = res.status === 429 ? "Jupiter is busy. Wait a moment." : "Jupiter did not quote.";
      continue;
    }
    if (!res.ok || !quote.outAmount) {
      last = res.status === 429 ? "Jupiter is busy. Wait a moment." : quote.error || `Jupiter quote ${res.status}`;
      continue;
    }
    const impact = impactFromRaw(quote.priceImpactPct);
    if (input.maxImpact != null && Math.abs(impact) > input.maxImpact) {
      throw new Error(`Price impact is ${Math.abs(impact).toFixed(2)}%. Above the ${input.maxImpact}% cap.`);
    }
    const outUi = Number(quote.outAmount) / 10 ** input.outDecimals;
    const minRaw = Number(quote.otherAmountThreshold || quote.outAmount);
    return {
      inAmount: quote.inAmount || String(Math.floor(input.amountRaw)),
      outAmount: quote.outAmount,
      outUi,
      minUi: minRaw / 10 ** input.outDecimals,
      impact,
      route: (quote.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean).join(" → ") || "Jupiter",
    };
  }
  throw new Error(last);
}

export type RoutePro = { aim?: "fast" | "price"; slippageBps?: number; maxImpact?: number; direct?: boolean };

/** Direct and routed, then the one that pays more or the one that came back first. */
export async function raceRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  pro?: RoutePro;
}): Promise<RouteQuote & { ms: number; direct: boolean; why: string; coherence: number; cosine: number; logDistance: number; resonance: number; plainOut: number }> {
  const pro = input.pro ?? { aim: "fast", slippageBps: 50, maxImpact: 5 };
  const lanes = pro.direct ? [true] : [true, false];
  const t0 = performance.now();
  const settled = await Promise.all(
    lanes.map(async (direct) => {
      const started = performance.now();
      try {
        const quote = await quoteRoute({ ...input, slippageBps: pro.slippageBps, onlyDirect: direct, maxImpact: pro.maxImpact });
        return { quote, direct, ms: performance.now() - started };
      } catch (error) {
        return { error, direct, ms: performance.now() - started };
      }
    }),
  );
  const ok = settled.filter((row): row is { quote: RouteQuote; direct: boolean; ms: number } => "quote" in row && Boolean(row.quote));
  if (!ok.length) {
    const fail = settled.find((row) => "error" in row);
    throw fail && "error" in fail && fail.error instanceof Error ? fail.error : new Error("Jupiter did not quote.");
  }
  const best = Math.max(...ok.map((row) => Number(row.quote.outAmount)));
  const pool = pro.aim === "price" ? ok : ok.filter((row) => Number(row.quote.outAmount) >= best * (1 - 0.0003));
  const pick = pro.aim === "price" ? [...pool].sort((a, b) => Number(b.quote.outAmount) - Number(a.quote.outAmount))[0] : [...pool].sort((a, b) => a.ms - b.ms)[0];
  const ms = Math.max(1, Math.round(performance.now() - t0));
  const plainOut = Math.min(...ok.map((row) => Number(row.quote.outAmount)));
  const shape = pick.direct ? "direct" : pick.quote.route;
  const why = pro.aim === "price" ? `Best output · ${shape} · ${ms}ms to quote` : `Fast · ${shape} · within 0.03% of the best output · ${ms}ms to quote`;
  return { ...pick.quote, ms, direct: pick.direct, why, coherence: 1, cosine: 1, logDistance: 0, resonance: 1, plainOut };
}

/** The lane a swap will sign. Same race the desk and an agent both use. */
export async function decideRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  pro?: RoutePro;
}): Promise<{ onlyDirect: boolean; outUi: number; plainUi: number; impact: number; ms: number; why: string; feeBps: number; earn: string }> {
  const raced = await raceRoute(input);
  const plainUi = raced.plainOut / 10 ** input.outDecimals;
  const earned = routeEarn(raced.outUi, plainUi, Math.abs(raced.impact));
  return {
    onlyDirect: raced.direct,
    outUi: raced.outUi,
    plainUi,
    impact: Math.abs(raced.impact),
    ms: raced.ms,
    why: `${raced.why} · ${earned.why}`,
    feeBps: earned.bps,
    earn: earned.why,
  };
}

export async function signRoute(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  usd: number;
  /** Route Pro settings. Callers passed these before signRoute read them; they were silently ignored. */
  slippageBps?: number;
  onlyDirect?: boolean;
  /** Can only tighten the 5% impact guard, never loosen it. */
  maxImpact?: number;
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  assertPrestockRoute(input.inputMint, input.outputMint);
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about $${input.usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  const pinnedSlippage = Number.isInteger(input.slippageBps) && input.slippageBps! >= 1 && input.slippageBps! <= 100 ? input.slippageBps! : null;
  const slip = pinnedSlippage ?? 100;
  const maxImpact = Math.min(5, Number.isFinite(input.maxImpact) && input.maxImpact! > 0 ? input.maxImpact! : 5);
  const quoted = await quoteRoute({ ...input, slippageBps: slip });
  if (quoted.impact > maxImpact) throw new Error(`Price impact is ${quoted.impact.toFixed(1)}%. The wallet was not asked to sign.`);
  const direct = input.onlyDirect ? "&onlyDirectRoutes=true" : "";
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=${slip}&restrictIntermediateTokens=true${direct}`;
  let quote: RawQuote | null = null;
  for (const base of QUOTE_URLS) {
    const quoteRes = await fetch(base(qs), { headers: { accept: "application/json", "user-agent": "Senda/1.0" } });
    const text = await quoteRes.text();
    try {
      const parsed = JSON.parse(text) as RawQuote;
      if (quoteRes.ok && parsed.outAmount) {
        quote = parsed;
        break;
      }
    } catch {
      /* try the other host */
    }
  }
  if (!quote?.outAmount) throw new Error("Jupiter did not quote.");
  let swapTx = "";
  let swapErr = "Jupiter did not build a transaction.";
  for (const base of SWAP_URLS) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        dynamicComputeUnitLimit: true,
        // An explicit Route Pro slippage is a ceiling the user chose; don't let Jupiter widen it.
        dynamicSlippage: pinnedSlippage == null,
      }),
    });
    const text = await swapRes.text();
    try {
      const swap = JSON.parse(text) as { swapTransaction?: string; error?: string };
      if (swap.swapTransaction) {
        swapTx = swap.swapTransaction;
        break;
      }
      if (swap.error) swapErr = swap.error;
    } catch {
      if (swapRes.status === 429) swapErr = "Jupiter is busy. Wait a moment.";
    }
  }
  if (!swapTx) throw new Error(swapErr);
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTx));
  const signature = await sendVersioned(tx);
  return { signature, outUi: quoted.outUi };
}

export async function signStockSwap(input: {
  owner: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  tokenAmount?: bigint;
  decimals?: number;
}): Promise<{ signature: string; outUi: number }> {
  const amount =
    input.side === "buy" ? Math.max(1, Math.round(input.usd * 1e6)) : Number(input.tokenAmount ?? 0n);
  if (!(amount > 0)) throw new Error("Nothing to sell.");
  return signRoute({
    owner: input.owner,
    inputMint: input.side === "buy" ? USDC : input.mint,
    outputMint: input.side === "buy" ? input.mint : USDC,
    amountRaw: amount,
    outDecimals: input.decimals ?? (input.side === "buy" ? 9 : 6),
    usd: input.usd,
  });
}
