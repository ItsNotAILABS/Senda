/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { CASH, USDC } from "@/lib/jup-exec";
export { CASH };
import { chainRpc, liveSolAddress, requirePhantom, sendVersioned, splHolding, symbolFor } from "@/lib/phantom";
import { assertSpend } from "@/lib/spend-cap";
import { readSolSpend } from "@/lib/fill-cost";
import { fileFill, listTrades, rememberTrade } from "@/lib/trade-log";
import { routePro, type RoutePro } from "@/lib/route-pro";
import { readRoutes } from "@/lib/mesie-route";

const QUOTE = "https://api.jup.ag/swap/v1/quote";
const QUOTE_LITE = "https://lite-api.jup.ag/swap/v1/quote";
const SWAP = "https://api.jup.ag/swap/v1/swap";
const SWAP_LITE = "https://lite-api.jup.ag/swap/v1/swap";

export const SOL = "So11111111111111111111111111111111111111112";

/** One side is USDC or SOL. The other side is the token the desk asked to trade. */
export function assertPrestockRoute(inputMint: string, outputMint: string) {
  const cash = inputMint === SOL || inputMint === USDC || inputMint === CASH;
  const outCash = outputMint === SOL || outputMint === USDC || outputMint === CASH;
  const addr = (m: string) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m);
  if ((cash && addr(outputMint)) || (outCash && addr(inputMint))) return;
  throw new Error("A buy pays USDC. A sell returns USDC. Anything else is not sent to the wallet.");
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
  inputMint?: string;
  outputMint?: string;
  outAmount?: string;
  inAmount?: string;
  otherAmountThreshold?: string;
  priceImpactPct?: string;
  error?: string;
  routePlan?: { swapInfo?: { label?: string } }[];
};

/** The quote has to be the ticket: same mints, same raw size, impact under 5%. */
function bindQuote(quote: RawQuote, inputMint: string, outputMint: string, amountRaw: number) {
  if (quote.inputMint && quote.inputMint !== inputMint) throw new Error("The quote is for a different mint. The wallet was not asked to sign.");
  if (quote.outputMint && quote.outputMint !== outputMint) throw new Error("The quote pays a different mint. The wallet was not asked to sign.");
  const inn = Number(quote.inAmount || 0);
  const asked = Math.floor(amountRaw);
  if (inn > 0 && Math.abs(inn - asked) > 1) throw new Error("The quote size does not match the ticket. The wallet was not asked to sign.");
  const impact = Math.abs(Number(quote.priceImpactPct ?? 0));
  if (impact > 5) throw new Error(`Price impact is ${impact.toFixed(1)}%. The wallet was not asked to sign.`);
}

function feePayerIs(tx: { message: { staticAccountKeys?: { toBase58?: () => string }[] } }, owner: string) {
  const fee = tx.message.staticAccountKeys?.[0]?.toBase58?.() ?? "";
  if (fee && fee !== owner) throw new Error("The fee payer is not this wallet. The wallet was not asked to sign.");
}

function mintName(mint: string, symbol?: string): string {
  if (mint === SOL) return "SOL";
  if (mint === USDC) return "USDC";
  if (mint === CASH) return "CASH";
  return symbol || "token";
}

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
  const cap = input.maxImpact ?? 5;
  const lane = input.onlyDirect ? "&onlyDirectRoutes=true" : "&restrictIntermediateTokens=true";
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=${slip}${lane}`;
  let last = "Jupiter did not quote.";
  for (const base of [QUOTE, QUOTE_LITE]) {
    const res = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
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
    const impact = Number(quote.priceImpactPct ?? 0);
    bindQuote(quote, input.inputMint, input.outputMint, input.amountRaw);
    if (Math.abs(impact) > cap) throw new Error(`Price impact is ${Math.abs(impact).toFixed(2)}%. Above the ${cap}% cap.`);
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

export type RacedQuote = RouteQuote & { ms: number; direct: boolean; why: string; coherence: number; cosine: number; logDistance: number; resonance: number };

/** Fast returns the first quote under the impact cap and does not wait on the other lane. Best price still compares both. The milliseconds are the quote, not the landing. */
export async function raceRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  pro?: RoutePro;
}): Promise<RacedQuote> {
  const pro = input.pro ?? routePro();
  const lanes = pro.direct ? [true] : [true, false];
  const t0 = performance.now();
  if (pro.aim === "fast") {
    return new Promise((resolve, reject) => {
      let left = lanes.length;
      let fail: unknown = new Error("Jupiter did not quote.");
      let settled = false;
      for (const direct of lanes) {
        const started = performance.now();
        const job = quoteRoute({ ...input, slippageBps: pro.slippageBps, onlyDirect: direct, maxImpact: pro.maxImpact });
        const timer = new Promise<never>((_, rej) => {
          setTimeout(() => rej(new Error("Quote timed out.")), 1200);
        });
        Promise.race([job, timer])
          .then((quote) => {
            if (settled) return;
            settled = true;
            const ms = Math.max(1, Math.round(performance.now() - started));
            resolve({
              ...quote,
              ms,
              direct,
              why: `Fast · first quote under the impact cap · ${direct ? "direct" : quote.route} · ${ms}ms · the other lane was not waited on`,
              coherence: 1,
              cosine: 1,
              logDistance: 0,
              resonance: 0,
            });
          })
          .catch((error) => {
            fail = error;
            left -= 1;
            if (!settled && left === 0) reject(fail instanceof Error ? fail : new Error("Jupiter did not quote."));
          });
      }
    });
  }
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
  const ok = settled.filter((row): row is { quote: RouteQuote; direct: boolean; ms: number } => "quote" in row && !!row.quote);
  if (!ok.length) {
    const fail = settled.find((row) => "error" in row)?.error;
    throw fail instanceof Error ? fail : new Error("Jupiter did not quote.");
  }
  const read = readRoutes(ok.map((row) => ({ out: Number(row.quote.outAmount), impact: Math.abs(row.quote.impact), ms: row.ms })));
  const alive = ok.filter((_, i) => read.keep[i]);
  const best = Math.max(...alive.map((row) => Number(row.quote.outAmount)));
  const pool = pro.aim === "price" ? alive : alive.filter((row) => Number(row.quote.outAmount) >= best * (1 - 0.0008));
  const pick = pro.aim === "price"
    ? [...pool].sort((a, b) => Number(b.quote.outAmount) - Number(a.quote.outAmount))[0]
    : [...pool].sort((a, b) => a.ms - b.ms)[0];
  const index = ok.indexOf(pick);
  const ms = Math.max(1, Math.round(performance.now() - t0));
  const shape = pick.direct ? "direct" : pick.quote.route;
  const dropped = alive.length < ok.length ? " · spiked route dropped" : "";
  const math = `coherence ${read.coherence.toFixed(2)} · cosine ${read.cosine.toFixed(2)} · log distance ${read.logDistance.toFixed(2)} · resonance ${read.resonance[index].toFixed(2)}`;
  const why = pro.aim === "price"
    ? `Best output · ${shape} · ${ms}ms to quote · ${math}${dropped}`
    : `Fast · ${shape} · within 0.08% of the best output · ${ms}ms to quote · ${math}${dropped}`;
  return { ...pick.quote, ms, direct: pick.direct, why, coherence: read.coherence, cosine: read.cosine, logDistance: read.logDistance, resonance: read.resonance[index] };
}

/** The lane a swap will sign. Fast or best price, from the same race the agent uses. */
export async function decideRoute(input: {
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  pro?: RoutePro;
}): Promise<{ onlyDirect: boolean; outUi: number; impact: number; ms: number; why: string }> {
  const raced = await raceRoute(input);
  return { onlyDirect: raced.direct, outUi: raced.outUi, impact: Math.abs(raced.impact), ms: raced.ms, why: raced.why };
}

/** USDC ↔ SOL. Jupiter pays the network fee when this wallet has no SOL to pay it. */
async function signUltra(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  usd: number;
}): Promise<{ signature: string; outUi: number }> {
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&taker=${input.owner}`;
  let order: { transaction?: string; requestId?: string; outAmount?: string; error?: string } | null = null;
  let last = "Jupiter did not quote.";
  for (const base of ["https://lite-api.jup.ag/ultra/v1/order", "https://api.jup.ag/ultra/v1/order"]) {
    try {
      const res = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
      const body = (await res.json()) as { transaction?: string; requestId?: string; outAmount?: string; error?: string };
      if (body.transaction && body.requestId) {
        order = body;
        break;
      }
      if (body.error) last = body.error;
    } catch {
      last = "Jupiter did not quote.";
    }
  }
  if (!order?.transaction || !order.requestId) throw new Error(last === "Insufficient funds" ? "This wallet does not hold enough for that size." : last);
  const { Buffer } = await import("buffer");
  if (!globalThis.Buffer) globalThis.Buffer = Buffer;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const provider = await requirePhantom();
  const tx = VersionedTransaction.deserialize(Buffer.from(order.transaction, "base64"));
  const signed = await provider.signTransaction(tx);
  const signedB64 = Buffer.from(signed.serialize()).toString("base64");
  let signature = "";
  let fail = "Jupiter did not take the swap.";
  for (const base of ["https://lite-api.jup.ag/ultra/v1/execute", "https://api.jup.ag/ultra/v1/execute"]) {
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ signedTransaction: signedB64, requestId: order.requestId }),
      });
      const done = (await res.json()) as { signature?: string; status?: string; error?: string };
      if (done.signature && done.status !== "Failed") {
        signature = done.signature;
        break;
      }
      if (done.error) fail = done.error;
    } catch {
      fail = "Jupiter did not take the swap.";
    }
  }
  if (!signature) throw new Error(fail);
  const outUi = Number(order.outAmount || 0) / 10 ** input.outDecimals;
  return filed(input, signature, outUi);
}

export async function signRoute(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  inDecimals?: number;
  usd: number;
  refPrice?: number;
  symbol?: string;
  slippageBps?: number;
  onlyDirect?: boolean;
  maxImpact?: number;
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd > 0)) throw new Error("Enter an amount.");
  assertPrestockRoute(input.inputMint, input.outputMint);
  assertSpend(input.usd);
  const slip = input.slippageBps ?? 100;
  const cap = input.maxImpact ?? 5;
  if (input.inputMint === SOL || input.outputMint === SOL) return signUltra(input);
  let onlyDirect = input.onlyDirect;
  if (onlyDirect == null) {
    const decided = await decideRoute({
      inputMint: input.inputMint,
      outputMint: input.outputMint,
      amountRaw: input.amountRaw,
      outDecimals: input.outDecimals,
      pro: routePro(),
    });
    if (decided.impact > cap) throw new Error(`Price impact is ${decided.impact.toFixed(2)}%. The wallet was not asked to sign.`);
    onlyDirect = decided.onlyDirect;
  }
  const prefs = JSON.stringify({ slippageBps: slip, onlyDirect: onlyDirect === true, maxImpact: cap });
  const built = await chainRpc("jupSwap", [
    input.owner,
    input.inputMint,
    input.outputMint,
    String(Math.floor(input.amountRaw)),
    prefs,
  ]).catch(() => null) as { swapTransaction?: string; outAmount?: string; priceImpactPct?: string } | null;
  if (built?.swapTransaction && built.outAmount) {
    const impact = Math.abs(Number(built.priceImpactPct ?? 0));
    if (impact > cap) throw new Error(`Price impact is ${impact.toFixed(1)}%. The wallet was not asked to sign.`);
    const { Buffer } = await import("buffer");
    if (!globalThis.Buffer) globalThis.Buffer = Buffer;
    const { VersionedTransaction } = await import("@solana/web3.js");
    const tx = VersionedTransaction.deserialize(b64ToBytes(built.swapTransaction));
    feePayerIs(tx, input.owner);
    const signature = await sendVersioned(tx);
    return filed({ ...input, impact, route: "Jupiter", slippageBps: slip }, signature, Number(built.outAmount) / 10 ** input.outDecimals);
  }
  const quoted = await quoteRoute({ ...input, slippageBps: slip, onlyDirect, maxImpact: cap });
  if (quoted.impact > cap) throw new Error(`Price impact is ${quoted.impact.toFixed(1)}%. The wallet was not asked to sign.`);
  const lane = onlyDirect ? "&onlyDirectRoutes=true" : "&restrictIntermediateTokens=true";
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=${slip}${lane}`;
  let quote: RawQuote | null = null;
  for (const base of [QUOTE, QUOTE_LITE]) {
    const quoteRes = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
    const text = await quoteRes.text();
    try {
      const parsed = JSON.parse(text) as RawQuote;
      if (quoteRes.ok && parsed.outAmount) {
        bindQuote(parsed, input.inputMint, input.outputMint, input.amountRaw);
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
  for (const base of [SWAP, SWAP_LITE]) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        dynamicSlippage: true,
        prioritizationFeeLamports: "auto",
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
  feePayerIs(tx, input.owner);
  const signature = await sendVersioned(tx);
  return filed({ ...input, impact: quoted.impact, route: quoted.route, slippageBps: slip }, signature, quoted.outUi);
}

function filed(
  input: {
    owner: string;
    inputMint: string;
    outputMint: string;
    usd: number;
    route?: string;
    impact?: number;
    refPrice?: number;
    slippageBps?: number;
    symbol?: string;
    amountRaw?: number;
    inDecimals?: number;
  },
  signature: string,
  outUi: number,
) {
  const stables = new Set([USDC, CASH]);
  const product = stables.has(input.outputMint) ? input.inputMint : input.outputMint;
  const side = stables.has(input.outputMint) ? "sell" : "buy";
  const paidName = mintName(input.inputMint, input.symbol);
  const receivedName = mintName(input.outputMint, side === "buy" ? input.symbol || symbolFor(product) : undefined);
  const inDec = input.inDecimals && input.inDecimals > 0
    ? input.inDecimals
    : input.inputMint === SOL
      ? 9
      : stables.has(input.inputMint)
        ? 6
        : 0;
  const paidQty = inDec > 0 && input.amountRaw && input.amountRaw > 0 ? input.amountRaw / 10 ** inDec : 0;
  const paidUi = paidQty > 0 ? paidQty : input.usd;
  const executed = side === "buy"
    ? outUi > 0 && input.usd > 0
      ? input.usd / outUi
      : 0
    : paidQty > 0 && outUi > 0
      ? outUi / paidQty
      : 0;
  fileFill({
    owner: input.owner,
    symbol: input.symbol || symbolFor(product),
    side,
    usd: input.usd,
    mint: product,
    signature,
    qty: outUi,
    paidUi,
    paidAsset: paidName,
    receivedAsset: receivedName,
    executed,
    refPrice: input.refPrice,
    quotedUi: outUi,
    slippageBps: input.slippageBps ?? 100,
    platformFeeBps: 0,
    impact: input.impact,
    route: input.route,
  });
  void readSolSpend(signature, input.owner)
    .then((spend) => {
      if (!spend) return;
      const prev = listTrades().find((row) => row.signature === signature);
      if (!prev) return;
      rememberTrade({
        ...prev,
        solFee: spend.fee,
        solRent: spend.rent,
        solTotal: spend.total,
        ataNew: spend.ataNew,
      });
    })
    .catch(() => undefined);
  return { signature, outUi, executed, quotedUi: outUi, route: input.route || "Jupiter", impact: input.impact || 0, slippageBps: input.slippageBps ?? 100, platformFeeBps: 0 };
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
  const owner = liveSolAddress() || input.owner;
  if (input.side === "sell") {
    const amount = Number(input.tokenAmount ?? 0n);
    if (!(amount > 0)) throw new Error("Nothing to sell.");
    return signRoute({
      owner,
      inputMint: input.mint,
      outputMint: USDC,
      amountRaw: amount,
      outDecimals: 6,
      inDecimals: input.decimals,
      usd: input.usd,
      symbol: input.symbol,
      refPrice: input.refPrice,
    });
  }
  const need = BigInt(Math.max(1, Math.round(input.usd * 1e6)));
  const [usdc, cash, bal] = await Promise.all([
    splHolding(owner, USDC),
    splHolding(owner, CASH),
    chainRpc("getBalance", [owner, { commitment: "confirmed" }]) as Promise<{ value?: number } | number>,
  ]);
  const lamports = typeof bal === "number" ? bal : Number((bal as { value?: number } | null)?.value ?? 0);
  if (!(lamports >= 5_000)) {
    throw new Error("This wallet has no SOL. The network fee is paid in SOL. CASH and USDC do not pay it.");
  }
  const usdcRaw = BigInt(usdc.raw || "0");
  const cashRaw = BigInt(cash.raw || "0");
  if (usdcRaw >= need) {
    return signRoute({
      owner,
      inputMint: USDC,
      outputMint: input.mint,
      amountRaw: Number(need),
      outDecimals: input.decimals ?? 9,
      usd: input.usd,
      symbol: input.symbol,
      refPrice: input.refPrice,
    });
  }
  if (cashRaw >= need) {
    return signRoute({
      owner,
      inputMint: CASH,
      outputMint: input.mint,
      amountRaw: Number(need),
      outDecimals: input.decimals ?? 9,
      usd: input.usd,
      symbol: input.symbol,
      refPrice: input.refPrice,
    });
  }
  const keep = 2_500_000;
  const spendable = lamports - keep;
  let each = 0;
  try {
    const res = await fetch(`https://api.jup.ag/price/v3?ids=${SOL}`);
    const body = (await res.json()) as Record<string, { usdPrice?: number }>;
    each = Number(body?.[SOL]?.usdPrice) || 0;
  } catch {
    each = 0;
  }
  if (!(each > 0)) {
    try {
      const quoted = await quoteRoute({ inputMint: SOL, outputMint: USDC, amountRaw: 10_000_000, outDecimals: 6 });
      each = quoted.outUi / 0.01;
    } catch {
      each = 0;
    }
  }
  const sized = each > 0 ? Math.ceil(((input.usd * 1.03) / each) * 1e9) : 0;
  if (sized > 0 && sized <= spendable) {
    return signRoute({
      owner,
      inputMint: SOL,
      outputMint: input.mint,
      amountRaw: sized,
      outDecimals: input.decimals ?? 9,
      usd: input.usd,
      symbol: input.symbol,
      refPrice: input.refPrice,
    });
  }
  const who = `${owner.slice(0, 4)}…${owner.slice(-4)}`;
  const solUi = lamports / 1e9;
  const solUsd = each > 0 ? solUi * each : 0;
  const dollars = each > 0 ? `about $${solUsd.toFixed(2)}` : "the dollar price did not come back";
  throw new Error(
    `${who} has ${solUi.toFixed(4)} SOL, ${dollars}. A $${input.usd.toFixed(2)} buy needs more than that once 0.0025 SOL stays for the fee.`,
  );
}
