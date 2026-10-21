/** Jupiter builds the swap. Phantom signs it. Senda never holds the key. */

import { USDC } from "@/lib/jup-exec";
import { CASH, USDT } from "@/lib/wallet-engine";
import { currentIntent, noteAct, recordFill } from "@/lib/book";
import { stageMove } from "@/lib/moves";
import { PRESTOCK_MINTS, sendVersioned, splHolding } from "@/lib/phantom";
import { spendCap } from "@/lib/spend-cap";
import { pairAllowed } from "@/lib/trade-book.mjs";
import { verifyStableSpend, verifySwapQuote } from "@/lib/quote-guard.mjs";

const QUOTE = "https://api.jup.ag/swap/v1/quote";
const SWAP = "https://api.jup.ag/swap/v1/swap";

export const SOL = "So11111111111111111111111111111111111111112";
export const PYUSD = "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo";

/** What a wallet can pay or receive. USDC stays the default. */
export const PAY = [
  { symbol: "USDC", mint: USDC, decimals: 6 },
  { symbol: "SOL", mint: SOL, decimals: 9 },
  { symbol: "CASH", mint: CASH, decimals: 6 },
  { symbol: "USDT", mint: USDT, decimals: 6 },
  { symbol: "PYUSD", mint: PYUSD, decimals: 6 },
] as const;

export function payAsset(symbol?: string) {
  return PAY.find((row) => row.symbol === symbol) ?? PAY[0];
}

export function isPayMint(mint: string) {
  return PAY.some((row) => row.mint === mint);
}

/** Dollar size into raw units. SOL needs a live dollar price. Stables are one dollar. */
export function payRaw(symbol: string, usd: number, solUsd = 0) {
  const pay = payAsset(symbol);
  if (!(usd > 0)) return 0;
  if (pay.symbol === "SOL") {
    if (!(solUsd > 0)) throw new Error("SOL has no live price, so this size cannot be signed in SOL.");
    return Math.max(1, Math.floor((usd / solUsd) * 10 ** pay.decimals));
  }
  return Math.max(1, Math.round(usd * 10 ** pay.decimals));
}

/** USDC, SOL, CASH, USDT, or PYUSD against any mint Jupiter can quote. Listed-to-listed still passes. */
const TESSERA_MINTS = [
  "TKLSidmLVt3cqGaaodG8tyRzoANfQwoh67AccjmubeZ",
  "oPAiAikWTaFj9RYoRFD35ccfwhnMcB3ThgBZRHSkjTZ",
  "TSPXcLV76s6V2zDiZQ18kBfcbnjaE2ZzNT3ga2Pd99v",
];

export function assertPrestockRoute(inputMint: string, outputMint: string, extraMints: string[] = []) {
  const listed = PRESTOCK_MINTS.map(([, mint]) => mint);
  const extra = [inputMint, outputMint].filter(
    (mint) => /^Pre[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint) || TESSERA_MINTS.includes(mint),
  );
  if (!pairAllowed(inputMint, outputMint, [...listed, ...extra, ...extraMints])) {
    throw new Error("That pair is not on this desk. The wallet was not asked to sign.");
  }
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
  inputMint?: string;
  outputMint?: string;
  swapMode?: string;
  slippageBps?: number;
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
}): Promise<RouteQuote> {
  if (!Number.isSafeInteger(input.amountRaw) || input.amountRaw <= 0) throw new Error("Enter an exact, positive amount.");
  if (!Number.isInteger(input.outDecimals) || input.outDecimals < 0 || input.outDecimals > 18) throw new Error("Invalid mint decimals.");
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${Math.floor(input.amountRaw)}&slippageBps=100&restrictIntermediateTokens=true`;
  let last = "Jupiter did not quote.";
  for (const base of [QUOTE]) {
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
    let checked: ReturnType<typeof verifySwapQuote>;
    try {
      checked = verifySwapQuote(quote, input);
    } catch (error) {
      last = error instanceof Error ? error.message : "Jupiter returned an invalid quote.";
      continue;
    }
    return {
      inAmount: checked.inAmount,
      outAmount: checked.outAmount,
      outUi: Number(checked.outAmount) / 10 ** input.outDecimals,
      minUi: Number(checked.minOutAmount) / 10 ** input.outDecimals,
      impact: checked.impactPercent / 100,
      route: (quote.routePlan ?? []).map((p) => p.swapInfo?.label).filter(Boolean).join(" → ") || "Jupiter",
    };
  }
  throw new Error(last);
}

export async function signRoute(input: {
  owner: string;
  inputMint: string;
  outputMint: string;
  amountRaw: number;
  outDecimals: number;
  usd: number;
  symbol?: string;
  qty?: number;
  extraMints?: string[];
}): Promise<{ signature: string; outUi: number }> {
  if (!(input.usd > 0) || !Number.isFinite(input.usd)) throw new Error("Enter an amount.");
  if (!Number.isSafeInteger(input.amountRaw) || input.amountRaw <= 0) throw new Error("Enter an exact, positive amount.");
  if (!Number.isInteger(input.outDecimals) || input.outDecimals < 0 || input.outDecimals > 18) throw new Error("Invalid mint decimals.");
  assertPrestockRoute(input.inputMint, input.outputMint, input.extraMints ?? []);
  const cap = spendCap();
  if (input.usd > cap) throw new Error(`That is about USD ${input.usd.toFixed(0)}. Your send cap is USD ${cap}. Raise it on Your money.`);
  verifyStableSpend({ inputMint: input.inputMint, amountRaw: input.amountRaw, capUsd: cap, stableMints: [USDC, CASH, USDT, PYUSD] });
  // The exact quote sent to Jupiter's swap builder must pass every guard.
  // Never validate one quote and build the transaction from a second unchecked quote.
  const qs = `inputMint=${input.inputMint}&outputMint=${input.outputMint}&amount=${input.amountRaw}&slippageBps=100&restrictIntermediateTokens=true`;
  let quote: RawQuote | null = null;
  let checked: ReturnType<typeof verifySwapQuote> | null = null;
  let lastQuoteError = "Jupiter did not quote.";
  for (const base of [QUOTE]) {
    try {
      const quoteRes = await fetch(`${base}?${qs}`, { headers: { accept: "application/json" } });
      const text = await quoteRes.text();
      const parsed = JSON.parse(text) as RawQuote;
      if (!quoteRes.ok || !parsed.outAmount) {
        lastQuoteError = parsed.error || (quoteRes.status === 429 ? "Jupiter is busy. Wait a moment." : `Jupiter quote ${quoteRes.status}`);
        continue;
      }
      const accepted = verifySwapQuote(parsed, input);
      quote = parsed;
      checked = accepted;
      break;
    } catch (error) {
      lastQuoteError = error instanceof Error ? error.message : "Jupiter did not return a valid quote.";
    }
  }
  if (!quote || !checked) throw new Error(lastQuoteError);
  let swapTx = "";
  let swapErr = "Jupiter did not build a transaction.";
  for (const base of [SWAP]) {
    const swapRes = await fetch(base, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: input.owner,
        dynamicComputeUnitLimit: true,
        // Keep the quote's 100 bps slippage; do not request a builder-side override.
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
  const { PublicKey, VersionedTransaction } = await import("@solana/web3.js");
  const tx = VersionedTransaction.deserialize(b64ToBytes(swapTx));
  if (!tx.message.staticAccountKeys[0]?.equals(new PublicKey(input.owner))) {
    throw new Error("Jupiter returned a different transaction payer. The wallet was not asked to sign.");
  }
  const outUi = Number(checked.outAmount) / 10 ** input.outDecimals;
  const side = isPayMint(input.inputMint) && !isPayMint(input.outputMint) ? "Bought" : !isPayMint(input.inputMint) && isPayMint(input.outputMint) ? "Sold" : "Swapped";
  const sideName = input.symbol ? `${side} ${input.symbol}` : "Jupiter swap";
  stageMove({ usd: input.usd, kind: "swap", title: sideName });
  const signature = await sendVersioned(tx);
  const outName = PRESTOCK_MINTS.find(([, mint]) => mint === input.outputMint)?.[0];
  const inName = PRESTOCK_MINTS.find(([, mint]) => mint === input.inputMint)?.[0];
  const label = (mint: string, named?: string) =>
    named || (mint === SOL ? "SOL" : mint === USDC ? "USDC" : mint === CASH ? "CASH" : mint === USDT ? "USDT" : mint === PYUSD ? "PYUSD" : "token");
  if (outName) {
    recordFill({ symbol: outName, mint: input.outputMint, side: "buy", bucket: currentIntent(), usd: input.usd, qty: outUi, signature });
  } else if (inName) {
    const qty = input.amountRaw / 1e9;
    recordFill({ symbol: inName, mint: input.inputMint, side: "sell", bucket: currentIntent(), usd: input.usd, qty: qty > 0 ? qty : outUi, signature });
  } else {
    const buying = isPayMint(input.inputMint) && !isPayMint(input.outputMint);
    const selling = isPayMint(input.outputMint) && !isPayMint(input.inputMint);
    const mint = buying ? input.outputMint : selling ? input.inputMint : input.outputMint;
    const qty = input.qty && input.qty > 0 ? input.qty : outUi;
    recordFill({ symbol: input.symbol || label(mint), mint, side: selling ? "sell" : "buy", bucket: currentIntent(), usd: input.usd, qty, signature });
  }
  noteAct({
    kind: "swap",
    title: input.symbol ? `${isPayMint(input.outputMint) && !isPayMint(input.inputMint) ? "Sold" : "Bought"} ${input.symbol}` : `${label(input.inputMint, inName)} → ${label(input.outputMint, outName)}`,
    detail: `$${input.usd.toFixed(2)} · Jupiter · ${currentIntent() === "trade" ? "Trade" : "Hold"}`,
    signature,
    usd: input.usd,
  });
  return { signature, outUi };
}

export async function signStockSwap(input: {
  owner: string;
  mint: string;
  usd: number;
  side: "buy" | "sell";
  tokenAmount?: bigint;
  decimals?: number;
  extraMints?: string[];
  symbol?: string;
  /** USDC, SOL, CASH, USDT, or PYUSD. Defaults to USDC. */
  pay?: string;
  solUsd?: number;
}): Promise<{ signature: string; outUi: number }> {
  const pay = payAsset(input.pay);
  const amount =
    input.side === "buy" ? payRaw(pay.symbol, input.usd, input.solUsd) : Number(input.tokenAmount ?? 0n);
  if (!(amount > 0) || !Number.isSafeInteger(amount)) throw new Error("Swap size is zero or exceeds precise raw-unit limits.");
  return signRoute({
    owner: input.owner,
    inputMint: input.side === "buy" ? pay.mint : input.mint,
    outputMint: input.side === "buy" ? input.mint : pay.mint,
    amountRaw: amount,
    outDecimals: input.decimals ?? (input.side === "buy" ? 9 : pay.decimals),
    usd: input.usd,
    symbol: input.symbol,
    extraMints: [...(input.extraMints ?? []), pay.mint],
  });
}

/** Swap Phantom CASH into USDC when the send is short. Does nothing if USDC already covers it. */
export async function fundUsdc(owner: string, usd: number): Promise<void> {
  const have = await splHolding(owner, USDC);
  if (have.ui + 0.01 >= usd) return;
  const need = Math.round((usd - have.ui) * 100) / 100;
  const cash = await splHolding(owner, CASH);
  if (cash.ui + 0.01 < need) throw new Error("This account does not hold enough USDC or Phantom CASH for that send.");
  await signRoute({
    owner,
    inputMint: CASH,
    outputMint: USDC,
    amountRaw: Math.max(1, Math.floor(need * 1e6)),
    outDecimals: 6,
    usd: need,
    symbol: "USDC",
    extraMints: [CASH],
  });
}
