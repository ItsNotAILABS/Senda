import { useEffect, useMemo, useState } from "react";
import { getPrint, type PrintBar, type PrintTf } from "@/lib/print";
import { cn } from "@/lib/utils";

const TFS: PrintTf[] = ["15m", "1H", "4H", "1D"];
const KINDS = ["candles", "bars", "hollow", "heikin", "line", "area", "baseline", "columns"] as const;
type Kind = (typeof KINDS)[number];
const STUDIES = [
  ["sma", "SMA"],
  ["ema", "EMA"],
  ["bb", "Bands"],
  ["volume", "Volume"],
  ["rsi", "RSI"],
  ["macd", "MACD"],
] as const;
type Study = (typeof STUDIES)[number][0];

function closes(bars: PrintBar[]) {
  return bars.map((b) => b.c);
}

function sma(values: number[], n: number): Array<number | null> {
  return values.map((_, i) => {
    if (i + 1 < n) return null;
    let sum = 0;
    for (let k = i - n + 1; k <= i; k += 1) sum += values[k];
    return sum / n;
  });
}

function ema(values: number[], n: number): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  const k = 2 / (n + 1);
  let prev = 0;
  let started = false;
  for (let i = 0; i < values.length; i += 1) {
    if (i + 1 < n) continue;
    if (!started) {
      let sum = 0;
      for (let j = i - n + 1; j <= i; j += 1) sum += values[j];
      prev = sum / n;
      started = true;
    } else prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function rsi(values: number[], n = 14): Array<number | null> {
  const out: Array<number | null> = values.map(() => null);
  if (values.length <= n) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= n; i += 1) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < values.length; i += 1) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function macdOf(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const line = values.map((_, i) => (fast[i] != null && slow[i] != null ? (fast[i] as number) - (slow[i] as number) : null));
  const present = line.map((v) => v ?? 0);
  const signalRaw = ema(present, 9);
  const signal = line.map((v, i) => (v == null ? null : signalRaw[i]));
  const hist = line.map((v, i) => (v == null || signal[i] == null ? null : v - (signal[i] as number)));
  return { line, signal, hist };
}

function heikin(bars: PrintBar[]): PrintBar[] {
  const out: PrintBar[] = [];
  for (const b of bars) {
    const c = (b.o + b.h + b.l + b.c) / 4;
    const o = out.length ? (out[out.length - 1].o + out[out.length - 1].c) / 2 : (b.o + b.c) / 2;
    out.push({ t: b.t, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c), v: b.v });
  }
  return out;
}

function bands(values: number[], n = 20) {
  const mid = sma(values, n);
  return {
    mid,
    upper: mid.map((m, i) => {
      if (m == null) return null;
      let sum = 0;
      for (let k = i - n + 1; k <= i; k += 1) sum += (values[k] - m) ** 2;
      return m + 2 * Math.sqrt(sum / n);
    }),
    lower: mid.map((m, i) => {
      if (m == null) return null;
      let sum = 0;
      for (let k = i - n + 1; k <= i; k += 1) sum += (values[k] - m) ** 2;
      return m - 2 * Math.sqrt(sum / n);
    }),
  };
}

function lastOf(row: Array<number | null>) {
  for (let i = row.length - 1; i >= 0; i -= 1) if (row[i] != null) return row[i];
  return null;
}

function money(n: number) {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

export function LiveChart({
  mint,
  symbol,
  live,
  compact,
  fill,
  page,
}: {
  mint: string;
  symbol: string;
  live?: number;
  compact?: boolean;
  fill?: boolean;
  page?: boolean;
}) {
  const [tf, setTf] = useState<PrintTf>("1H");
  const [kind, setKind] = useState<Kind>("candles");
  const [on, setOn] = useState<Set<Study>>(() => new Set(["sma", "volume"]));
  const [bars, setBars] = useState<PrintBar[]>([]);
  const [note, setNote] = useState("Loading the chart…");
  const [screen, setScreen] = useState(Boolean(fill));

  function toggle(id: Study) {
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
      setNote("This market has no Solana pool.");
      return;
    }
    let alive = true;
    const pull = () => {
      getPrint({ data: { mint, tf } })
        .then((out) => {
          if (!alive) return;
          setBars(out.bars);
          setNote(out.bars.length ? out.note : "The history did not come back.");
        })
        .catch(() => alive && setNote("The candle feed did not answer."));
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

  const px = closes(shown);
  const sma20 = sma(px, 20);
  const ema20 = ema(px, 20);
  const bb = bands(px, 20);
  const rsi14 = rsi(px, 14);
  const macd = macdOf(px);
  const read = [
    on.has("sma") && lastOf(sma20) != null ? `SMA ${money(lastOf(sma20) as number)}` : "",
    on.has("ema") && lastOf(ema20) != null ? `EMA ${money(lastOf(ema20) as number)}` : "",
    on.has("rsi") && lastOf(rsi14) != null ? `RSI ${(lastOf(rsi14) as number).toFixed(1)}` : "",
    on.has("macd") && lastOf(macd.line) != null ? `MACD ${(lastOf(macd.line) as number).toFixed(4)}` : "",
    on.has("volume") && !shown.some((b) => b.v > 0) ? "Volume not on this feed" : "",
  ].filter(Boolean);

  const controls = (
    <>
      <div className="mb-1 flex gap-1 overflow-x-auto">
        {TFS.map((id) => (
          <button key={id} type="button" onClick={() => setTf(id)} className={cn("min-h-7 shrink-0 rounded-md px-2 font-mono text-[11px]", tf === id ? "bg-white/10 text-white" : "text-white/40")}>
            {id}
          </button>
        ))}
        {(compact ? (["candles", "line", "area", "heikin"] as const) : KINDS).map((id) => (
          <button key={id} type="button" onClick={() => setKind(id)} className={cn("min-h-7 shrink-0 rounded-md px-2 text-[11px] capitalize", kind === id ? "bg-white/10 text-white" : "text-white/40")}>
            {id}
          </button>
        ))}
        <button type="button" onClick={() => setScreen(true)} className="min-h-7 shrink-0 rounded-md bg-[#d7e36a] px-2 text-[11px] font-semibold text-black">
          Full chart
        </button>
      </div>
      <div className="mb-1 flex gap-1 overflow-x-auto">
        {STUDIES.map(([id, label]) => (
          <button key={id} type="button" onClick={() => toggle(id)} className={cn("min-h-7 shrink-0 rounded-md px-2 text-[11px]", on.has(id) ? "bg-white/10 text-white" : "text-white/35")}>
            {label}
          </button>
        ))}
      </div>
    </>
  );

  const board = (
    <Board
      symbol={symbol}
      bars={shown}
      note={note}
      tf={tf}
      kind={kind}
      short={compact && !screen}
      tall={screen || page}
      sma={on.has("sma") ? sma20 : null}
      ema={on.has("ema") ? ema20 : null}
      upper={on.has("bb") ? bb.upper : null}
      lower={on.has("bb") ? bb.lower : null}
      volume={on.has("volume")}
      rsi={on.has("rsi") ? rsi14 : null}
      macd={on.has("macd") ? macd : null}
    />
  );

  return (
    <div>
      {controls}
      {board}
      {read.length ? <p className="px-1 pt-1 font-mono text-[10px] text-white/45">{read.join("  ·  ")}</p> : null}
      {screen ? (
        <div className="fixed inset-0 z-[80] flex flex-col overflow-auto bg-[#07070f] px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{symbol}</p>
              {read.length ? <p className="truncate font-mono text-[11px] text-white/45">{read.join("  ·  ")}</p> : null}
            </div>
            <button type="button" onClick={() => setScreen(false)} className="min-h-10 shrink-0 rounded-full bg-white px-4 text-sm font-semibold text-black">
              Close
            </button>
          </div>
          <div className="py-2">
            {controls}
            {board}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function pathOf(row: Array<number | null>, x: (i: number) => number, y: (n: number) => number) {
  let d = "";
  row.forEach((v, i) => {
    if (v == null) return;
    d += `${d ? " " : ""}${x(i)},${y(v)}`;
  });
  return d;
}

function Board({
  symbol,
  bars,
  note,
  tf,
  kind,
  short,
  tall,
  sma: smaLine,
  ema: emaLine,
  upper,
  lower,
  volume,
  rsi: rsiLine,
  macd,
}: {
  symbol: string;
  bars: PrintBar[];
  note: string;
  tf: string;
  kind: Kind;
  short?: boolean;
  tall?: boolean;
  sma: Array<number | null> | null;
  ema: Array<number | null> | null;
  upper: Array<number | null> | null;
  lower: Array<number | null> | null;
  volume: boolean;
  rsi: Array<number | null> | null;
  macd: { line: Array<number | null>; signal: Array<number | null>; hist: Array<number | null> } | null;
}) {
  if (bars.length < 2) {
    return <div className={cn("grid place-items-center px-4 text-center text-sm text-white/45", short ? "min-h-[120px]" : "min-h-[180px]")}>{note || "No candles."}</div>;
  }
  const drawn = kind === "heikin" ? heikin(bars) : bars;
  const w = 360;
  const volH = volume && drawn.some((b) => b.v > 0) ? 36 : 0;
  const rsiH = rsiLine ? 52 : 0;
  const macdH = macd ? 56 : 0;
  const priceH = short ? 120 : tall ? 280 : 188;
  const h = priceH + volH + rsiH + macdH + 8;
  const pad = 8;
  const extras = [smaLine, emaLine, upper, lower].flatMap((row) => (row ? row.filter((v): v is number => v != null) : []));
  const hi = Math.max(...drawn.map((b) => b.h), ...(extras.length ? extras : [0]));
  const lo = Math.min(...drawn.map((b) => b.l), ...(extras.length ? extras : [Infinity]));
  const span = hi - lo || hi * 0.01 || 1;
  const slot = (w - pad * 2) / drawn.length;
  const y = (price: number) => pad + ((hi - price) / span) * (priceH - pad * 2);
  const x = (i: number) => pad + i * slot + slot / 2;
  const last = drawn[drawn.length - 1];
  const up = last.c >= drawn[0].o;
  const color = up ? "#c6f56a" : "#ff5d73";
  const line = drawn.map((b, i) => `${x(i)},${y(b.c)}`).join(" ");
  const base = drawn[0].o;
  const maxVol = Math.max(1, ...drawn.map((b) => b.v));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={tall ? "h-[70vh] w-full" : "h-auto w-full"} role="img" aria-label={`${symbol} ${kind} ${tf}`}>
      {kind === "area" ? <polygon points={`${x(0)},${y(lo)} ${line} ${x(drawn.length - 1)},${y(lo)}`} fill={color} opacity="0.16" /> : null}
      {kind === "baseline"
        ? drawn.map((b, i) => {
            const above = b.c >= base;
            return <line key={b.t} x1={x(i)} x2={x(i)} y1={y(base)} y2={y(b.c)} stroke={above ? "#c6f56a" : "#ff5d73"} strokeWidth={Math.max(1.2, slot * 0.45)} />;
          })
        : null}
      {kind === "line" || kind === "area" ? <polyline fill="none" stroke={color} strokeWidth="1.6" points={line} /> : null}
      {kind === "columns"
        ? drawn.map((b, i) => {
            const top = y(Math.max(b.c, lo));
            const bot = y(lo);
            return <rect key={b.t} x={x(i) - Math.max(1, slot * 0.35)} y={Math.min(top, bot)} width={Math.max(1.2, slot * 0.7)} height={Math.max(1, Math.abs(bot - top))} fill={b.c >= b.o ? "#c6f56a" : "#ff5d73"} />;
          })
        : null}
      {kind === "candles" || kind === "hollow" || kind === "heikin" || kind === "bars"
        ? drawn.map((b, i) => {
            const green = b.c >= b.o;
            const c = green ? "#c6f56a" : "#ff5d73";
            const top = y(Math.max(b.o, b.c));
            const bot = y(Math.min(b.o, b.c));
            const bw = Math.max(1.4, slot * 0.62);
            const tick = Math.max(2, slot * 0.28);
            return (
              <g key={b.t}>
                <line x1={x(i)} x2={x(i)} y1={y(b.h)} y2={y(b.l)} stroke={c} strokeWidth="1" />
                {kind === "bars" ? (
                  <>
                    <line x1={x(i) - tick} x2={x(i)} y1={y(b.o)} y2={y(b.o)} stroke={c} strokeWidth="1.3" />
                    <line x1={x(i)} x2={x(i) + tick} y1={y(b.c)} y2={y(b.c)} stroke={c} strokeWidth="1.3" />
                  </>
                ) : (
                  <rect x={x(i) - bw / 2} y={top} width={bw} height={Math.max(1, bot - top)} fill={kind === "hollow" && green ? "none" : c} stroke={c} strokeWidth="1" />
                )}
              </g>
            );
          })
        : null}
      {smaLine ? <polyline fill="none" stroke="#7eb6ff" strokeWidth="1.2" points={pathOf(smaLine, x, y)} /> : null}
      {emaLine ? <polyline fill="none" stroke="#e6c15a" strokeWidth="1.2" points={pathOf(emaLine, x, y)} /> : null}
      {upper ? <polyline fill="none" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 2" points={pathOf(upper, x, y)} /> : null}
      {lower ? <polyline fill="none" stroke="#c084fc" strokeWidth="1" strokeDasharray="3 2" points={pathOf(lower, x, y)} /> : null}
      <text x={w - 4} y={y(last.c)} fill={color} fontSize="10" textAnchor="end" fontFamily="ui-monospace, monospace">
        {money(last.c)}
      </text>
      {volH
        ? drawn.map((b, i) => (
            <rect
              key={`v${b.t}`}
              x={x(i) - Math.max(1, slot * 0.3)}
              y={priceH + (1 - b.v / maxVol) * (volH - 6)}
              width={Math.max(1.2, slot * 0.6)}
              height={(b.v / maxVol) * (volH - 6)}
              fill={b.c >= b.o ? "#c6f56a" : "#ff5d73"}
              opacity="0.55"
            />
          ))
        : null}
      {rsiLine
        ? (() => {
            const top = priceH + volH + 8;
            const yy = (v: number) => top + ((100 - v) / 100) * (rsiH - 10);
            return (
              <g>
                <line x1={pad} x2={w - pad} y1={yy(70)} y2={yy(70)} stroke="#ffffff" strokeOpacity="0.12" />
                <line x1={pad} x2={w - pad} y1={yy(30)} y2={yy(30)} stroke="#ffffff" strokeOpacity="0.12" />
                <polyline fill="none" stroke="#7eb6ff" strokeWidth="1.2" points={pathOf(rsiLine, x, yy)} />
                <text x={pad} y={top + 8} fill="#9aa3b5" fontSize="9" fontFamily="ui-monospace, monospace">
                  RSI
                </text>
              </g>
            );
          })()
        : null}
      {macd
        ? (() => {
            const top = priceH + volH + rsiH + 10;
            const vals = [...macd.line, ...macd.signal, ...macd.hist].filter((v): v is number => v != null);
            const max = Math.max(0.0001, ...vals.map((v) => Math.abs(v)));
            const yy = (v: number) => top + (rsiH ? 0 : 0) + ((max - v) / (max * 2)) * (macdH - 12);
            return (
              <g>
                {macd.hist.map((v, i) =>
                  v == null ? null : (
                    <rect key={`m${drawn[i]?.t ?? i}`} x={x(i) - Math.max(1, slot * 0.25)} y={Math.min(yy(v), yy(0))} width={Math.max(1.2, slot * 0.5)} height={Math.max(1, Math.abs(yy(v) - yy(0)))} fill={v >= 0 ? "#c6f56a" : "#ff5d73"} opacity="0.7" />
                  ),
                )}
                <polyline fill="none" stroke="#7eb6ff" strokeWidth="1.1" points={pathOf(macd.line, x, yy)} />
                <polyline fill="none" stroke="#e6c15a" strokeWidth="1.1" points={pathOf(macd.signal, x, yy)} />
                <text x={pad} y={top + 8} fill="#9aa3b5" fontSize="9" fontFamily="ui-monospace, monospace">
                  MACD
                </text>
              </g>
            );
          })()
        : null}
    </svg>
  );
}
