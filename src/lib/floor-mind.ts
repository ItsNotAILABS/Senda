/** The floor writes the rule from bars. The person only sets a promise and a cap. */

export type PlayBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PlaySpec = {
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  span: "15" | "60" | "1D";
  lookback: number;
  changePct: number;
  direction: "up" | "down";
  volumeMul: number | null;
  fadeVolume: boolean;
  takePct: number | null;
  stopPct: number | null;
  wantsOpenInterest: boolean;
  line: string;
};

export type PromiseMode = "watch" | "alert" | "prepare";

export type FloorPromise = {
  mode: PromiseMode;
  tradeUsd: number;
  dayUsd: number;
};

export type SizeRow = {
  usd: number;
  status: string;
  impactPct: number | null;
  router: string | null;
};

export type SizePick = {
  usd: number | null;
  impactPct: number | null;
  router: string | null;
  note: string;
};

export type MonroeLane = {
  id: "direct" | "routed" | "liquify";
  outAmount: string;
  route: string;
  impact: number | null;
};

export type MonroePick = {
  winner: MonroeLane | null;
  edgeBps: number | null;
  note: string;
};

const RAW = /^[1-9][0-9]{0,39}$/;

export function clampPromise(input: { mode?: string; tradeUsd?: number; dayUsd?: number }, sendCap: number): FloorPromise {
  const cap = Math.min(5000, Math.max(1, Math.round(sendCap) || 1));
  const mode: PromiseMode = input.mode === "alert" || input.mode === "prepare" ? input.mode : "watch";
  const trade = Math.min(cap, Math.max(1, Math.round(Number(input.tradeUsd) || Math.min(25, cap))));
  const day = Math.min(5000, Math.max(trade, Math.round(Number(input.dayUsd) || Math.max(trade, Math.min(100, cap)))));
  return { mode, tradeUsd: trade, dayUsd: day };
}

/** What one trade may still use: the trade cap, what is left today, and the send cap. */
export function roomLeft(promise: FloorPromise, spent: number, sendCap: number): number {
  const cap = Math.min(5000, Math.max(0, Math.round(sendCap) || 0));
  const left = Math.max(0, promise.dayUsd - Math.max(0, spent));
  return Math.max(0, Math.min(promise.tradeUsd, left, cap));
}

/**
 * Largest Liquify size inside the cap whose impact is still calm.
 * A missing quote is not a size. A hot size is used only when every size is hot.
 */
export function pickSize(rows: SizeRow[], cap: number, maxImpact = 1): SizePick {
  const budget = Math.max(0, cap);
  const live = (Array.isArray(rows) ? rows : []).filter((row) => row.status === "available" && row.usd > 0 && row.usd <= budget + 1e-6);
  if (!live.length) {
    return {
      usd: null,
      impactPct: null,
      router: null,
      note: budget < 5 ? "The cap is under Liquify's smallest size, $5." : "Liquify did not quote a size inside the cap.",
    };
  }
  const calm = live.filter((row) => row.impactPct == null || Math.abs(row.impactPct) <= maxImpact);
  const pick = [...(calm.length ? calm : live)].sort((a, b) => b.usd - a.usd)[0];
  const impact = pick.impactPct == null ? "" : ` Impact ${Math.abs(pick.impactPct).toFixed(2)}%.`;
  const venue = pick.router ? ` ${pick.router}.` : "";
  return {
    usd: pick.usd,
    impactPct: pick.impactPct,
    router: pick.router,
    note: calm.length
      ? `Liquify sized $${pick.usd}.${impact}${venue}`
      : `Every size inside the cap is past ${maxImpact}% impact. Liquify kept $${pick.usd}.${impact}${venue}`,
  };
}

/** Higher raw output wins. The edge is against the next route, in basis points. */
export function monroePick(lanes: MonroeLane[]): MonroePick {
  const ok = (Array.isArray(lanes) ? lanes : []).filter((lane) => RAW.test(String(lane.outAmount || "")));
  if (!ok.length) return { winner: null, edgeBps: null, note: "Monroe had no route to compare." };
  const ranked = [...ok].sort((a, b) => (BigInt(b.outAmount) > BigInt(a.outAmount) ? 1 : BigInt(b.outAmount) < BigInt(a.outAmount) ? -1 : 0));
  const winner = ranked[0];
  const next = ranked[1];
  if (!next) return { winner, edgeBps: null, note: `Only ${winner.route} answered.` };
  if (next.outAmount === winner.outAmount) return { winner, edgeBps: 0, note: `${winner.route} tied ${next.route}.` };
  const edge = Number(((BigInt(winner.outAmount) - BigInt(next.outAmount)) * 10000n) / BigInt(next.outAmount));
  const bps = Number.isFinite(edge) ? Math.max(0, Math.round(edge)) : null;
  if (bps === 0) return { winner, edgeBps: 0, note: `${winner.route} tied ${next.route}.` };
  return { winner, edgeBps: bps, note: `${winner.route} pays ${bps == null ? "more" : `${bps} bps more`} than ${next.route}.` };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function lineFor(spec: Omit<PlaySpec, "line">): string {
  const vol = spec.volumeMul ? ` and volume at least ${spec.volumeMul}× the prior hour` : "";
  return `${spec.side === "buy" ? "Buy" : "Sell"} ${spec.symbol} when the hour is ${spec.direction} ${spec.changePct}%${vol}. Then take ${spec.takePct}%, stop ${spec.stopPct}%. $${spec.usd || 0} notional. The floor wrote this. Phantom still signs.`;
}

function latestMove(bars: PlayBar[]): { move: number; vol: number | null } | null {
  for (let i = bars.length - 1; i >= 1; i -= 1) {
    const prev = bars[i - 1];
    const now = bars[i];
    if (!prev || !now || !(prev.close > 0) || !(now.close > 0)) continue;
    const move = ((now.close - prev.close) / prev.close) * 100;
    const vol = prev.volume > 0 && now.volume > 0 ? now.volume / prev.volume : null;
    if (Math.abs(move) >= 0.8 || (vol != null && vol >= 1.8 && Math.abs(move) >= 0.4)) return { move, vol };
  }
  return null;
}

function hits(spec: Omit<PlaySpec, "line">, bars: PlayBar[]): boolean {
  for (let i = spec.lookback; i < bars.length; i += 1) {
    const prev = bars[i - spec.lookback];
    const now = bars[i];
    if (!prev || !now || !(prev.close > 0)) continue;
    const move = ((now.close - prev.close) / prev.close) * 100;
    const priceOk = spec.direction === "up" ? move >= spec.changePct : move <= -spec.changePct;
    if (!priceOk) continue;
    if (spec.volumeMul == null) return true;
    if (!(prev.volume > 0)) continue;
    if (now.volume / prev.volume >= spec.volumeMul) return true;
  }
  return false;
}

/** One rule from the latest hour that actually moved. A flat window returns nothing. */
export function inventFromBars(symbol: string, bars: PlayBar[], usd: number): PlaySpec | null {
  if (!symbol || !Array.isArray(bars) || bars.length < 8) return null;
  const found = latestMove(bars);
  if (!found) return null;
  const { move, vol } = found;
  const blowoff = move >= 4;
  const side: "buy" | "sell" = blowoff ? "sell" : "buy";
  const direction: "up" | "down" = blowoff || move >= 0 ? "up" : "down";
  const changePct = Math.min(12, Math.max(0.5, round1(Math.abs(move) * 0.85)));
  const volumeMul = vol != null && vol >= 1.4 ? Math.min(3, round1(vol)) : null;
  const draft: Omit<PlaySpec, "line"> = {
    symbol,
    side,
    usd: Math.max(0, Math.round(usd)),
    span: "60",
    lookback: 1,
    changePct,
    direction,
    volumeMul,
    fadeVolume: false,
    takePct: 2,
    stopPct: 2,
    wantsOpenInterest: false,
  };
  let spec: PlaySpec = { ...draft, line: lineFor(draft) };
  if (!hits(draft, bars) && volumeMul != null) {
    const loose = { ...draft, volumeMul: null };
    spec = { ...loose, line: lineFor(loose) };
  }
  if (!hits(spec, bars)) return null;
  return spec;
}
