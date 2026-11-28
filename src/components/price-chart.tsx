import { useEffect, useMemo, useState } from "react";
import { getPrint, type PrintBar, type PrintTf } from "@/lib/print";
import { cn } from "@/lib/utils";

const TFS: PrintTf[] = ["1m", "3m", "5m", "15m", "30m", "1H", "2H", "4H", "8H", "12H"];
const BOOKS = [
  ["desk", "Desk"],
  ["price", "Price"],
  ["mark", "Mark"],
] as const;
type Book = (typeof BOOKS)[number][0];
const SPANS: { id: string; tf: PrintTf; ms: number }[] = [
  { id: "1D", tf: "15m", ms: 86_400_000 },
  { id: "1W", tf: "1H", ms: 7 * 86_400_000 },
  { id: "1M", tf: "4H", ms: 30 * 86_400_000 },
  { id: "YTD", tf: "1D", ms: 0 },
  { id: "All", tf: "1D", ms: 0 },
];
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
  const [book, setBook] = useState<Book>("desk");
  const [span, setSpan] = useState("1D");
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
    const frame = book === "price" ? (SPANS.find((row) => row.id === span)?.tf ?? "15m") : tf;
    const source = book === "mark" ? "mark" : "pool";
    const pull = () => {
      getPrint({ data: { mint, tf: frame, source } })
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
  }, [mint, tf, book, span]);

  const shown = useMemo(() => {
    if (bars.length >= 2) {
      let next = bars;
      if (book === "price") {
        const picked = SPANS.find((row) => row.id === span);
        const start = span === "YTD" ? new Date(new Date().getFullYear(), 0, 1).getTime() : picked && picked.ms > 0 ? Date.now() - picked.ms : 0;
        const cut = start > 0 ? bars.filter((b) => b.t >= start) : bars;
        if (cut.length >= 2) next = cut;
      }
      if (!(live && live > 0)) return next;
      const painted = next.slice();
      const bar = { ...painted[painted.length - 1] };
      bar.c = live;
      bar.h = Math.max(bar.h, live);
      bar.l = Math.min(bar.l, live);
      painted[painted.length - 1] = bar;
      return painted;
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
  }, [bars, live, book, span]);

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

  const drawKind: Kind = book === "desk" ? kind : "area";
  const controls = (
    <>
      <label className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-[12px] text-white/45">Chart</span>
        <select
          value={book}
          onChange={(e) => setBook(e.target.value as Book)}
          className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-2 text-[14px] text-white"
        >
          <option value="desk">Senda candles — we draw the pool</option>
          <option value="price">Senda line — the same pool</option>
          <option value="mark">DefiLlama mark — a second price</option>
        </select>
        <button type="button" onClick={() => setScreen(true)} className="h-11 shrink-0 rounded-lg bg-[#d7e36a] px-3 text-[13px] font-semibold text-black">
          Big
        </button>
      </label>
      {book === "desk" ? (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <select value={tf} onChange={(e) => setTf(e.target.value as PrintTf)} className="h-11 rounded-lg border border-white/10 bg-black px-2 text-[14px] text-white">
              {TFS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="h-11 rounded-lg border border-white/10 bg-black px-2 text-[14px] capitalize text-white">
              {(compact ? (["candles", "line", "area", "heikin"] as const) : KINDS).map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div className="mb-1 flex gap-1 overflow-x-auto">
            {STUDIES.map(([id, label]) => (
              <button key={id} type="button" onClick={() => toggle(id)} className={cn("min-h-7 shrink-0 rounded-md px-2 text-[11px]", on.has(id) ? "bg-white/10 text-white" : "text-white/35")}>
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <select value={span} onChange={(e) => setSpan(e.target.value)} className="mb-2 h-11 w-full rounded-lg border border-white/10 bg-black px-2 text-[14px] text-white">
          {SPANS.map((row) => (
            <option key={row.id} value={row.id}>{row.id}</option>
          ))}
        </select>
      )}
    </>
  );

  const board = (
    <Board
      symbol={symbol}
      bars={shown}
      note={note}
      tf={tf}
      kind={drawKind}
      short={compact && !screen}
      tall={screen || page}
      sma={book === "desk" && on.has("sma") ? sma20 : null}
      ema={book === "desk" && on.has("ema") ? ema20 : null}
      upper={book === "desk" && on.has("bb") ? bb.upper : null}
      lower={book === "desk" && on.has("bb") ? bb.lower : null}
      volume={book === "desk" && on.has("volume")}
      rsi={book === "desk" && on.has("rsi") ? rsi14 : null}
      macd={book === "desk" && on.has("macd") ? macd : null}
    />
  );

  return (
    <div>
      {controls}
      <p className="mb-1 px-1 text-[11px] text-white/40">
        {book === "desk" ? "Desk is this pool, with the studies." : book === "price" ? "Price is the same pool, as a line. Phantom draws its own chart inside its app. This is not that chart." : "Mark is DefiLlama. It is a second price, not the pool and not Phantom."}
      </p>
      {board}
      {read.length ? <p className="px-1 pt-1 font-mono text-[10px] text-white/45">{read.join("  ·  ")}</p> : null}
      {screen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black">
          <div className="flex items-center gap-1 overflow-x-auto px-2 pt-[max(0.35rem,env(safe-area-inset-top))]">
            {TFS.map((id) => (
              <button key={id} type="button" onClick={() => setTf(id)} className={cn("h-9 shrink-0 rounded-full px-2.5 text-[13px]", tf === id ? "bg-white/15 font-semibold text-white" : "text-white/45")}>
                {id}
              </button>
            ))}
            <button type="button" onClick={() => setScreen(false)} aria-label="Close chart" className="ml-auto grid size-9 shrink-0 place-items-center text-lg text-white/70">
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Board
              symbol={symbol}
              bars={shown}
              note={note}
              tf={tf}
              kind="candles"
              tall
              sma={null}
              ema={null}
              upper={null}
              lower={null}
              volume
              rsi={null}
              macd={null}
            />
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
  const volH = volume && drawn.some((b) => b.v > 0) ? (tall ? 110 : 36) : 0;
  const rsiH = rsiLine ? 52 : 0;
  const macdH = macd ? 56 : 0;
  const priceH = short ? 120 : tall ? 460 : 188;
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
    <svg viewBox={`0 0 ${w} ${h}`} className={tall ? "h-full w-full" : "h-auto w-full"} role="img" aria-label={`${symbol} ${kind} ${tf}`}>
      {[0.25, 0.5, 0.75].map((p) => (
        <line key={p} x1={pad} x2={w - 54} y1={pad + p * (priceH - pad * 2)} y2={pad + p * (priceH - pad * 2)} stroke="#ffffff" strokeOpacity="0.08" />
      ))}
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
      <line x1={pad} x2={w - 58} y1={y(last.c)} y2={y(last.c)} stroke="#ffffff" strokeDasharray="2 3" strokeOpacity="0.85" />
      <rect x={w - 54} y={y(last.c) - 9} width={50} height={18} rx={4} fill="#ffffff" />
      <text x={w - 29} y={y(last.c) + 4} fill="#111111" fontSize="10" textAnchor="middle" fontFamily="ui-monospace, monospace">
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
