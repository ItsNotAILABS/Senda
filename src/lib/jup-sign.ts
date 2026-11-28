/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { impactFromRaw, relayQuote, USDC } from "@/lib/jup-exec";
import { checkBook } from "@/lib/book-check";
import { readMintFlags } from "@/lib/mint-flags";
import { rpc, sendVersioned } from "@/lib/phantom";
import { fileFill } from "@/lib/trade-log";
import { spendCap } from "@/lib/spend-cap";
import { routeEarn } from "@/lib/desk-fee";

const QUOTE_URLS = [
  (qs: string) => `https://lite-api.jup.ag/swap/v1/quote?${qs}`,
  (qs: string) => `https://api.jup.ag/swap/v1/quote?${qs}`,
  (qs: string) => `https://public.jupiterapi.com/quote?${qs}`,
];
const SWAP_URLS = [
  "https://lite-api.jup.ag/swap/v1/swap",
  "https://api.jup.ag/swap/v1/swap",
  "https://public.jupiterapi.com/swap",
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
  otherAmountThreshold?: string;
  outUi: number;
  minUi: number;
  impact: number;
  route: string;
  /** The Jupiter body this quote was checked against. The swap is built from this, not a second fetch. */
  raw?: RawQuote;
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
  const base = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=${slip}${direct}`;
  let last = "Jupiter did not quote.";
  const finish = (quote: RawQuote) => {
    const impact = impactFromRaw(quote.priceImpactPct);
    if (input.maxImpact != null && Math.abs(impact) > input.maxImpact) {
      throw new Error(`Price impact is ${Math.abs(impact).toFixed(2)}%. Above the ${input.maxImpact}% cap.`);
    }
    const outUi = Number(quote.outAmount) / 10 ** input.outDecimals;
    const minRaw = quote.otherAmountThreshold || quote.outAmount;
    return {
      inAmount: quote.inAmount || String(Math.floor(input.amountRaw)),
      outAmount: quote.outAmount || "",
      otherAmountThreshold: String(minRaw),
      outUi,
      minUi: Number(minRaw) / 10 ** input.outDecimals,
      impact,
      route: (quote.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean).join(" → ") || "Jupiter",
      raw: quote,
    };
  };
  for (const restrict of [true, false]) {
    const qs = `${base}${restrict ? "&restrictIntermediateTokens=true" : ""}`;
    for (const url of QUOTE_URLS) {
      try {
        const res = await fetch(url(qs), { headers: { accept: "application/json" } });
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
        return finish(quote);
      } catch (error) {
        if (error instanceof Error && /impact/i.test(error.message)) throw error;
        last = error instanceof Error && error.message && !/failed to fetch/i.test(error.message) ? error.message : "Jupiter did not quote.";
      }
    }
  }
  try {
    const relayed = await relayQuote({
      data: {
        inputMint: input.inputMint,
        outputMint: input.outputMint,
        amount: Math.floor(input.amountRaw),
        slippageBps: slip,
        onlyDirect: Boolean(input.onlyDirect),
      },
    });
    if (relayed.ok) {
      const quote = JSON.parse(relayed.quote) as RawQuote;
      if (quote.outAmount) return finish(quote);
    } else if (relayed.error) last = relayed.error;
  } catch {
    /* the browser attempt already recorded why */
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

/** True when the output account is missing and the wallet cannot pay its rent. Unknown is not a block. */
async function ataBlocked(owner: string, mint: string, token2022: boolean): Promise<boolean> {
  try {
    const [{ PublicKey }, spl] = await Promise.all([import("@solana/web3.js"), import("@solana/spl-token")]);
    const program = token2022 ? spl.TOKEN_2022_PROGRAM_ID : spl.TOKEN_PROGRAM_ID;
    const ata = spl.getAssociatedTokenAddressSync(new PublicKey(mint), new PublicKey(owner), false, program);
    const info = (await rpc("getAccountInfo", [ata.toBase58(), { encoding: "base64" }])) as { value?: unknown } | null;
    if (info?.value) return false;
    const bal = (await rpc("getBalance", [owner])) as { value?: number } | number | null;
    const lamports = typeof bal === "number" ? bal : Number(bal?.value ?? 0);
    return !(lamports >= 2_039_280 + 5_000);
  } catch {
    return false;
  }
}

export async function signRoute(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  usd: number;
  inDecimals?: number;
  symbol?: string;
  refPrice?: number;
  /** Monroe's lane. Omitted keeps the desk's usual quote. */
  onlyDirect?: boolean;
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  assertPrestockRoute(input.inputMint, input.outputMint);
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about $${input.usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.`);
  const [quoted, outFlags, inFlags] = await Promise.all([
    quoteRoute({ ...input, onlyDirect: input.onlyDirect === true }),
    readMintFlags(input.outputMint),
    readMintFlags(input.inputMint),
  ]);
  const inDecimals = input.inDecimals ?? (input.inputMint === USDC ? 6 : input.inputMint === SOL ? 9 : 9);
  const ticket = {
    inMint: input.inputMint,
    outMint: input.outputMint,
    inRaw: quoted.inAmount,
    outRaw: quoted.outAmount,
    minRaw: quoted.otherAmountThreshold || quoted.outAmount,
    inDecimals,
    outDecimals: input.outDecimals,
    impactPct: quoted.impact,
    slippageBps: 100,
    shownIn: input.inputMint === USDC ? input.usd : undefined,
    symbol: input.symbol,
    mark: input.inputMint === USDC && input.refPrice && input.refPrice > 0 ? input.refPrice : undefined,
    paused: outFlags.paused || inFlags.paused,
    frozenDefault: outFlags.frozenDefault,
    fees: outFlags.fees,
  };
  const verdict = checkBook(ticket);
  if (!verdict.ok) throw new Error(verdict.line);
  if (input.outputMint !== USDC && input.outputMint !== SOL && (await ataBlocked(input.owner, input.outputMint, outFlags.token2022))) {
    throw new Error(checkBook({ ...ticket, needsAta: true, solLamports: 0 }).line);
  }
  const quote = quoted.raw;
  if (!quote?.outAmount) throw new Error("Jupiter did not quote.");
  let swapTx = "";
  let priority = 0;
  let swapErr = "Jupiter did not build a transaction.";
  for (const base of SWAP_URLS) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: false,
      }),
    });
    const text = await swapRes.text();
    try {
      const swap = JSON.parse(text) as { swapTransaction?: string; error?: string; prioritizationFeeLamports?: number };
      if (swap.swapTransaction) {
        swapTx = swap.swapTransaction;
        priority = Number(swap.prioritizationFeeLamports) || 0;
        break;
      }
      if (swap.error) swapErr = swap.error;
    } catch {
      if (swapRes.status === 429) swapErr = "Jupiter is busy. Wait a moment.";
    }
  }
  if (!swapTx) throw new Error(swapErr);
  if (priority > 10_000_000) throw new Error(checkBook({ ...ticket, priorityLamports: priority }).line);
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTx));
  const signature = await sendVersioned(tx);
  const selling = input.outputMint === USDC || input.outputMint === CASH;
  const symbol = input.symbol || (selling ? "USDC" : "Token");
  const paidUi = Number(quoted.inAmount) / 10 ** inDecimals;
  try {
    fileFill({
      owner: input.owner,
      symbol,
      side: selling ? "sell" : "buy",
      usd: input.usd,
      mint: selling ? input.inputMint : input.outputMint,
      signature,
      qty: quoted.outUi,
      paidUi: Number.isFinite(paidUi) ? paidUi : undefined,
      paidAsset: input.inputMint === USDC ? "USDC" : input.inputMint === SOL ? "SOL" : "token",
      receivedAsset: selling ? "USDC" : symbol,
      executed: !selling && quoted.outUi > 0 ? input.usd / quoted.outUi : undefined,
      refPrice: input.refPrice,
      quotedUi: quoted.outUi,
      slippageBps: 100,
      impact: quoted.impact,
      route: quoted.route,
    });
  } catch {
    /* The wallet already signed. A notice must not look like a failed trade. */
  }
  if (typeof window !== "undefined" && /^\d+$/.test(String(quoted.inAmount))) {
    void import("@/lib/tracked-confirmation.mjs")
      .then(({ confirmTrackedSubmission }) =>
        confirmTrackedSubmission(
          window.localStorage,
          {
            signature,
            owner: input.owner,
            kind: "swap",
            asset: input.inputMint === USDC ? "USDC" : symbol,
            destination: input.outputMint,
            amountRaw: String(quoted.inAmount),
          },
          rpc,
        ),
      )
      .catch(() => undefined);
  }
  return { signature, outUi: quoted.outUi };
}

export async function signStockSwap(input: {
  owner: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  tokenAmount?: bigint;
  decimals?: number;
  symbol?: string;
  refPrice?: number;
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
    symbol: input.symbol,
    refPrice: input.refPrice,
  });
}
