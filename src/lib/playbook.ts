/** A user's sentence, turned into a spot rule. Price and volume only. No invented open interest, no signature. */

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

export type PlayBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PlayTrade = {
  entry: number;
  exit: number;
  pnl: number;
  hold: number;
  entryTime: number;
  exitTime: number;
};

export type PlayReplay = {
  trades: PlayTrade[];
  marks: { time: number; kind: "buy" | "sell" }[];
  open: { price: number; time: number; at: number } | null;
  fired: boolean;
  winRate: number;
  avgHold: number;
  maxDd: number;
  equity: number;
};

const SPANS = new Set(["15", "60", "1D"]);

function num(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function mention(text: string, symbol: string): boolean {
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`, "i").test(text);
}

export function pickSymbol(text: string, symbols: string[]): string | null {
  const known = [...symbols, "SOL", "HYPE", "JUP", "BTC", "ETH", "BONK", "WIF", "RAY"];
  const ranked = [...new Set(known.map((s) => s.trim()).filter(Boolean))].sort((a, b) => b.length - a.length);
  for (const symbol of ranked) {
    if (mention(text, symbol)) return symbol.toUpperCase() === "SOLANA" ? "SOL" : symbol;
  }
  if (/\bsolana\b/i.test(text)) return "SOL";
  return null;
}

function beforeExit(clean: string): string {
  const cuts: number[] = [];
  for (const re of [/take profit/i, /take at/i, /gives back/i, /give back/i, /\bstop\b/i]) {
    const at = clean.search(re);
    if (at >= 0) cuts.push(at);
  }
  return cuts.length ? clean.slice(0, Math.min(...cuts)) : clean;
}

/** Open interest is named, not measured. Drop that clause before reading a price move. */
function priceClause(entry: string): string {
  return entry.replace(/open interest[^.]*/gi, " ");
}

function exits(clean: string, changePct: number): { takePct: number | null; stopPct: number | null } {
  const entry = beforeExit(clean);
  const hits = [...clean.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].filter((m) => {
    const n = Number(m[1]);
    return n > 0 && n < 100;
  });
  const trigger = hits.find((m) => (m.index ?? 0) < entry.length) ?? null;
  let takePct: number | null = null;
  let stopPct: number | null = null;
  if (/half/i.test(clean) && /give back|gives back/i.test(clean)) takePct = Math.round((changePct / 2) * 100) / 100;
  for (const hit of hits) {
    if (trigger && hit.index === trigger.index) continue;
    const at = hit.index ?? 0;
    const pct = Number(hit[1]);
    const window = clean.slice(Math.max(0, at - 48), at).toLowerCase();
    const stopPos = window.lastIndexOf("stop");
    const takePos = Math.max(window.lastIndexOf("take"), window.lastIndexOf("profit"), window.lastIndexOf("give"));
    if (stopPos >= 0 && stopPos >= takePos) stopPct = pct;
    else if (takePos >= 0) takePct = pct;
    else if (takePct == null) takePct = pct;
    else if (stopPct == null) stopPct = pct;
  }
  return { takePct, stopPct };
}

function say(spec: Omit<PlaySpec, "line">): string {
  const vol = spec.volumeMul ? ` and volume at least ${spec.volumeMul}× the prior bar` : "";
  const oi = spec.wantsOpenInterest ? " Open interest was in the sentence. This pool does not print it, so that part is not armed." : "";
  const exit = [
    spec.takePct ? `take ${spec.takePct}%` : null,
    spec.stopPct ? `stop ${spec.stopPct}%` : null,
    spec.fadeVolume ? "exit when volume fades under the prior bar" : null,
  ].filter(Boolean);
  const clock = spec.span === "1D" ? "day" : spec.span === "15" ? "15 minutes" : "hour";
  return `${spec.side === "buy" ? "Buy" : "Sell"} ${spec.symbol} when the ${clock} is ${spec.direction} ${spec.changePct}%${vol}. ${exit.length ? `Then ${exit.join(", ")}.` : "No take or stop was named."}${oi} $${spec.usd} notional. Phantom still signs.`;
}

/** The sentence the person typed. Missing pieces stay at a small default and are said out loud. */
export function parsePlay(text: string, symbols: string[] = []): PlaySpec | { error: string } {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length < 8) return { error: "Say the coin and the rule. One sentence is enough." };
  const symbol = pickSymbol(clean, symbols);
  if (!symbol) return { error: "Name the coin. SOL, HYPE, or another name on the tape." };
  const sell = /^\s*sell\b/i.test(clean) || /into usdc/i.test(clean) || /for usdc/i.test(clean);
  const side: "buy" | "sell" = sell ? "sell" : "buy";
  const dollars = clean.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  const usd = Math.min(5000, Math.max(1, dollars ? Number(dollars[1]) : 25));
  const span: PlaySpec["span"] = /\bday\b/i.test(clean) ? "1D" : /\b15\b/.test(clean) ? "15" : "60";
  const lookback = 1;
  const entry = beforeExit(clean);
  const priceEntry = priceClause(entry);
  const dip = /dip|off its high|\bdrops\b|\bfalls\b|\bdown\b/i.test(priceEntry);
  const rise = /\bup\b|\bclimbs\b|\bspikes\b|\brallies\b/i.test(priceEntry);
  const direction: "up" | "down" = rise && !dip ? "up" : dip && !rise ? "down" : side === "sell" ? "down" : "up";
  const triggerHits = [...priceEntry.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1])).filter((n) => n > 0 && n < 100);
  const changePct = triggerHits[0] && triggerHits[0] > 0 ? triggerHits[0] : 3;
  const volumeMul = /doubl/i.test(clean) ? 2 : /volume/i.test(clean) && /above|climbs|higher/i.test(clean) ? 1.5 : null;
  const fadeVolume = /volume drops|volume below|below its/i.test(clean);
  const { takePct, stopPct } = exits(clean, changePct);
  const wantsOpenInterest = /open interest/i.test(clean);
  const draft = {
    symbol,
    side,
    usd,
    span,
    lookback,
    changePct,
    direction,
    volumeMul,
    fadeVolume,
    takePct,
    stopPct,
    wantsOpenInterest,
  };
  return { ...draft, line: say(draft) };
}

export function specFromUnknown(raw: unknown, text: string, symbols: string[]): PlaySpec | { error: string } {
  const local = parsePlay(text, symbols);
  if (!("error" in local)) return local;
  if (!raw || typeof raw !== "object") return local;
  const row = raw as Record<string, unknown>;
  const base = "error" in local ? null : local;
  const symbol = typeof row.symbol === "string" ? row.symbol.trim() : base?.symbol;
  if (!symbol || !/^[A-Za-z][A-Za-z0-9.]{0,12}$/.test(symbol)) {
    return base ?? { error: "Name the coin. SOL, HYPE, or another name on the tape." };
  }
  if (!mention(text, symbol) && symbol.toUpperCase() !== "SOL") {
    return base ?? { error: "The rule named a coin that was not in the sentence." };
  }
  const side = row.side === "sell" || row.side === "buy" ? row.side : base?.side ?? "buy";
  const span = typeof row.span === "string" && SPANS.has(row.span) ? (row.span as PlaySpec["span"]) : base?.span ?? "60";
  const direction = row.direction === "down" || row.direction === "up" ? row.direction : base?.direction ?? (side === "sell" ? "down" : "up");
  const changePct = num(row.changePct, base?.changePct ?? 3, 0.1, 80);
  const volumeMul = row.volumeMul == null ? base?.volumeMul ?? null : num(row.volumeMul, 2, 1.05, 10);
  const takePct = row.takePct == null ? base?.takePct ?? null : num(row.takePct, 2, 0.1, 80);
  const stopPct = row.stopPct == null ? base?.stopPct ?? null : num(row.stopPct, 2, 0.1, 80);
  const usd = num(row.usd, base?.usd ?? 25, 1, 5000);
  const wantsOpenInterest = row.wantsOpenInterest === true || base?.wantsOpenInterest === true;
  const fadeVolume = row.fadeVolume === true || base?.fadeVolume === true;
  const draft = {
    symbol: symbol.toUpperCase() === "SOLANA" ? "SOL" : symbol,
    side,
    usd,
    span,
    lookback: 1,
    changePct,
    direction,
    volumeMul,
    fadeVolume,
    takePct,
    stopPct,
    wantsOpenInterest,
  };
  return { ...draft, line: say(draft) };
}

function changeAt(bars: PlayBar[], index: number, lookback: number): number | null {
  const prev = bars[index - lookback];
  const now = bars[index];
  if (!prev || !now || !(prev.close > 0)) return null;
  return ((now.close - prev.close) / prev.close) * 100;
}

function volumeRatio(bars: PlayBar[], index: number, lookback: number): number | null {
  const now = bars[index]?.volume ?? 0;
  const prev = bars[index - lookback]?.volume ?? 0;
  if (!(prev > 0)) return null;
  return now / prev;
}

function entryHit(spec: PlaySpec, bars: PlayBar[], index: number): boolean {
  const move = changeAt(bars, index, spec.lookback);
  if (move == null) return false;
  const priceOk = spec.direction === "up" ? move >= spec.changePct : move <= -spec.changePct;
  if (!priceOk) return false;
  if (spec.volumeMul == null) return true;
  const ratio = volumeRatio(bars, index, spec.lookback);
  return ratio != null && ratio >= spec.volumeMul;
}

function exitHit(spec: PlaySpec, bars: PlayBar[], index: number, entry: number): boolean {
  const now = bars[index];
  if (!now || !(entry > 0)) return false;
  const pnl = spec.side === "buy" ? ((now.close - entry) / entry) * 100 : ((entry - now.close) / entry) * 100;
  if (spec.takePct != null && pnl >= spec.takePct) return true;
  if (spec.stopPct != null && pnl <= -spec.stopPct) return true;
  if (spec.fadeVolume) {
    const prev = bars[index - spec.lookback]?.volume ?? 0;
    if (prev > 0 && now.volume < prev) return true;
  }
  return false;
}

/** Replay the rule on pool bars. A trade here is a print, not a fill. */
export function replayPlay(spec: PlaySpec, bars: PlayBar[]): PlayReplay {
  const trades: PlayTrade[] = [];
  const marks: PlayReplay["marks"] = [];
  let open: { price: number; time: number; at: number } | null = null;
  let fired = false;
  const start = spec.lookback;
  for (let i = start; i < bars.length; i += 1) {
    const bar = bars[i];
    if (!open) {
      if (!entryHit(spec, bars, i)) continue;
      open = { price: bar.close, time: bar.time, at: i };
      marks.push({ time: bar.time, kind: spec.side === "buy" ? "buy" : "sell" });
      if (i === bars.length - 1) fired = true;
      continue;
    }
    if (!exitHit(spec, bars, i, open.price)) continue;
    const exit = bar.close;
    const pnl = spec.side === "buy" ? (exit - open.price) / open.price : (open.price - exit) / open.price;
    trades.push({
      entry: open.price,
      exit,
      pnl,
      hold: i - open.at,
      entryTime: open.time,
      exitTime: bar.time,
    });
    marks.push({ time: bar.time, kind: spec.side === "buy" ? "sell" : "buy" });
    open = null;
  }
  const wins = trades.filter((row) => row.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;
  const avgHold = trades.length ? trades.reduce((sum, row) => sum + row.hold, 0) / trades.length : 0;
  let equity = 1;
  let peak = 1;
  let maxDd = 0;
  for (const trade of trades) {
    equity *= 1 + trade.pnl;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity / peak - 1);
  }
  if (open) {
    const last = bars[bars.length - 1];
    const pnl = spec.side === "buy" ? (last.close - open.price) / open.price : (open.price - last.close) / open.price;
    const marked = equity * (1 + pnl);
    peak = Math.max(peak, marked);
    maxDd = Math.min(maxDd, marked / peak - 1);
  }
  return { trades, marks, open, fired, winRate, avgHold, maxDd, equity };
}
