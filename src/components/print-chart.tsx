import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { CandleChart, type ChartHandle } from "@/components/candle-chart";
import { MarketMatrix } from "@/components/market-matrix";
import { lineOf, readTape, saveTape } from "@/lib/indicators";
import { printBook } from "@/lib/print-bars";
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

const TF = ["1", "3", "5", "15", "30", "60", "120", "240", "480", "720"] as const;
type Tf = (typeof TF)[number];
const TF_LABEL: Record<Tf, string> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "480": "8h",
  "720": "12h",
};
const TF_SEC: Record<Tf, number> = {
  "1": 60,
  "3": 180,
  "5": 300,
  "15": 900,
  "30": 1800,
  "60": 3600,
  "120": 7200,
  "240": 14400,
  "480": 28800,
  "720": 43200,
};
const CHARTS = "senda.chart.v1";
const DRAW = "senda.draw.v1";
type Pt = { time: number; price: number };
type Plot =
  | { id: string; tool: "level" | "horizontal"; price: number }
  | { id: string; tool: "vertical"; time: number }
  | { id: string; tool: "hray" | "cross" | "text"; time: number; price: number; label?: string }
  | { id: string; tool: "trend" | "ray" | "extended" | "arrow" | "channel" | "rect" | "fib" | "fibext" | "measure"; a: Pt; b: Pt };
const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_EXT = [0, 0.618, 1, 1.272, 1.618, 2.618];
const DRAW_TOOLS = [
  ["horizontal", "Horizontal"],
  ["hray", "Horizontal ray"],
  ["vertical", "Vertical"],
  ["cross", "Cross"],
  ["trend", "Trend"],
  ["ray", "Ray"],
  ["extended", "Extended"],
  ["arrow", "Arrow"],
  ["channel", "Channel"],
  ["rect", "Rectangle"],
  ["text", "Text"],
  ["fib", "Fib"],
  ["fibext", "Fib extension"],
  ["measure", "Measure"],
] as const;
type DrawTool = "" | (typeof DRAW_TOOLS)[number][0];

function readPlots(mint: string): Plot[] {
  if (typeof window === "undefined") return [];
  try {
    const bag = JSON.parse(window.localStorage.getItem(DRAW) || "{}") as Record<string, Plot[]>;
    return Array.isArray(bag[mint]) ? bag[mint] : [];
  } catch {
    return [];
  }
}

function savePlots(mint: string, plots: Plot[]) {
  if (typeof window === "undefined") return;
  try {
    const bag = JSON.parse(window.localStorage.getItem(DRAW) || "{}") as Record<string, Plot[]>;
    bag[mint] = plots.slice(-24);
    window.localStorage.setItem(DRAW, JSON.stringify(bag));
  } catch {
    /* quota */
  }
}

function nudge(plot: Plot, dPrice: number, dTime: number): Plot {
  if (plot.tool === "level" || plot.tool === "horizontal") return { ...plot, price: plot.price + dPrice };
  if (plot.tool === "vertical") return { ...plot, time: plot.time + dTime };
  if (plot.tool === "hray" || plot.tool === "cross" || plot.tool === "text") {
    return { ...plot, price: plot.price + dPrice, time: plot.time + dTime };
  }
  if (!("a" in plot) || !("b" in plot)) return plot;
  return {
    ...plot,
    a: { time: plot.a.time + dTime, price: plot.a.price + dPrice },
    b: { time: plot.b.time + dTime, price: plot.b.price + dPrice },
  };
}

function reach(a: { x: number; y: number }, b: { x: number; y: number }, w: number, h: number, mode: "ray" | "extended") {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (!dx && !dy) return { start: a, end: b };
  const marks: number[] = [];
  if (dx) marks.push(-a.x / dx, (w - a.x) / dx);
  if (dy) marks.push(-a.y / dy, (h - a.y) / dy);
  const inside = (t: number) => {
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    return x >= -2 && x <= w + 2 && y >= -2 && y <= h + 2;
  };
  const ok = marks.filter(inside);
  const forward = ok.filter((t) => t >= 1).sort((p, q) => p - q)[0] ?? 1;
  const back = ok.filter((t) => t <= 0).sort((p, q) => q - p)[0] ?? 0;
  return {
    start: mode === "extended" ? { x: a.x + back * dx, y: a.y + back * dy } : a,
    end: { x: a.x + forward * dx, y: a.y + forward * dy },
  };
}

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
  const [tool, setTool] = useState<DrawTool>("");
  const [menu, setMenu] = useState(false);
  const [menuAt, setMenuAt] = useState<{ left: number; top: number } | null>(null);
  const [hold, setHold] = useState<{ id: string; base: Plot; price: number; time: number } | null>(null);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [draft, setDraft] = useState<Pt | null>(null);
  const [frame, setFrame] = useState(0);
  const [kind, setKind] = useState<"candles" | "line" | "volume">("candles");
  const [feed, setFeed] = useState<"gecko-pool" | "jup-chart" | "none">("none");
  const [fresh, setFresh] = useState(false);
  const chartRef = useRef<ChartHandle>(null);
  const skin = useRef<HTMLDivElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setPlots(readPlots(mint));
    setDraft(null);
    setTool("");
  }, [mint]);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    setState("ask");
    setLevels([]);
    setLivePx(0);
    setHover(null);
    printBook({ data: { mint, span } })
      .then((loaded) => {
        if (!live) return;
        const rows = loaded.bars;
        setBars(rows);
        setFeed(loaded.source);
        setState(rows.length > 1 ? "ready" : "empty");
        setSaved(false);
        if (rows.length > 1) saveBars(mint, span, rows);
      })
      .catch(() => {
        if (!live) return;
        const cached = readBars(mint, span);
        if (cached.length > 1) {
          setBars(cached);
          setFeed(cached.filter((row) => (row.volume || 0) > 0).length >= 8 ? "jup-chart" : "none");
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
    const id = window.setInterval(pull, 1_000);
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
      printBook({ data: { mint, span } })
        .then((loaded) => {
          if (!on || loaded.bars.length < 2) return;
          setFeed(loaded.source);
          setBars((cur) => {
            const price = cur.length ? cur[cur.length - 1].close : 0;
            return price > 0 ? paintLive(loaded.bars, price, bucket) : loaded.bars;
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
  const dayOpen = useMemo(() => {
    const start = Math.floor(Date.now() / 86_400) * 86_400;
    return bars.find((bar) => bar.time >= start)?.open || 0;
  }, [bars]);

  function keep(next: Plot[]) {
    setPlots(next);
    savePlots(mint, next);
  }

  useEffect(() => {
    if (!hold) return;
    const start = hold;
    function move(event: PointerEvent) {
      const rect = skin.current?.getBoundingClientRect();
      if (!rect) return;
      const at = chartRef.current?.read(event.clientX - rect.left, event.clientY - rect.top);
      if (!at || !(at.price > 0)) return;
      const next = nudge(start.base, at.price - start.price, at.time - start.time);
      setPlots((cur) => cur.map((plot) => (plot.id === start.id ? next : plot)));
    }
    function up() {
      setPlots((cur) => {
        savePlots(mint, cur);
        return cur;
      });
      setHold(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [hold, mint]);

  function grab(id: string, event: ReactPointerEvent) {
    if (tool) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = skin.current?.getBoundingClientRect();
    const base = plots.find((plot) => plot.id === id);
    if (!rect || !base) return;
    const at = chartRef.current?.read(event.clientX - rect.left, event.clientY - rect.top);
    if (!at || !(at.price > 0)) return;
    setHold({ id, base, price: at.price, time: at.time });
  }

  function drop(event: MouseEvent<HTMLDivElement>) {
    if (!tool) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const hit = chartRef.current?.read(event.clientX - rect.left, event.clientY - rect.top);
    if (!hit || !(hit.price > 0)) return;
    const id = crypto.randomUUID();
    if (tool === "horizontal") {
      keep([...plots, { id, tool: "horizontal", price: hit.price }]);
      setTool("");
      return;
    }
    if (tool === "vertical") {
      keep([...plots, { id, tool: "vertical", time: hit.time }]);
      setTool("");
      return;
    }
    if (tool === "hray" || tool === "cross" || tool === "text") {
      keep([...plots, { id, tool, time: hit.time, price: hit.price, label: tool === "text" ? "Note" : undefined }]);
      setTool("");
      return;
    }
    if (!draft) {
      setDraft(hit);
      return;
    }
    keep([...plots, { id: crypto.randomUUID(), tool, a: draft, b: hit }]);
    setDraft(null);
    setTool("");
  }

  return (
    <div className="border border-[#1a1c24] bg-[#050508]">
      <div className="flex flex-col gap-2 border-b border-[#1a1c24] px-2 py-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[12px] text-[#787b86]">Chart</span>
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "binance") {
                setShot(TV[symbol.toUpperCase()] ? "tv" : "no-book");
                return;
              }
              setKind(next as "candles" | "line" | "volume");
              if (shot === "no-book") setShot(null);
            }}
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#2a2e39] bg-[#131722] px-2 text-[14px] text-[#d1d4dc]"
          >
            <option value="candles">Senda candles — we draw the pool</option>
            <option value="line">Senda line — the same pool</option>
            <option value="volume">Senda volume — the same pool</option>
            <option value="binance">{TV[symbol.toUpperCase()] ? "Binance — their book, not ours" : "Binance — not listed for this name"}</option>
          </select>
        </label>
        <p className="text-[12px] leading-snug text-[#787b86] sm:max-w-[220px]">
          {feed === "gecko-pool" ? "Bars are the pool’s own trades." : feed === "jup-chart" ? "Jupiter’s price. This feed has no volume." : "Waiting on a print."}
        </p>
      </div>
      <div className="flex items-center gap-0.5 overflow-x-auto border-b border-[#1a1c24] px-1">
        <span className="mx-1 h-4 w-px shrink-0 bg-[#1a1c24]" />
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
          <button type="button" disabled={!(last > 0)} onClick={() => setLevels((cur) => [...cur, last])} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Level</button>
          <button type="button" disabled={levels.length === 0} onClick={() => setLevels((cur) => cur.slice(0, -1))} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Undo</button>
          <button type="button" disabled={!(last > 0)} onClick={() => setZone(last > 0 ? { low: last * 0.996, high: last * 1.004 } : null)} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Zone</button>
          <button type="button" disabled={!zone} onClick={() => setZone(null)} className="h-9 px-2 text-[12px] text-[#787b86] disabled:opacity-40">Clear</button>
          <button type="button" onClick={() => setShot(chartRef.current?.png() ?? null)} className="h-9 px-2 text-[12px] text-[#d1d4dc]">Print</button>
          <button type="button" onClick={() => setScreen(true)} className="h-9 px-2 text-[12px] font-semibold text-[#c6f56a]">Big view</button>
        </span>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-[#1a1c24] px-2 py-1">
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
            onClick={() => {
              setStudies((cur) => {
                const next = new Set(cur);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            className={`h-7 shrink-0 rounded-full px-2.5 text-[11px] ${studies.has(id) ? "bg-[#d1d4dc] text-[#131722]" : "text-[#787b86]"}`}
          >
            {label}
          </button>
        ))}
        <div className="relative shrink-0">
          <button
            ref={menuBtn}
            type="button"
            onClick={() => {
              const rect = menuBtn.current?.getBoundingClientRect();
              setMenuAt(rect ? { left: rect.left, top: rect.bottom + 6 } : null);
              setMenu((open) => !open);
            }}
            className={`h-7 rounded-full px-2.5 text-[11px] ${DRAW_TOOLS.some(([id]) => id === tool) ? "bg-[#d1d4dc] text-[#131722]" : "text-[#787b86]"}`}
          >
            {DRAW_TOOLS.find(([id]) => id === tool)?.[1] || "Draw"}
          </button>
          {menu && menuAt && typeof document !== "undefined"
            ? createPortal(
                <div className="fixed z-[120] max-h-[70dvh] w-[220px] overflow-y-auto rounded-lg border border-[#1a1c24] bg-[#050508] py-1 shadow-2xl" style={{ left: Math.min(menuAt.left, window.innerWidth - 232), top: menuAt.top }}>
                  {DRAW_TOOLS.map(([id, label]) => (
                    <button key={id} type="button" onClick={() => { setTool(id); setDraft(null); setMenu(false); }} className="block w-full px-3 py-1.5 text-left text-[12px] text-[#d1d4dc] hover:bg-white/10">
                      {label}
                    </button>
                  ))}
                  <p className="px-3 py-1.5 text-[10px] leading-snug text-[#787b86]">Drag a drawing to move it. Pitchfork, Elliott, and Gann are not on this chart.</p>
                </div>,
                document.body,
              )
            : null}
        </div>
        <button type="button" disabled={!plots.length} onClick={() => keep(plots.slice(0, -1))} className="h-7 shrink-0 px-2 text-[11px] text-[#787b86] disabled:opacity-40">Undo</button>
        <button type="button" disabled={!plots.length} onClick={() => keep([])} className="h-7 shrink-0 px-2 text-[11px] text-[#787b86] disabled:opacity-40">Clear</button>
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
        <span className="font-mono text-[18px] tabular-nums text-[#d1d4dc]">{px(livePx || last)}</span>
        {move != null ? (
          <span className={`font-mono tabular-nums ${move < 0 ? "text-[#f23645]" : "text-[#089981]"}`}>
            {move >= 0 ? "+" : ""}{move.toFixed(2)}%
          </span>
        ) : null}
        <span className="text-[#787b86]">O <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.open) : "—"}</span></span>
        <span className="text-[#787b86]">H <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.high) : "—"}</span></span>
        <span className="text-[#787b86]">L <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.low) : "—"}</span></span>
        <span className="text-[#787b86]">C <span className={up ? "text-[#089981]" : "text-[#f23645]"}>{shown ? px(shown.close) : "—"}</span></span>
        <span className="text-[#787b86]">V <span className="text-[#d1d4dc]">{shown?.volume && shown.volume > 0 ? shown.volume.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "—"}</span></span>
      </div>
      <p className="px-3 pb-1 text-[11px] text-[#787b86]">
        {livePx > 0 ? `${symbol} is ${px(livePx)} right now. ` : ""}
        {feed === "gecko-pool" ? "Volume is the Solana pool. " : feed === "jup-chart" ? "Volume is Jupiter’s chart. " : ""}
        The line is {TF_LABEL[span]} bars. The price above them is the live mark.
      </p>
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
            <span key={`${price}:${i}`} className="inline-flex items-center gap-1 bg-[#0c0c10] px-2 py-0.5 font-mono text-[11px] text-[#d1d4dc]">
              {px(price)}
              <button type="button" onClick={() => setLevels((cur) => cur.map((n, j) => (j === i ? n + step : n)))} className="px-1 text-[#787b86]">+</button>
              <button type="button" onClick={() => setLevels((cur) => cur.map((n, j) => (j === i ? Math.max(step, n - step) : n)))} className="px-1 text-[#787b86]">−</button>
            </span>
          ))}
        </div>
      ) : null}
      {state === "ready" ? (
        <div className="relative" ref={skin}>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[42px] font-semibold tracking-[0.18em] text-white/[0.045]">{symbol}</span>
          <CandleChart ref={chartRef} bars={bars} precision={precision} levels={levels} band={zone} overlays={overlays} kind={kind} dayOpen={dayOpen} onFrame={() => setFrame((n) => n + 1)} className={className} onHover={setHover} />
          <svg className="absolute inset-0 h-full w-full" style={{ pointerEvents: "none" }} data-frame={frame}>
            {plots.map((plot) => {
              const w = skin.current?.clientWidth || 320;
              const h = skin.current?.clientHeight || 240;
              if (plot.tool === "level" || plot.tool === "horizontal") {
                const y = chartRef.current?.locate(bars.at(-1)?.time || 0, plot.price)?.y;
                if (y == null) return null;
                return (
                  <g key={plot.id}>
                    <line x1="0" x2={w} y1={y} y2={y} stroke="#2962ff" strokeDasharray="4 3" />
                    <line x1="0" x2={w} y1={y} y2={y} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)} />
                    <text x={w - 4} y={y - 4} fill="#2962ff" fontSize="10" textAnchor="end">{px(plot.price)}</text>
                  </g>
                );
              }
              if (plot.tool === "vertical") {
                const x = chartRef.current?.locate(plot.time, livePx || last || 1)?.x;
                if (x == null) return null;
                return (
                  <g key={plot.id}>
                    <line x1={x} x2={x} y1="0" y2={h} stroke="#2962ff" strokeDasharray="4 3" />
                    <line x1={x} x2={x} y1="0" y2={h} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)} />
                  </g>
                );
              }
              if (plot.tool === "text") {
                const at = chartRef.current?.locate(plot.time, plot.price);
                if (!at) return null;
                return (
                  <text key={plot.id} x={at.x + 6} y={at.y - 6} fill="#d1d4dc" fontSize="12" style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)}>
                    {plot.label || "Note"}
                  </text>
                );
              }
              if (plot.tool === "hray" || plot.tool === "cross") {
                const at = chartRef.current?.locate(plot.time, plot.price);
                if (!at) return null;
                return (
                  <g key={plot.id} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)}>
                    <line x1={at.x} x2={w} y1={at.y} y2={at.y} stroke="#2962ff" />
                    {plot.tool === "cross" ? <line x1={at.x} x2={at.x} y1="0" y2={h} stroke="#2962ff" /> : null}
                  </g>
                );
              }
              if (plot.tool === "fib" || plot.tool === "fibext") {
                const ratios = plot.tool === "fib" ? FIB : FIB_EXT;
                return (
                  <g key={plot.id} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)}>
                    {ratios.map((ratio) => {
                      const price = plot.a.price + (plot.b.price - plot.a.price) * ratio;
                      const y = chartRef.current?.locate(plot.a.time, price)?.y;
                      if (y == null) return null;
                      return <line key={`${plot.id}-${ratio}`} x1="0" x2={w} y1={y} y2={y} stroke="#c58bff" strokeDasharray="3 3" />;
                    })}
                  </g>
                );
              }
              if (!("a" in plot) || !("b" in plot)) return null;
              const a = chartRef.current?.locate(plot.a.time, plot.a.price);
              const b = chartRef.current?.locate(plot.b.time, plot.b.price);
              if (!a || !b) return null;
              if (plot.tool === "ray" || plot.tool === "extended") {
                const line = reach(a, b, w, h, plot.tool);
                return (
                  <g key={plot.id}>
                    <line x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} stroke="#d1d4dc" />
                    <line x1={line.start.x} y1={line.start.y} x2={line.end.x} y2={line.end.y} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)} />
                  </g>
                );
              }
              if (plot.tool === "rect") {
                return <rect key={plot.id} x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill="rgba(41,98,255,0.12)" stroke="#2962ff" style={{ pointerEvents: "all", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)} />;
              }
              if (plot.tool === "channel") {
                const gap = Math.abs(plot.b.price - plot.a.price) * 0.35 || plot.a.price * 0.004;
                const a2 = chartRef.current?.locate(plot.a.time, plot.a.price + gap);
                const b2 = chartRef.current?.locate(plot.b.time, plot.b.price + gap);
                return (
                  <g key={plot.id} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d1d4dc" />
                    {a2 && b2 ? <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} stroke="#d1d4dc" /> : null}
                  </g>
                );
              }
              if (plot.tool === "arrow") {
                const angle = Math.atan2(b.y - a.y, b.x - a.x);
                const tip = 8;
                return (
                  <g key={plot.id} style={{ pointerEvents: "auto", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#d1d4dc" />
                    <polygon points={`${b.x},${b.y} ${b.x - tip * Math.cos(angle - 0.5)},${b.y - tip * Math.sin(angle - 0.5)} ${b.x - tip * Math.cos(angle + 0.5)},${b.y - tip * Math.sin(angle + 0.5)}`} fill="#d1d4dc" />
                  </g>
                );
              }
              const rising = plot.b.price >= plot.a.price;
              const color = plot.tool === "measure" ? (rising ? "#089981" : "#f23645") : "#d1d4dc";
              return (
                <g key={plot.id}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} />
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} style={{ pointerEvents: "stroke", cursor: "grab" }} onPointerDown={(event) => grab(plot.id, event)} />
                </g>
              );
            })}
          </svg>
          {tool ? <div className="absolute inset-0 cursor-crosshair" onClick={drop} /> : null}
        </div>
      ) : (
        <div className={`flex items-center justify-center text-sm text-[#787b86] ${className}`}>
          {state === "ask" ? "Loading" : "No pool candles yet."}
        </div>
      )}
      {state === "ready" ? <MarketMatrix bars={matrixBars} pool={feed !== "none"} source={feed === "none" ? "price-only" : feed} symbol={symbol} /> : null}
      {screen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black">
          <div className="flex items-center gap-1 overflow-x-auto px-2 pt-[max(0.35rem,env(safe-area-inset-top))]">
            {TF.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSpan(id)}
                className={`h-9 shrink-0 rounded-full px-2.5 text-[13px] ${span === id ? "bg-white/15 font-semibold text-white" : "text-white/45"}`}
              >
                {TF_LABEL[id]}
              </button>
            ))}
            <button type="button" onClick={() => setScreen(false)} aria-label="Close chart" className="ml-auto grid size-9 shrink-0 place-items-center text-lg text-white/70">
              ×
            </button>
          </div>
          <CandleChart bars={bars} precision={precision} kind="candles" vivid className="min-h-0 flex-1" />
        </div>
      ) : null}
      {shot && shot !== "tv" && shot !== "no-book" ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-black/80 px-4 pt-[max(1rem,env(safe-area-inset-top))]" onClick={() => setShot(null)}>
          <p className="pb-2 text-sm text-white">Long-press the chart to save it.</p>
          <img src={shot} alt={`${symbol} chart`} className="max-h-[80dvh] w-full object-contain" />
        </div>
      ) : null}
      {shot === "no-book" ? (
        <p className="border-b border-[#1a1c24] px-3 py-2 text-[12px] text-[#787b86]">{symbol} has no Binance book here. The desk chart stays the pool.</p>
      ) : null}
      {shot === "tv" && TV[symbol.toUpperCase()] ? (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#050508]">
          <div className="flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <p className="text-sm text-[#d1d4dc]">Binance · {symbol}. This is not the pool.</p>
            <button type="button" onClick={() => setShot(null)} className="min-h-10 rounded-full bg-[#d1d4dc] px-4 text-sm font-semibold text-[#131722]">Close</button>
          </div>
          <iframe title={`${symbol} on Binance`} src={`https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(TV[symbol.toUpperCase()])}&interval=${span}&hidetoptoolbar=0&theme=dark&style=1&locale=en`} className="min-h-0 w-full flex-1 border-0" />
        </div>
      ) : null}
    </div>
  );
}
