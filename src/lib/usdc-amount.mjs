/**
 * Integer-cent money helpers. Dollar amounts move through Senda as integer cents and
 * become USDC base units (6 decimals) with BigInt math only — never via float multiplication.
 */
export const USDC_DECIMALS = 6;
const RAW_PER_CENT = 10n ** BigInt(USDC_DECIMALS - 2);
export const MAX_TRANSFER_CENTS = 1_000_000; // $10,000 per transfer

export function assertCents(cents) {
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_TRANSFER_CENTS) {
    throw new Error("Send between $0.01 and $10,000 per transfer.");
  }
  return cents;
}

/** Legacy callers still hold a dollar number. Convert it once, at the edge, to whole cents. */
export function usdNumberToCents(usd) {
  if (typeof usd !== "number" || !Number.isFinite(usd)) throw new Error("Enter an amount.");
  return assertCents(Math.round(usd * 100));
}

/** cents -> USDC base units (1 cent = 10,000 raw units). */
export function centsToUsdcRaw(cents) {
  return BigInt(assertCents(cents)) * RAW_PER_CENT;
}

/** cents -> exact "12.34" decimal string for display, links and memos. */
export function centsToDecimalString(cents) {
  assertCents(cents);
  const whole = Math.floor(cents / 100);
  return `${whole}.${String(cents % 100).padStart(2, "0")}`;
}
