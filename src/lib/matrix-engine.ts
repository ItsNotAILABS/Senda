/** Deterministic OHLCV market matrix. Informational only. It never grants a signature. */

const good = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export type MatrixBar = { t: number; o: number; h: number; l: number; c: number; v: number };

export type MatrixCell = { id: string; label: string; signal: string; explain: string; weight: number };

export function normalizeBars(bars: unknown): MatrixBar[] {
  if (!Array.isArray(bars)) return [];
  const out = bars
    .filter((b) => b && [b.t, b.o, b.h, b.l, b.c, b.v].every(good) && b.t > 0 && b.o > 0 && b.c > 0 && b.h >= Math.max(b.o, b.c) && b.l > 0 && b.l <= Math.min(b.o, b.c) && b.h >= b.l && b.v >= 0)
    .map((b) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }))
    .sort((a, b) => a.t - b.t);
  return out.filter((b, i) => i === out.length - 1 || b.t !== out[i + 1].t);
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function ema(values: number[], n: number) {
  if (values.length < n) return null;
  let v = mean(values.slice(0, n));
  const k = 2 / (n + 1);
  for (let i = n; i < values.length; i += 1) v = values[i] * k + v * (1 - k);
  return v;
}

function rsi(values: number[], n = 14) {
  if (values.length < n + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= n; i += 1) {
    const d = values[i] - values[i - 1];
    gains += Math.max(0, d);
    losses += Math.max(0, -d);
  }
  gains /= n;
  losses /= n;
  for (let i = n + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    gains = (gains * (n - 1) + Math.max(0, d)) / n;
    losses = (losses * (n - 1) + Math.max(0, -d)) / n;
  }
  return losses === 0 ? (gains === 0 ? 50 : 100) : 100 - 100 / (1 + gains / losses);
}

function atr(bars: MatrixBar[], n = 14) {
  if (bars.length < n + 1) return null;
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i += 1) {
    const b = bars[i];
    const p = bars[i - 1];
    tr.push(Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c)));
  }
  return mean(tr.slice(-n));
}

function cell(id: string, label: string, signal: string, explain: string, weight: number): MatrixCell {
  return { id, label, signal, explain, weight };
}

export function evaluateMatrix(input: { bars?: unknown; source?: string }) {
  const bars = normalizeBars(input?.bars);
  const source = input?.source === "gecko-pool" || input?.source === "jup-chart" ? input.source : "price-only";
  const last = bars.at(-1);
  const volumeReliable = source !== "price-only" && bars.length >= 30 && bars.slice(-21).every((b) => b.v > 0);
  const base = {
    source,
    bars: bars.length,
    volumeReliable,
    volumeUnit: source === "jup-chart" ? "USD Jupiter chart volume" : "USD pool volume",
    close: last?.c ?? null,
    volumeUsd: volumeReliable && last ? last.v : null,
    volumeRatio: null as number | null,
    obv: null as number | null,
    vwap: null as number | null,
    rsi: null as number | null,
    atrPct: null as number | null,
    emaFast: null as number | null,
    emaSlow: null as number | null,
    volumeScore: null as number | null,
    market: "insufficient",
    confidence: 0,
    cells: [] as MatrixCell[],
    reason: "",
  };
  if (bars.length < 30) return { ...base, reason: "Need at least 30 valid chronological OHLCV bars." };
  const closes = bars.map((b) => b.c);
  const recent = bars.slice(-20);
  const fast = ema(closes, 9);
  const slow = ema(closes, 21);
  const r = rsi(closes);
  const a = atr(bars);
  const trend = fast != null && slow != null ? (fast > slow ? 1 : fast < slow ? -1 : 0) : 0;
  const volBase = mean(bars.slice(-21, -1).map((b) => b.v));
  const ratio = volumeReliable && last && volBase > 0 ? last.v / volBase : null;
  const vwapDenom = recent.reduce((s, b) => s + b.v, 0);
  const vwap = volumeReliable && vwapDenom > 0 ? recent.reduce((s, b) => s + ((b.h + b.l + b.c) / 3) * b.v, 0) / vwapDenom : null;
  const obv = volumeReliable
    ? bars.slice(-20).reduce((s, b, i, arr) => (i === 0 ? s : s + (b.c > arr[i - 1].c ? b.v : b.c < arr[i - 1].c ? -b.v : 0)), 0)
    : null;
  const atrPct = a && last && last.c > 0 ? (a / last.c) * 100 : null;
  const low20 = Math.min(...bars.slice(-21, -1).map((b) => b.l));
  const high20 = Math.max(...bars.slice(-21, -1).map((b) => b.h));
  const active = volumeReliable && ratio != null && Number.isFinite(ratio) && ratio > 0;
  const insufficient = "Real pool volume is unavailable. No volume strategy signal.";
  const cells = [
    cell("trend", "EMA 9/21", active ? (trend > 0 ? "bull" : trend < 0 ? "bear" : "neutral") : "blocked", active ? (trend > 0 ? "Fast EMA above slow EMA" : trend < 0 ? "Fast EMA below slow EMA" : "Averages aligned") : insufficient, 0.25),
    cell("breakout", "20-bar breakout", active && last && ratio != null ? (last.c > high20 && ratio >= 1.5 ? "bull" : last.c < low20 && ratio >= 1.5 ? "bear" : "neutral") : "blocked", active && ratio != null ? `Volume ${ratio.toFixed(2)}x vs prior 20 bars` : insufficient, 0.25),
    cell("reversion", "RSI reversion", active && r != null && ratio != null ? (r < 30 && ratio >= 1.1 ? "bull" : r > 70 && ratio >= 1.1 ? "bear" : "neutral") : "blocked", active && r != null && ratio != null ? `RSI ${r.toFixed(1)}; volume ${ratio.toFixed(2)}x` : insufficient, 0.2),
    cell("flow", "Price / VWAP", active && last && vwap != null && obv != null ? (last.c > vwap && obv > 0 ? "bull" : last.c < vwap && obv < 0 ? "bear" : "neutral") : "blocked", active ? "Rolling 20-bar VWAP and OBV. OBV is candle direction, not buyer flow." : "No trustworthy volume for VWAP or OBV", 0.2),
    cell("risk", "ATR volatility", active ? (atrPct != null && atrPct <= 8 ? "neutral" : "caution") : "blocked", active && atrPct != null ? `14-bar ATR ${atrPct.toFixed(2)}% of price` : insufficient, 0.1),
  ];
  const directional = cells.filter((x) => x.signal === "bull" || x.signal === "bear");
  const bulls = directional.filter((x) => x.signal === "bull").reduce((s, x) => s + x.weight, 0);
  const bears = directional.filter((x) => x.signal === "bear").reduce((s, x) => s + x.weight, 0);
  const confidence = active ? Math.min(100, Math.round(Math.abs(bulls - bears) * 100)) : 0;
  const market = active ? (bulls - bears >= 0.45 ? "bullish-watch" : bears - bulls >= 0.45 ? "bearish-watch" : "mixed") : "insufficient";
  return {
    ...base,
    volumeReliable: active,
    volumeUsd: active && last ? last.v : null,
    volumeRatio: ratio,
    obv: active ? obv : null,
    vwap: active ? vwap : null,
    rsi: r,
    atrPct,
    emaFast: fast,
    emaSlow: slow,
    volumeScore: active && ratio != null ? Math.min(100, Math.round(ratio * 40)) : null,
    market,
    confidence,
    cells,
    reason: active ? "Research only. A queue still waits for the wallet." : insufficient,
  };
}

export function matrixClears(matrix: { volumeReliable?: boolean; market?: string; atrPct?: number | null }) {
  return matrix.volumeReliable === true && matrix.market === "bullish-watch" && (matrix.atrPct == null || matrix.atrPct <= 8);
}
