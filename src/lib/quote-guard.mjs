/** Validates the exact Jupiter ExactIn quote used to build a signed swap. */
export const SWAP_SLIPPAGE_BPS = 100;
export const MAX_PRICE_IMPACT_PERCENT = 5;

function rawPositive(value, label) {
  if (typeof value !== "string" || !/^[0-9]{1,20}$/.test(value)) {
    throw new Error(`Jupiter returned an invalid ${label}. The wallet was not asked to sign.`);
  }
  const raw = BigInt(value);
  if (raw <= 0n || raw > (1n << 64n) - 1n) {
    throw new Error(`Jupiter returned an out-of-range ${label}. The wallet was not asked to sign.`);
  }
  return raw;
}

/** Fail closed on price and identity changes. Never use a different quote in /swap. */
export function verifySwapQuote(quote, intent) {
  if (!quote || typeof quote !== "object" || quote.error) {
    throw new Error("Jupiter did not return a usable route. The wallet was not asked to sign.");
  }
  if (!Number.isSafeInteger(intent.amountRaw) || intent.amountRaw <= 0) {
    throw new Error("The swap amount cannot be represented exactly. The wallet was not asked to sign.");
  }
  if (quote.inputMint !== intent.inputMint || quote.outputMint !== intent.outputMint) {
    throw new Error("Jupiter returned a different token pair. The wallet was not asked to sign.");
  }
  if (quote.swapMode !== "ExactIn" || quote.slippageBps !== SWAP_SLIPPAGE_BPS) {
    throw new Error("Jupiter changed order mode or slippage. The wallet was not asked to sign.");
  }
  const input = rawPositive(quote.inAmount, "input amount");
  const output = rawPositive(quote.outAmount, "output amount");
  const minimum = rawPositive(quote.otherAmountThreshold, "minimum output");
  if (input !== BigInt(intent.amountRaw) || minimum > output) {
    throw new Error("Jupiter changed the trade amount or minimum output. The wallet was not asked to sign.");
  }
  const fraction = Number(quote.priceImpactPct);
  if (quote.priceImpactPct == null || !Number.isFinite(fraction) || fraction < 0) {
    throw new Error("Jupiter returned an invalid price impact. The wallet was not asked to sign.");
  }
  const impactPercent = fraction <= 1 ? fraction * 100 : fraction;
  if (impactPercent > MAX_PRICE_IMPACT_PERCENT) {
    throw new Error(`Price impact is ${impactPercent.toFixed(1)}%. The wallet was not asked to sign.`);
  }
  if (!Array.isArray(quote.routePlan) || quote.routePlan.length === 0 ||
      !quote.routePlan.every((leg) => leg && typeof leg === "object" && leg.swapInfo)) {
    throw new Error("Jupiter returned no executable route. The wallet was not asked to sign.");
  }
  return {
    inAmount: input.toString(),
    outAmount: output.toString(),
    minOutAmount: minimum.toString(),
    impactPercent,
  };
}

/**
 * The display's estimated USD value cannot authorize a larger six-decimal
 * stablecoin input. Call before fetching a quote or asking for a signature.
 * This covers the stablecoin mints supported by Senda; other tokens require
 * their own independent price oracle and wallet confirmation.
 */
export function verifyStableSpend({ inputMint, amountRaw, capUsd, stableMints }) {
  if (!stableMints.includes(inputMint)) return;
  if (!Number.isSafeInteger(amountRaw) || amountRaw <= 0 ||
      !Number.isFinite(capUsd) || capUsd <= 0) {
    throw new Error("Invalid stablecoin spend amount or cap. The wallet was not asked to sign.");
  }
  const capRaw = BigInt(Math.floor(capUsd * 1_000_000));
  if (BigInt(amountRaw) > capRaw) {
    throw new Error("Stablecoin input exceeds the wallet spend cap. The wallet was not asked to sign.");
  }
}
