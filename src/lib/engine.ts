/**
 * The numbers the desk uses before a wallet is asked to sign,
 * and the numbers it uses when a pool pays.
 * USDC is 6 decimals. Chips are whole. Neither path invents a fill.
 */

export const FEE_BPS = 100;

export function usd6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/** One percent of the amount that came in. The rest is what can be risked. */
export function takeFee(gross: number): { gross: number; fee: number; net: number } {
  const g = usd6(gross);
  if (!(g > 0)) return { gross: 0, fee: 0, net: 0 };
  const fee = usd6((g * FEE_BPS) / 10_000);
  return { gross: g, fee, net: usd6(g - fee) };
}

/** Whole chips. The fee is an extra chip posting, not a change to the LMSR cost. */
export function chipCut(cost: number): { net: number; fee: number; gross: number } {
  const net = Math.max(1, Math.round(cost));
  const fee = Math.round((net * FEE_BPS) / 10_000);
  return { net, fee, gross: net + fee };
}

export type Gate = { ok: true } | { ok: false; reason: string };

export function acceptSize(usd: number, cap: number): Gate {
  if (!(usd > 0) || !Number.isFinite(usd)) return { ok: false, reason: "Enter an amount." };
  if (!Number.isFinite(cap) || usd > cap) {
    return { ok: false, reason: `That is about $${usd.toFixed(0)}. Your send cap is $${cap}. Raise it on Your money.` };
  }
  return { ok: true };
}

/** Impact over 5% does not reach the wallet. A quote with no output does not either. */
export function acceptQuote(q: { impact: number; outUi: number; minUi: number }): Gate {
  if (!Number.isFinite(q.impact) || q.impact > 5) {
    return { ok: false, reason: `Price impact is ${Number.isFinite(q.impact) ? q.impact.toFixed(1) : "unknown"}%. The wallet was not asked to sign.` };
  }
  if (!(q.outUi > 0) || !(q.minUi > 0)) return { ok: false, reason: "The quote has no output." };
  if (q.minUi > q.outUi * 1.000001) return { ok: false, reason: "The minimum received is above the quote." };
  return { ok: true };
}

export type Print = {
  style: "line" | "band" | "swing";
  mark: number;
  openPrice: number;
  strike: number;
  hi: number;
};

/** Line: at or over the strike, or over the open if the strike is 0. Band: inside. Swing: a percent move either way. */
export function resolvesYes(p: Print): boolean {
  if (p.style === "band") return p.mark >= p.strike && p.mark <= p.hi;
  if (p.style === "swing") {
    if (!(p.openPrice > 0) || !(p.hi > 0)) return false;
    return (Math.abs(p.mark - p.openPrice) / p.openPrice) * 100 >= p.hi;
  }
  if (p.strike > 0) return p.mark >= p.strike;
  return p.mark > p.openPrice;
}

export type Stake = { owner: string; usd: number };

/**
 * Pari-mutuel. One side only, every stake is returned.
 * Both sides, the winning stakes split the whole pot in proportion.
 */
export function pariMutuel(stakes: Stake[], winner: string | null): Stake[] {
  const pot = usd6(stakes.reduce((s, x) => s + x.usd, 0));
  if (!(pot > 0)) return [];
  const live = stakes.filter((s) => s.usd > 0);
  const sides = new Set(live.map((s) => s.owner));
  if (winner == null || sides.size < 2) {
    return live.map((s) => ({ owner: s.owner, usd: usd6(s.usd) }));
  }
  const base = usd6(live.filter((s) => s.owner === winner).reduce((s, x) => s + x.usd, 0));
  if (!(base > 0)) return live.map((s) => ({ owner: s.owner, usd: usd6(s.usd) }));
  const out = new Map<string, number>();
  for (const s of live) {
    if (s.owner !== winner) continue;
    out.set(s.owner, usd6((out.get(s.owner) || 0) + (s.usd / base) * pot));
  }
  return [...out.entries()].map(([owner, usd]) => ({ owner, usd }));
}

/** Two equal stakes. The winner is paid the pot. The number is your profit, not the pot. */
export function challengePay(stake: number, won: boolean): number {
  const paid = pariMutuel(
    [
      { owner: "you", usd: stake },
      { owner: "desk", usd: stake },
    ],
    won ? "you" : "desk",
  );
  const mine = paid.find((p) => p.owner === "you")?.usd ?? 0;
  return usd6(mine - stake);
}

export type NameView = { symbol: string; premium: number | null };

/** Cheap name is a buy. Rich name is a sell. Inside a percent of the mark, it does not queue. */
export function decide(
  names: NameView[],
  bias: "buy" | "sell",
  force: boolean,
): { symbol: string; side: "buy" | "sell" } | null {
  if (!names.length) return null;
  const cheap = [...names].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...names].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  if (bias === "sell") {
    if (!force && (rich.premium ?? 0) <= 0.01) return null;
    return { symbol: rich.symbol, side: "sell" };
  }
  if (!force && (cheap.premium ?? 0) >= -0.01) return null;
  return { symbol: cheap.symbol, side: "buy" };
}

/** Same gate as a wallet swap, from a Jupiter quote that may still be loading. */
export function gateJup(
  q: { priceImpactPct?: string; outAmount?: string; otherAmountThreshold?: string; error?: string } | null,
  usd: number,
  cap: number,
  decimals: number,
): Gate {
  const size = acceptSize(usd, cap);
  if (!size.ok) return size;
  if (!q) return { ok: false, reason: "Asking for a route." };
  if (q.error) return { ok: false, reason: q.error };
  const raw = Math.abs(Number(q.priceImpactPct) || 0);
  const impact = raw > 1 ? raw : raw * 100;
  const outUi = Number(q.outAmount || 0) / 10 ** decimals;
  const minUi = Number(q.otherAmountThreshold || q.outAmount || 0) / 10 ** decimals;
  return acceptQuote({ impact, outUi, minUi });
}

