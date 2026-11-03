/** Close-to-close walk of a rule on pool candles. One position. No invented prices. */

export type Bar = { t: number; c: number };

export type Rule =
  | { kind: "sma"; period: number; takePct: number; stopPct: number }
  | { kind: "drop"; lookback: number; dropPct: number; takePct: number; stopPct: number };

export type BackTrade = {
  entry: number;
  exit: number;
  entryPx: number;
  exitPx: number;
  pnl: number;
  why: string;
};

export type Backtest = {
  trades: BackTrade[];
  start: number;
  end: number;
  pnl: number;
  wins: number;
  maxDd: number;
  bars: number;
  note: string;
};

const FEE = 0.001;

function sma(closes: number[], i: number, period: number): number | null {
  if (i + 1 < period) return null;
  let sum = 0;
  for (let k = i - period + 1; k <= i; k++) sum += closes[k];
  return sum / period;
}

export function runBacktest(bars: Bar[], usd: number, rule: Rule): Backtest {
  const size = Math.round(usd * 100) / 100;
  const empty: Backtest = {
    trades: [],
    start: size,
    end: size,
    pnl: 0,
    wins: 0,
    maxDd: 0,
    bars: bars.length,
    note: "Need more candles than the window.",
  };
  if (!(size > 0) || bars.length < 8) return empty;
  const closes = bars.map((b) => b.c).filter((c) => c > 0);
  if (closes.length !== bars.length) return { ...empty, note: "A candle had no close." };

  let cash = size;
  let qty = 0;
  let spent = 0;
  let entryPx = 0;
  let entryAt = 0;
  let peak = size;
  let maxDd = 0;
  const trades: BackTrade[] = [];

  function mark(px: number) {
    const equity = qty > 0 ? cash + qty * px : cash;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  function buy(i: number, px: number) {
    spent = cash;
    qty = (cash * (1 - FEE)) / px;
    cash = 0;
    entryPx = px;
    entryAt = bars[i].t;
  }

  function sell(i: number, px: number, why: string) {
    const back = qty * px * (1 - FEE);
    trades.push({ entry: entryAt, exit: bars[i].t, entryPx, exitPx: px, pnl: back - spent, why });
    cash = back;
    qty = 0;
    spent = 0;
  }

  for (let i = 1; i < bars.length; i++) {
    const px = closes[i];
    const prev = closes[i - 1];
    if (qty > 0) {
      const up = (px - entryPx) / entryPx;
      const take = rule.takePct / 100;
      const stop = rule.stopPct / 100;
      if (up >= take) sell(i, px, "take");
      else if (up <= -stop) sell(i, px, "stop");
      else if (rule.kind === "sma") {
        const avg = sma(closes, i, rule.period);
        const prevAvg = sma(closes, i - 1, rule.period);
        if (avg != null && prevAvg != null && prev <= prevAvg && px > avg) sell(i, px, "back over the average");
      }
    } else if (rule.kind === "sma") {
      const avg = sma(closes, i, rule.period);
      const prevAvg = sma(closes, i - 1, rule.period);
      if (avg != null && prevAvg != null && prev >= prevAvg && px < avg) buy(i, px);
    } else {
      const from = Math.max(0, i - rule.lookback);
      let hi = closes[from];
      for (let k = from; k < i; k++) if (closes[k] > hi) hi = closes[k];
      if (hi > 0 && (hi - px) / hi >= rule.dropPct / 100) buy(i, px);
    }
    mark(px);
  }

  if (qty > 0) sell(bars.length - 1, closes[closes.length - 1], "still open, marked at the last close");
  const wins = trades.filter((t) => t.pnl > 0).length;
  return {
    trades,
    start: size,
    end: cash,
    pnl: cash - size,
    wins,
    maxDd,
    bars: bars.length,
    note: `${trades.length} round trips · 10 bps each way · closes only · one position · not a fill`,
  };
}
