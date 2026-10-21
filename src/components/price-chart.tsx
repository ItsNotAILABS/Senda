import { useEffect, useMemo, useState } from "react";
import { getPrint, type PrintBar, type PrintTf } from "@/lib/print";
import { cn } from "@/lib/utils";

const TFS: PrintTf[] = ["15m", "1H", "4H", "1D"];

export function CandleChart({
  symbol,
  bars,
  note,
  tf,
  className,
}: {
  symbol: string;
  bars: PrintBar[];
  note: string;
  tf: string;
  className?: string;
}) {
  if (bars.length < 2) {
    return <div className={cn("grid min-h-[220px] place-items-center px-4 text-center text-sm text-muted", className)}>{note || "No pool candles."}</div>;
  }
  const w = 860;
  const h = 320;
  const padL = 8;
  const padR = 72;
  const padT = 16;
  const volH = 48;
  const padB = 22;
  const chartH = h - padT - volH - padB;
  const hi = Math.max(...bars.map((b) => b.h));
  const lo = Math.min(...bars.map((b) => b.l));
  const span = hi - lo || hi * 0.01;
  const maxVol = Math.max(1, ...bars.map((b) => b.v));
  const innerW = w - padL - padR;
  const slot = innerW / bars.length;
  const y = (price: number) => padT + ((hi - price) / span) * chartH;
  const ticks = [hi, hi - span / 2, lo];
  const last = bars[bars.length - 1];
  const up = last.c >= bars[0].o;
  const fmt = (price: number) => (price >= 100 ? price.toFixed(2) : price >= 1 ? price.toFixed(4) : price.toFixed(6));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("min-h-[220px] w-full", className)} role="img" aria-label={`${symbol} price`}>
      {ticks.map((price) => (
        <g key={price}>
          <line x1={padL} x2={w - padR} y1={y(price)} y2={y(price)} stroke="#ffffff" strokeOpacity="0.08" />
          <text x={w - padR + 8} y={y(price) + 4} fill="#9aa3b5" fontSize="11" fontFamily="ui-monospace, monospace">
            {fmt(price)}
          </text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x = padL + i * slot + slot / 2;
        const green = b.c >= b.o;
        const color = green ? "#3dd68c" : "#ff5d73";
        const top = y(Math.max(b.o, b.c));
        const bot = y(Math.min(b.o, b.c));
        const body = Math.max(1, bot - top);
        const bw = Math.max(2.2, slot * 0.62);
        return (
          <g key={b.t}>
            <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={color} strokeWidth="1" />
            <rect x={x - bw / 2} y={top} width={bw} height={body} fill={color} />
            <rect
              x={x - bw / 2}
              y={padT + chartH + 8 + (1 - b.v / maxVol) * (volH - 8)}
              width={bw}
              height={(b.v / maxVol) * (volH - 8)}
              fill={color}
              opacity="0.4"
            />
          </g>
        );
      })}
      <text x={padL} y={h - 4} fill="#9aa3b5" fontSize="11" fontFamily="ui-monospace, monospace">
        {symbol} · {tf} · last {fmt(last.c)} · {up ? "up" : "down"}
      </text>
    </svg>
  );
}

/** Pool candles for a mint. The live price is written onto the last bar between refreshes. */
export function LiveChart({
  mint,
  symbol,
  live,
  compact,
  trade,
}: {
  mint: string;
  symbol: string;
  live?: number;
  compact?: boolean;
  trade?: {
    amount: string;
    setAmount: (value: string) => void;
    busy?: boolean;
    quote?: string;
    position?: string;
    filled?: string;
    bucket?: "hold" | "trade";
    setBucket?: (bucket: "hold" | "trade") => void;
    onBuy: () => void;
    onSell: () => void;
    buyLabel?: string;
    sellLabel?: string;
  };
}) {
  const [tf, setTf] = useState<PrintTf>("1H");
  const [kind, setKind] = useState<Kind>("candles");
  const [on, setOn] = useState<Set<string>>(() => new Set(["volume"]));
  const [bars, setBars] = useState<PrintBar[]>([]);
  const [note, setNote] = useState("Loading the pool…");
  const [screen, setScreen] = useState(false);

  function toggle(id: string) {
    setOn((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (mint.length < 32) {
      setBars([]);
      setNote("Last price. This market has no Solana pool.");
      return;
    }
    let alive = true;
    const pull = () => {
      getPrint({ data: { mint, tf } })
        .then((out) => {
          if (!alive) return;
          setBars(out.bars);
          setNote(out.bars.length ? out.note : "Last price. The pool returned no candles.");
        })
        .catch(() => alive && setNote("The candle feed did not answer. The last price is still on the chart."));
    };
    pull();
    const id = window.setInterval(pull, 20_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [mint, tf]);

  const shown = useMemo(() => {
    if (bars.length >= 2) {
      if (!(live && live > 0)) return bars;
      const next = bars.slice();
      const bar = { ...next[next.length - 1] };
      bar.c = live;
      bar.h = Math.max(bar.h, live);
      bar.l = Math.min(bar.l, live);
      next[next.length - 1] = bar;
      return next;
    }
    if (!(live && live > 0)) return bars;
    const now = Date.now();
    return Array.from({ length: 32 }, (_, i) => ({
      t: now - (31 - i) * 3_600_000,
      o: live,
      h: live,
      l: live,
      c: live,
      v: 0,
    }));
  }, [bars, live]);

  const controls = (
    <>
      <div className="mb-2 flex gap-1 overflow-x-auto">
        {TFS.map((id) => (
          <button key={id} type="button" onClick={() => setTf(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 font-mono text-[11px]", tf === id ? "bg-white text-black" : "bg-white/5 text-white/55")}>
            {id}
          </button>
        ))}
        {(
          [
            ["candles", "Candles"],
            ["line", "Line"],
            ["area", "Area"],
            ["bars", "Bars"],
            ["heikin", "Heikin"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-8 shrink-0 rounded-full px-3 text-[11px]", kind === id ? "bg-white text-black" : "bg-white/5 text-white/55")}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setScreen(true)} className="min-h-8 shrink-0 rounded-full bg-[#d7e36a] px-3 text-[11px] font-semibold text-black">
          Full
        </button>
      </div>
      {compact ? null : (
        <div className="mb-2 flex gap-1 overflow-x-auto">
          {(
            [
              ["sma", "SMA"],
              ["ema", "EMA"],
              ["volume", "Volume"],
              ["hollow", "Hollow"],
              ["baseline", "Baseline"],
              ["columns", "Columns"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => (id === "hollow" || id === "baseline" || id === "columns" ? setKind(id) : toggle(id))}
              className={cn("min-h-8 shrink-0 rounded-full px-3 text-[11px]", (id === "hollow" || id === "baseline" || id === "columns" ? kind === id : on.has(id)) ? "bg-white/15 text-white" : "text-white/40")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div>
      {controls}
      <button type="button" onClick={() => setScreen(true)} className="block w-full text-left" aria-label={`Open the full ${symbol} chart`}>
        <BoardChart symbol={symbol} bars={shown} note={note} tf={tf} kind={kind} sma={on.has("sma")} ema={on.has("ema")} volume={on.has("volume")} short={compact} />
      </button>
      {screen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#07070f] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{symbol}</p>
              <p className="font-mono text-sm text-white/55">{live && live > 0 ? (live >= 1 ? `$${live.toLocaleString("en-US", { maximumFractionDigits: 4 })}` : `$${live.toPrecision(4)}`) : note}</p>
            </div>
            <button type="button" onClick={() => setScreen(false)} className="min-h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-black">
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden py-2">
            {controls}
            <BoardChart tall symbol={symbol} bars={shown} note={note} tf={tf} kind={kind} sma={on.has("sma")} ema={on.has("ema")} volume={on.has("volume")} />
          </div>
          {trade ? (
            <div className="space-y-2 border-t border-white/10 pt-3">
              {trade.position ? <p className="text-xs text-white/55">Open · {trade.position}</p> : null}
              {trade.filled ? <p className="text-sm font-semibold text-[#c6f56a]">{trade.filled}</p> : null}
              {trade.setBucket ? (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => trade.setBucket?.("hold")} className={cn("min-h-9 rounded-full text-xs font-semibold", trade.bucket === "trade" ? "bg-white/10 text-white/70" : "bg-white text-black")}>
                    Hold
                  </button>
                  <button type="button" onClick={() => trade.setBucket?.("trade")} className={cn("min-h-9 rounded-full text-xs font-semibold", trade.bucket === "trade" ? "bg-white text-black" : "bg-white/10 text-white/70")}>
                    Trade
                  </button>
                </div>
              ) : null}
              <input
                inputMode="decimal"
                value={trade.amount}
                onChange={(e) => trade.setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-full bg-transparent font-mono text-3xl tabular-nums outline-none"
                aria-label="Amount in USDC"
              />
              {trade.quote ? <p className="text-sm text-white/55">{trade.quote}</p> : null}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={trade.busy} onClick={trade.onBuy} className="min-h-12 rounded-xl bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-50">
                  {trade.buyLabel || "Buy"}
                </button>
                <button type="button" disabled={trade.busy} onClick={trade.onSell} className="min-h-12 rounded-xl bg-[#2a1218] text-sm font-semibold text-[#ff8fa0] disabled:opacity-50">
                  {trade.sellLabel || "Sell"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

type Kind = "area" | "line" | "candles" | "bars" | "heikin" | "hollow" | "baseline" | "columns";

function heikin(bars: PrintBar[]): PrintBar[] {
  let prevO = bars[0]?.o ?? 0;
  let prevC = bars[0]?.c ?? 0;
  return bars.map((b, i) => {
    const c = (b.o + b.h + b.l + b.c) / 4;
    const o = i === 0 ? (b.o + b.c) / 2 : (prevO + prevC) / 2;
    prevO = o;
    prevC = c;
    return { ...b, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c) };
  });
}

function series(bars: PrintBar[], n: number, mode: "sma" | "ema"): number[] {
  const closes = bars.map((b) => b.c);
  if (mode === "sma") {
    return closes.map((_, i) => {
      if (i < n - 1) return Number.NaN;
      let sum = 0;
      for (let j = 0; j < n; j += 1) sum += closes[i - j];
      return sum / n;
    });
  }
  const k = 2 / (n + 1);
  let prev = closes[0] || 0;
  return closes.map((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    return prev;
  });
}

function BoardChart({
  symbol,
  bars,
  note,
  tf,
  kind,
  sma,
  ema,
  volume,
  tall,
  short,
}: {
  symbol: string;
  bars: PrintBar[];
  note: string;
  tf: string;
  kind: Kind;
  sma: boolean;
  ema: boolean;
  volume: boolean;
  tall?: boolean;
  short?: boolean;
}) {
  if (bars.length < 2) {
    return <div className={cn("grid place-items-center px-4 text-center text-sm text-muted", short ? "min-h-[120px]" : "min-h-[180px]")}>{note || "No pool candles."}</div>;
  }
  const drawn = kind === "heikin" ? heikin(bars) : bars;
  const w = 360;
  const h = tall ? 420 : short ? 210 : 280;
  const padL = 8;
  const padR = 54;
  const padT = 12;
  const padB = 8;
  const volH = volume ? 32 : 0;
  const chartH = h - padT - padB - volH;
  const hi = Math.max(...drawn.map((b) => b.h));
  const lo = Math.min(...drawn.map((b) => b.l));
  const span = hi - lo || hi * 0.01;
  const maxVol = Math.max(1, ...drawn.map((b) => b.v));
  const slot = (w - padL - padR) / drawn.length;
  const y = (price: number) => padT + ((hi - price) / span) * chartH;
  const last = drawn[drawn.length - 1];
  const up = last.c >= drawn[0].o;
  const color = up ? "#c6f56a" : "#ff5d73";
  const fmt = (price: number) => (price >= 1000 ? price.toFixed(0) : price >= 1 ? price.toFixed(2) : price.toPrecision(3));
  const smaLine = sma ? series(drawn, 20, "sma") : [];
  const emaLine = ema ? series(drawn, 20, "ema") : [];
  const line = drawn.map((b, i) => `${i === 0 ? "M" : "L"}${(padL + i * slot + slot / 2).toFixed(1)} ${y(b.c).toFixed(1)}`).join(" ");
  const area = `${line} L${(padL + (drawn.length - 1) * slot + slot / 2).toFixed(1)} ${(padT + chartH).toFixed(1)} L${(padL + slot / 2).toFixed(1)} ${(padT + chartH).toFixed(1)} Z`;
  const base = drawn[0].c;
  const overlay = (pts: number[], stroke: string) => {
    const d = pts
      .map((v, i) => (Number.isFinite(v) ? `${(padL + i * slot + slot / 2).toFixed(1)},${y(v).toFixed(1)}` : ""))
      .filter(Boolean);
    if (d.length < 2) return null;
    return <polyline points={d.join(" ")} fill="none" stroke={stroke} strokeWidth="1.4" />;
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={tall ? "h-[58vh] w-full" : short ? "h-[210px] w-full" : "h-72 w-full"} role="img" aria-label={`${symbol} ${kind} ${tf}`}>
      {[hi, hi - span / 2, lo].map((price) => (
        <g key={price}>
          <line x1={padL} x2={w - padR} y1={y(price)} y2={y(price)} stroke="#ffffff" strokeOpacity="0.08" />
          <text x={w - padR + 6} y={y(price) + 3} fill="#9aa3b5" fontSize="10" fontFamily="ui-monospace, monospace">{fmt(price)}</text>
        </g>
      ))}
      <line x1={padL} x2={w - padR} y1={y(last.c)} y2={y(last.c)} stroke={color} strokeOpacity="0.7" strokeDasharray="2 3" />
      <text x={w - padR + 6} y={y(last.c) + 3} fill={color} fontSize="10" fontFamily="ui-monospace, monospace">{fmt(last.c)}</text>
      {kind === "area" ? <path d={area} fill={color} opacity="0.18" /> : null}
      {kind === "baseline" ? <line x1={padL} x2={w - padR} y1={y(base)} y2={y(base)} stroke="#ffffff" strokeOpacity="0.35" strokeDasharray="3 3" /> : null}
      {kind === "line" || kind === "area" || kind === "baseline" ? <path d={line} fill="none" stroke={color} strokeWidth="2" /> : null}
      {kind === "columns"
        ? drawn.map((b, i) => {
            const x = padL + i * slot + slot / 2;
            const bw = Math.max(1.5, slot * 0.7);
            const top = y(b.c);
            const bot = padT + chartH;
            return <rect key={b.t} x={x - bw / 2} y={Math.min(top, bot)} width={bw} height={Math.max(1, Math.abs(bot - top))} fill={b.c >= b.o ? "#c6f56a" : "#ff5d73"} opacity="0.85" />;
          })
        : null}
      {kind === "candles" || kind === "hollow" || kind === "heikin" || kind === "bars"
        ? drawn.map((b, i) => {
            const x = padL + i * slot + slot / 2;
            const green = b.c >= b.o;
            const c = green ? "#c6f56a" : "#ff5d73";
            const top = y(Math.max(b.o, b.c));
            const bot = y(Math.min(b.o, b.c));
            const bw = Math.max(1.5, slot * 0.62);
            const tick = Math.max(2, slot * 0.28);
            return (
              <g key={b.t}>
                <line x1={x} x2={x} y1={y(b.h)} y2={y(b.l)} stroke={c} strokeWidth="1" />
                {kind === "bars" ? (
                  <>
                    <line x1={x - tick} x2={x} y1={y(b.o)} y2={y(b.o)} stroke={c} strokeWidth="1.4" />
                    <line x1={x} x2={x + tick} y1={y(b.c)} y2={y(b.c)} stroke={c} strokeWidth="1.4" />
                  </>
                ) : (
                  <rect x={x - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={kind === "hollow" && green ? "none" : c} stroke={c} strokeWidth="1" />
                )}
              </g>
            );
          })
        : null}
      {overlay(smaLine, "#7eb6ff")}
      {overlay(emaLine, "#e6c15a")}
      {volume
        ? drawn.map((b, i) => {
            const x = padL + i * slot + slot / 2;
            const bw = Math.max(1.5, slot * 0.62);
            const bh = (b.v / maxVol) * (volH - 4);
            return <rect key={`v${b.t}`} x={x - bw / 2} y={h - padB - bh} width={bw} height={bh} fill={b.c >= b.o ? "#c6f56a" : "#ff5d73"} opacity="0.45" />;
          })
        : null}
    </svg>
  );
}
