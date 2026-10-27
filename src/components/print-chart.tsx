import { useEffect, useMemo, useRef, useState } from "react";
import { CandleChart, type ChartHandle } from "@/components/candle-chart";
import { MarketMatrix } from "@/components/market-matrix";
import { lineOf, readTape, saveTape } from "@/lib/indicators";
import { printBars } from "@/lib/print-bars";
import type { DerivBar } from "@/lib/deriv-book";

const TV: Record<string, string> = {
  SOL: "BINANCE:SOLUSDT",
  BTC: "BINANCE:BTCUSDT",
  ETH: "BINANCE:ETHUSDT",
  BNB: "BINANCE:BNBUSDT",
  XRP: "BINANCE:XRPUSDT",
  DOGE: "BINANCE:DOGEUSDT",
  JUP: "BINANCE:JUPUSDT",
  RAY: "BINANCE:RAYUSDT",
  WIF: "BINANCE:WIFUSDT",
  BONK: "BINANCE:BONKUSDT",
  PYTH: "BINANCE:PYTHUSDT",
  JTO: "BINANCE:JTOUSDT",
  RENDER: "BINANCE:RENDERUSDT",
  PENGU: "BINANCE:PENGUUSDT",
};

const TF = ["1", "5", "15", "60", "240", "1D"] as const;
type Tf = (typeof TF)[number];
const TF_LABEL: Record<Tf, string> = { "1": "1m", "5": "5m", "15": "15m", "60": "1H", "240": "4H", "1D": "1D" };
const TF_SEC: Record<Tf, number> = { "1": 60, "5": 300, "15": 900, "60": 3600, "240": 14400, "1D": 86400 };
const CHARTS = "senda.chart.v1";

function readBars(mint: string, span: Tf): DerivBar[] {
  if (typeof window === "undefined") return [];
  try {
    const bag = JSON.parse(window.localStorage.getItem(CHARTS) || "{}") as Record<string, DerivBar[]>;
    const rows = bag[`${mint}:${span}`];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveBars(mint: string, span: Tf, rows: DerivBar[]) {
  if (typeof window === "undefined" || rows.length < 2) return;
  try {
    const bag = JSON.parse(window.localStorage.getItem(CHARTS) || "{}") as Record<string, DerivBar[]>;
    bag[`${mint}:${span}`] = rows.slice(-180);
    const keys = Object.keys(bag);
    for (const key of keys.slice(0, Math.max(0, keys.length - 12))) delete bag[key];
    window.localStorage.setItem(CHARTS, JSON.stringify(bag));
  } catch {
    /* quota */
  }
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

function paintLive(base: DerivBar[], price: number, bucket: number): DerivBar[] {
  const t = Math.floor(Date.now() / 1000 / bucket) * bucket;
  if (!base.length) return [{ time: t, open: price, high: price, low: price, close: price }];
  const last = base[base.length - 1];
  if (t > last.time) return [...base.slice(-200), { time: t, open: last.close, high: Math.max(last.close, price), low: Math.min(last.close, price), close: price }];
  if (t < last.time) return base;
  return [...base.slice(0, -1), { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }];
}

/** Pool candles. The frame matches a TradingView dark chart. The bars are the Solana pool, not a stock feed. */
export function PrintChart({ mint, symbol, className = "h-[320px]" }: { mint: string; symbol: string; className?: string }) {
  const [bars, setBars] = useState<DerivBar[]>([]);
  const [state, setState] = useState<"ask" | "empty" | "ready">("ask");
  const [levels, setLevels] = useState<number[]>([]);
  const [screen, setScreen] = useState(false);
  const [span, setSpan] = useState<Tf>("15");
  const [livePx, setLivePx] = useState(0);
  const [hover, setHover] = useState<DerivBar | null>(null);
  const [saved, setSaved] = useState(false);
  const [studies, setStudies] = useState<Set<string>>(() => new Set(["sma", "ema20"]));
  const [zone, setZone] = useState<{ low: number; high: number } | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [pool, setPool] = useState(false);
  const [fresh, setFresh] = useState(false);
  const chartRef = useRef<ChartHandle>(null);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    setState("ask");
    setLevels([]);
    setLivePx(0);
    setHover(null);
    printBars({ data: { mint, span } })
      .then((rows) => {
        if (!live) return;
        setBars(rows);
        setPool(rows.filter((row) => (row.volume || 0) > 0).length >= 21);
        setState(rows.length > 1 ? "ready" : "empty");
        setSaved(false);
        if (rows.length > 1) saveBars(mint, span, rows);
      })
      .catch(() => {
        if (!live) return;
        const cached = readBars(mint, span);
        if (cached.length > 1) {
          setBars(cached);
          setPool(cached.filter((row) => (row.volume || 0) > 0).length >= 21);
          setState("ready");
          setSaved(true);
        } else {
          setState("empty");
        }
      });
    return () => {
      live = false;
    };
  }, [mint, span]);

  useEffect(() => {
    if (!mint) return;
    let on = true;
    const bucket = TF_SEC[span];
    const pull = () => {
      void fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { headers: { accept: "application/json" } })
        .then((res) => res.json())
        .then((body: Record<string, { usdPrice?: number }>) => {
          if (!on) return;
          const price = Number(body?.[mint]?.usdPrice) || 0;
          if (!(price > 0)) return;
          setLivePx(price);
          setFresh(true);
          const t = Math.floor(Date.now() / 1000 / bucket) * bucket;
          setBars((cur) => {
            if (!cur.length) return [{ time: t, open: price, high: price, low: price, close: price }];
            const last = cur[cur.length - 1];
            if (t > last.time) return [...cur.slice(-200), { time: t, open: last.close, high: price, low: price, close: price }];
            return [...cur.slice(0, -1), { ...last, close: price, high: Math.max(last.high, price), low: Math.min(last.low, price) }];
          });
          setState("ready");
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 4_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [mint, span]);

  useEffect(() => {
    if (!mint) return;
    let on = true;
    const bucket = TF_SEC[span];
    const refresh = () => {
      printBars({ data: { mint, span } })
        .then((rows) => {
          if (!on || rows.length < 2) return;
          setBars((cur) => {
            const price = cur.length ? cur[cur.length - 1].close : 0;
            return price > 0 ? paintLive(rows, price, bucket) : rows;
          });
          setState("ready");
          setFresh(true);
        })
        .catch(() => undefined);
    };
    const id = window.setInterval(refresh, 45_000);
    return () => {
      on = false;
      window.clearInterval(id);
    };
  }, [mint, span]);

  const last = bars.length ? bars[bars.length - 1].close : 0;
  const tape = readTape(bars);
  useEffect(() => {
    if (tape) saveTape(symbol, tape);
  }, [symbol, bars]);
  const matrixBars = useMemo(
    () => bars.map((row) => ({ t: row.time, o: row.open, h: row.high, l: row.low, c: row.close, v: row.volume && row.volume > 0 ? row.volume : 0 })),
    [bars],
  );
  const overlays = useMemo(
    () => (["sma", "ema20", "ema50", "bbUp", "bbMid", "bbDown"] as const)
      .filter((id) => studies.has(id === "bbUp" || id === "bbDown" || id === "bbMid" ? "bb" : id))
      .map((id) => ({
        id,
        color: id === "sma" ? "#f7d060" : id === "ema20" ? "#7eb6ff" : id === "ema50" ? "#c58bff" : id === "bbUp" || id === "bbDown" ? "#787b86" : "#d1d4dc",
        points: lineOf(bars, id),
      })),
    [bars, studies],
  );
  const precision = last >= 1000 ? 2 : last >= 20 ? 3 : 5;
  const step = last > 0 ? last * 0.002 : 0;
  const shown = hover ?? (bars.length ? bars[bars.length - 1] : null);
  const up = shown ? shown.close >= shown.open : true;
  const first = bars[0]?.open ?? 0;
  const move = first > 0 && last > 0 ? ((last - first) / first) * 100 : null;

  return (
    <div className="overflow-hidden border border-[#2a2e39] bg-[#131722]">
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[#2a2e39] px-1">
        {TF.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSpan(id)}
            className={`h-9 shrink-0 border-b-2 px-2.5 text-[13px] ${span === id ? "border-[#d1d4dc] text-[#d1d4dc]" : "border-transparent text-[#787b86]"}`}
          >
            {TF_LABEL[id]}
          </button>
        ))}
        <span className="ml-auto flex shrink-0 items-center pr-1">
          <button type="button" disabled={!(last > 0)} onClick={() => setLevels((cur) => [...cur, last])} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Line</button>
          <button type="button" disabled={levels.length === 0} onClick={() => setLevels((cur) => cur.slice(0, -1))} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Undo</button>
          <button type="button" disabled={!(last > 0)} onClick={() => setZone(last > 0 ? { low: last * 0.996, high: last * 1.004 } : null)} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Zone</button>
          <button type="button" disabled={!zone} onClick={() => setZone(null)} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Clear</button>
          <button type="button" onClick={() => setShot(chartRef.current?.png() ?? null)} className="h-9 px-2 text-[12px] text-[#d1d4dc]">Print</button>
          <button type="button" onClick={() => setScreen(true)} className="h-9 px-2 text-[12px] text-[#d1d4dc]">Expand</button>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#2a2e39] px-2 py-1">
        {(
          [
            ["sma", "SMA 20"],
            ["ema20", "EMA 20"],
            ["ema50", "EMA 50"],
            ["bb", "Bollinger"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStudies((cur) => {
              const next = new Set(cur);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })}
            className={`h-7 shrink-0 rounded-full px-2.5 text-[11px] ${studies.has(id) ? "bg-[#d1d4dc] text-[#131722]" : "text-[#787b86]"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tape ? (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-1 font-mono text-[11px] text-[#b2b5be]">
          <span>RSI {tape.rsi == null ? "—" : tape.rsi.toFixed(1)}</span>
          <span>MACD {tape.hist == null ? "—" : tape.hist.toFixed(4)}</span>
          <span>ATR {tape.atr == null ? "—" : px(tape.atr)}</span>
          <span className={tape.bias === "short" ? "text-[#f23645]" : tape.bias === "long" ? "text-[#089981]" : "text-[#787b86]"}>{tape.bias}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 pb-1 pt-2 text-[12px]">
        <span className="text-[15px] font-semibold tracking-tight text-[#d1d4dc]">{symbol}</span>
        {fresh && livePx > 0 ? <span className="text-[11px] text-[#089981]">Live</span> : null}
        {saved ? <span className="text-[11px] text-[#787b86]">Saved chart</span> : null}
        <span className="font-mono text-[18px] tabular-nums text-[#d1d4dc]">{px(last || livePx)}</span>
        {move != null ? (
          <span className={`font-mono tabular-nums ${move < 0 ? "text-[#f23645]" : "text-[#089981]"}`}>
            {move >= 0 ? "+" : ""}{move.toFixed(2)}%
          </span>
        ) : null}
        <span className="text-[#787b86]">O <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.open) : "—"}</span></span>
        <span className="text-[#787b86]">H <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.high) : "—"}</span></span>
        <span className="text-[#787b86]">L <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.low) : "—"}</span></span>
        <span className="text-[#787b86]">C <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.close) : "—"}</span></span>
      </div>
      {zone ? (
        <div className="flex items-center gap-2 px-3 pb-1 font-mono text-[11px] text-[#089981]">
          <span>Zone {px(zone.low)} – {px(zone.high)}</span>
          <button type="button" onClick={() => setZone({ low: zone.low * 1.002, high: zone.high * 1.002 })} className="px-1 text-[#d1d4dc]">Up</button>
          <button type="button" onClick={() => setZone({ low: zone.low * 0.998, high: zone.high * 0.998 })} className="px-1 text-[#d1d4dc]">Down</button>
        </div>
      ) : null}
      {levels.length > 0 ? (
        <div className="flex gap-1 overflow-x-auto px-3 pb-1">
          {levels.map((price, i) => (
            <span key={`${price}:${i}`} className="inline-flex items-center gap-1 bg-[#1e222d] px-2 py-0.5 font-mono text-[11px] text-[#d1d4dc]">
              {px(price)}
              <button type="button" onClick={() => setLevels((cur) => cur.map((n, j) => (j === i ? n + step : n)))} className="px-1 text-[#787b86]">+</button>
              <button type="button" onClick={() => setLevels((cur) => cur.map((n, j) => (j === i ? Math.max(step, n - step) : n)))} className="px-1 text-[#787b86]">−</button>
            </span>
          ))}
        </div>
      ) : null}
      {state === "ready" ? (
        <div className="relative">
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[42px] font-semibold tracking-[0.18em] text-white/[0.045]">{symbol}</span>
          <CandleChart ref={chartRef} bars={bars} precision={precision} levels={levels} band={zone} overlays={overlays} className={className} onHover={setHover} />
        </div>
      ) : (
        <div className={`flex items-center justify-center text-sm text-[#787b86] ${className}`}>
          {state === "ask" ? "Loading" : "No pool candles yet."}
        </div>
      )}
      {state === "ready" ? <MarketMatrix bars={matrixBars} pool={pool} symbol={symbol} /> : null}
      {screen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-[#131722]">
          <div className="flex items-center justify-between gap-3 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <p className="text-sm text-[#d1d4dc]">{symbol} · pool candles{fresh ? " · live" : ""}</p>
            <button type="button" onClick={() => setScreen(false)} className="min-h-10 rounded-full bg-[#d1d4dc] px-4 text-sm font-semibold text-[#131722]">Close</button>
          </div>
          <CandleChart bars={bars} precision={precision} levels={levels} band={zone} overlays={overlays} className="min-h-0 flex-1" />
          <div className="max-h-[40dvh] overflow-y-auto">
            <MarketMatrix bars={matrixBars} pool={pool} symbol={symbol} />
          </div>
          {TV[symbol.toUpperCase()] ? (
            <button type="button" onClick={() => setShot("tv")} className="mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] min-h-10 text-left text-xs text-[#787b86]">
              Binance {symbol.toUpperCase()} is a different book. Open it only if you mean that market.
            </button>
          ) : null}
        </div>
      ) : null}
      {shot && shot !== "tv" ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/80 px-4 pt-[max(1rem,env(safe-area-inset-top))]" onClick={() => setShot(null)}>
          <p className="pb-2 text-sm text-white">Long-press the chart to save it.</p>
          <img src={shot} alt={`${symbol} chart`} className="max-h-[80dvh] w-full object-contain" />
        </div>
      ) : null}
      {shot === "tv" && TV[symbol.toUpperCase()] ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#131722]">
          <div className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <p className="text-sm text-[#d1d4dc]">Binance · {symbol}</p>
            <button type="button" onClick={() => setShot(null)} className="min-h-10 rounded-full bg-[#d1d4dc] px-4 text-sm font-semibold text-[#131722]">Close</button>
          </div>
          <iframe title={`${symbol} on Binance`} src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(TV[symbol.toUpperCase()])}&interval=${span === "1D" ? "D" : span}&hidetoptoolbar=0&theme=dark&style=1&locale=en`} className="min-h-0 w-full flex-1 border-0" />
        </div>
      ) : null}
    </div>
  );
}
