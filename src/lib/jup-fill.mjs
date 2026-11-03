/** A listed Solana asset has to clear a live Jupiter quote at the slippage a trade uses. */

export const PRODUCTION_SLIPPAGE_BPS = 100;
/** Retail buy used before a Solana mint is listed. A $10 print can clear a book that $100 cannot. */
export const FILL_PROBE_USD = 100;

/** Jupiter sends price impact as a fraction (0.01 = 1%). A number above 1 is already a percent. */
export function impactBps(priceImpactPct) {
  const n = Math.abs(Number(priceImpactPct));
  if (!Number.isFinite(n)) return Number.POSITIVE_INFINITY;
  const percent = n > 1 ? n : n * 100;
  return percent * 100;
}

export function fillsAtProductionSlippage(quote) {
  if (!quote || typeof quote !== "object" || quote.error) return false;
  let out = 0n;
  try {
    out = BigInt(String(quote.outAmount ?? "0").split(".")[0] || "0");
  } catch {
    return false;
  }
  if (out <= 0n) return false;
  const slip = Number(quote.slippageBps ?? PRODUCTION_SLIPPAGE_BPS);
  if (!(slip > 0) || impactBps(quote.priceImpactPct) > slip) return false;
  const spent = Number(quote.inUsd);
  const received = Number(quote.swapUsdValue);
  if (spent > 0 && received > 0 && received < spent * 0.95) return false;
  return true;
}

/** Keep a row with no mint (a price on another chain) and USDC. Drop a Solana mint Jupiter cannot fill. */
export function keepListed(rows, fillableMints) {
  const ok = new Set(fillableMints);
  return (rows || []).filter((row) => {
    if (!row?.mint || row.symbol === "USDC") return true;
    return ok.has(row.mint);
  });
}

/**
 * Target weight is the book's share. Filled weight is that share after legs
 * Jupiter cannot fill are dropped. The level is 1000 when executable price equals mark.
 */
export function weightBook(legs, quotes) {
  const book = Array.isArray(legs) ? legs : [];
  const bookTarget = book.reduce((sum, leg) => sum + (Number(leg.target) > 0 ? Number(leg.target) : 0), 0);
  const drafted = book.map((leg) => {
    const quote = quotes?.[leg.mint] ?? null;
    const filled = fillsAtProductionSlippage(quote);
    const inRaw = Number(quote?.inAmount);
    const spendUsd = Number.isFinite(inRaw) && inRaw > 0 ? inRaw / 1e6 : 0;
    const outRaw = Number(quote?.outAmount);
    const decimals = Number(leg.decimals);
    const tokens = Number.isInteger(decimals) && decimals >= 0 && outRaw > 0 ? outRaw / 10 ** decimals : 0;
    const exec = filled && tokens > 0 && spendUsd > 0 ? spendUsd / tokens : 0;
    const mark = Number(leg.mark);
    return {
      symbol: String(leg.symbol || ""),
      mint: String(leg.mint || ""),
      filled: Boolean(filled && exec > 0 && mark > 0),
      exec,
      mark,
      impactBps: quote ? impactBps(quote.priceImpactPct) : null,
      outAmount: quote?.outAmount != null ? String(quote.outAmount) : "0",
      spendUsd,
      target: Number(leg.target) > 0 ? Number(leg.target) : 0,
    };
  });
  const liveTarget = drafted.reduce((sum, leg) => sum + (leg.filled ? leg.target : 0), 0);
  const level =
    liveTarget > 0
      ? drafted.reduce((sum, leg) => (leg.filled ? sum + (leg.exec / leg.mark) * (leg.target / liveTarget) : sum), 0) * 1000
      : null;
  return {
    level,
    legs: drafted.map((leg) => ({
      symbol: leg.symbol,
      mint: leg.mint,
      filled: leg.filled,
      exec: leg.exec,
      mark: leg.mark,
      impactBps: leg.impactBps,
      outAmount: leg.outAmount,
      spendUsd: leg.spendUsd,
      targetWeight: bookTarget > 0 ? leg.target / bookTarget : 0,
      filledWeight: leg.filled && liveTarget > 0 ? leg.target / liveTarget : 0,
    })),
  };
}

export async function mapPool(items, limit, fn) {
  const list = Array.from(items);
  const out = new Array(list.length);
  let cursor = 0;
  const workers = Math.max(1, Math.min(limit, list.length || 1));
  async function worker() {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      out[index] = await fn(list[index], index);
    }
  }
  await Promise.all(Array.from({ length: list.length ? workers : 0 }, () => worker()));
  return out;
}
