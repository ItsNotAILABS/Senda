/** Indicators from the bars already on the chart. Same numbers for the picture and for an agent. */

export type Bar = { time: number; high: number; low: number; close: number };

export type TapeRead = {
  close: number;
  sma20: number | null;
  ema20: number | null;
  ema50: number | null;
  rsi: number | null;
  macd: number | null;
  macdSignal: number | null;
  hist: number | null;
  bbUpper: number | null;
  bbMid: number | null;
  bbLower: number | null;
  atr: number | null;
  bias: "long" | "short" | "flat";
  why: string;
};

const KEY = "senda.indicators.v1";

function lastFinite(values: number[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) if (Number.isFinite(values[i])) return values[i];
  return null;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : Number.NaN);
  }
  return out;
}

export function ema(values: number[], period: number): number[] {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = Number.NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(Number.NaN);
      continue;
    }
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      out.push(prev);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const out: number[] = values.map(() => Number.NaN);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function atr(bars: Bar[], period = 14): number[] {
  const out: number[] = bars.map(() => Number.NaN);
  if (bars.length <= period) return out;
  let prev = 0;
  for (let i = 1; i <= period; i++) {
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    prev += tr;
  }
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < bars.length; i++) {
    const tr = Math.max(bars[i].high - bars[i].low, Math.abs(bars[i].high - bars[i - 1].close), Math.abs(bars[i].low - bars[i - 1].close));
    prev = (prev * (period - 1) + tr) / period;
    out[i] = prev;
  }
  return out;
}

export function lineOf(bars: Bar[], id: "sma" | "ema20" | "ema50" | "bbUp" | "bbMid" | "bbDown"): { time: number; value: number }[] {
  const closes = bars.map((b) => b.close);
  let values: number[] = [];
  if (id === "sma" || id === "bbMid") values = sma(closes, 20);
  else if (id === "ema20") values = ema(closes, 20);
  else if (id === "ema50") values = ema(closes, 50);
  else {
    const mid = sma(closes, 20);
    values = mid.map((m, i) => {
      if (!Number.isFinite(m) || i < 19) return Number.NaN;
      const slice = closes.slice(i - 19, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
      const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
      return id === "bbUp" ? m + 2 * sd : m - 2 * sd;
    });
  }
  const points: { time: number; value: number }[] = [];
  bars.forEach((bar, i) => {
    if (Number.isFinite(values[i])) points.push({ time: bar.time, value: values[i] });
  });
  return points;
}

export function readTape(bars: Bar[]): TapeRead | null {
  const rows = bars.filter((b) => b.close > 0);
  if (rows.length < 20) return null;
  const closes = rows.map((b) => b.close);
  const mid = sma(closes, 20);
  const e20 = ema(closes, 20);
  const e50 = ema(closes, 50);
  const rs = rsi(closes);
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const macdLine = fast.map((v, i) => (Number.isFinite(v) && Number.isFinite(slow[i]) ? v - slow[i] : Number.NaN));
  const macdCompact = macdLine.filter((v) => Number.isFinite(v));
  const sig = ema(macdCompact, 9);
  const macd = lastFinite(macdLine);
  const macdSignal = lastFinite(sig);
  const bb = mid.map((m, i) => {
    if (!Number.isFinite(m) || i < 19) return { up: Number.NaN, down: Number.NaN };
    const slice = closes.slice(i - 19, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const sd = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length);
    return { up: m + 2 * sd, down: m - 2 * sd };
  });
  const close = closes[closes.length - 1];
  const sma20 = lastFinite(mid);
  const ema20 = lastFinite(e20);
  const rsiNow = lastFinite(rs);
  const hist = macd != null && macdSignal != null ? macd - macdSignal : null;
  let bias: TapeRead["bias"] = "flat";
  let why = "RSI, MACD, and the averages do not agree.";
  if (rsiNow != null && rsiNow >= 70 && ema20 != null && close < ema20) {
    bias = "short";
    why = `RSI ${rsiNow.toFixed(1)} and price under the 20 EMA.`;
  } else if (rsiNow != null && rsiNow <= 30 && ema20 != null && close > ema20) {
    bias = "long";
    why = `RSI ${rsiNow.toFixed(1)} and price over the 20 EMA.`;
  } else if (hist != null && hist < 0 && sma20 != null && close < sma20) {
    bias = "short";
    why = "MACD is under its line and price is under the 20 SMA.";
  } else if (hist != null && hist > 0 && sma20 != null && close > sma20) {
    bias = "long";
    why = "MACD is over its line and price is over the 20 SMA.";
  }
  return {
    close,
    sma20,
    ema20,
    ema50: lastFinite(e50),
    rsi: rsiNow,
    macd,
    macdSignal,
    hist,
    bbUpper: lastFinite(bb.map((b) => b.up)),
    bbMid: sma20,
    bbLower: lastFinite(bb.map((b) => b.down)),
    atr: lastFinite(atr(rows)),
    bias,
    why,
  };
}

export function saveTape(symbol: string, read: TapeRead) {
  if (typeof localStorage === "undefined") return;
  try {
    const bag = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, TapeRead & { at: number }>;
    bag[symbol.toUpperCase()] = { ...read, at: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(bag));
  } catch {
    /* quota */
  }
}

export function loadTapes(): Record<string, TapeRead & { at: number }> {
  if (typeof localStorage === "undefined") return {};
  try {
    const bag = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<string, TapeRead & { at: number }>;
    return bag && typeof bag === "object" ? bag : {};
  } catch {
    return {};
  }
}
