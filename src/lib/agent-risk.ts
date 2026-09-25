/** Hard gate in front of an agent send. The wallet is not asked to sign a clipped or blocked order. */

const KEY = "senda.agent.book.v1";
export const MAX_DRAWDOWN = 0.15;

export type Gate = {
  tape: string;
  risk: string;
  usd: number;
  blocked: string | null;
  drawdown: number;
};

export function bookLevel(lasts: number[]): number {
  if (!lasts.length) return 0;
  return lasts.reduce((s, n) => s + n, 0) / lasts.length;
}

export function pushLevel(level: number): number[] {
  if (!(level > 0) || typeof window === "undefined") return level > 0 ? [level] : [];
  let prev: number[] = [];
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "[]") as number[];
    if (Array.isArray(p)) prev = p.filter((n) => typeof n === "number" && n > 0);
  } catch {
    prev = [];
  }
  const last = prev[prev.length - 1];
  const next = last && Math.abs(last - level) / last < 0.002 ? prev : [...prev, level].slice(-48);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
  return next;
}

export function drawdown(series: number[]): number {
  let peak = 0;
  let worst = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) worst = Math.max(worst, (peak - v) / peak);
  }
  return worst;
}

export function review(input: {
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  premium: number | null;
  change24h: number | null;
  series: number[];
  cap: number;
}): Gate {
  const prem = input.premium ?? 0;
  const chg = input.change24h ?? 0;
  let score = 0;
  if (prem < -0.02) score += 0.4;
  else if (prem > 0.02) score -= 0.4;
  if (chg > 0) score += 0.2;
  else if (chg < 0) score -= 0.2;
  const confidence = Math.min(1, Math.abs(score) + 0.3);
  const dd = drawdown(input.series);
  const tape = `${input.symbol} is ${prem >= 0 ? "over" : "under"} its mark by ${Math.abs(prem * 100).toFixed(1)}%. 24h ${chg >= 0 ? "+" : ""}${(chg * 100).toFixed(1)}%.`;
  if (input.side === "buy" && dd > MAX_DRAWDOWN) {
    return {
      tape,
      risk: `The book is ${(dd * 100).toFixed(1)}% off its recent peak. New buys are stopped.`,
      usd: 0,
      blocked: `Buys are stopped. The book is ${(dd * 100).toFixed(0)}% off its recent peak.`,
      drawdown: dd,
    };
  }
  let usd = Math.min(input.usd, input.cap);
  const notes = [`Cap $${input.cap}.`];
  if (confidence < 0.5 && input.side === "buy") {
    usd = Math.max(1, Math.round(usd * 0.5));
    notes.push("Weak tape, so the size is cut in half.");
  }
  if (usd < input.usd) notes.push(`Requested $${input.usd}, sending $${usd}.`);
  return { tape, risk: notes.join(" "), usd, blocked: null, drawdown: dd };
}
