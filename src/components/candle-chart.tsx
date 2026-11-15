import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  ColorType,
  CrosshairMode,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import type { DerivBar } from "@/lib/deriv-book";

const UP = "#089981";
const DOWN = "#f23645";

export type ChartLine = { id: string; color: string; points: { time: number; value: number }[] };

export type ChartHandle = {
  png: () => string | null;
  locate: (time: number, price: number) => { x: number; y: number } | null;
  read: (x: number, y: number) => { time: number; price: number } | null;
};

/** Candles in the TradingView dark palette. The bars are the pool. The colors are not a feed. */
export const CandleChart = forwardRef<ChartHandle, {
  bars: DerivBar[];
  precision: number;
  levels?: number[];
  band?: { low: number; high: number } | null;
  overlays?: ChartLine[];
  kind?: "candles" | "line" | "volume";
  vivid?: boolean;
  dayOpen?: number;
  /** Fit the window once per mint and timeframe. Later ticks keep the zoom. */
  fitKey?: string;
  onFrame?: () => void;
  className?: string;
  onHover?: (bar: DerivBar | null) => void;
}>(function CandleChart({
  bars,
  precision,
  levels = [],
  band = null,
  overlays = [],
  kind = "candles",
  vivid = false,
  dayOpen = 0,
  fitKey = "",
  onFrame,
  className = "h-[560px]",
  onHover,
}, ref) {
  const box = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const series = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Histogram"> | null>(null);
  const volume = useRef<ISeriesApi<"Histogram"> | null>(null);
  const lines = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>([]);
  const studies = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const fitted = useRef("");
  const holdRange = useRef<{ from: number; to: number } | null>(null);
  const painting = useRef(false);
  const hover = useRef(onHover);
  const seen = useRef("");
  const linesKey = useRef("");
  const barsRef = useRef(bars);
  const frame = useRef(onFrame);
  hover.current = onHover;
  barsRef.current = bars;
  frame.current = onFrame;

  useImperativeHandle(ref, () => ({
    png: () => chart.current?.takeScreenshot().toDataURL("image/png") ?? null,
    locate: (time: number, price: number) => {
      const x = chart.current?.timeScale().timeToCoordinate(time as UTCTimestamp);
      const scale = series.current as { priceToCoordinate?: (n: number) => number | null } | null;
      const y = scale?.priceToCoordinate?.(price);
      if (x == null || y == null) return null;
      return { x, y };
    },
    read: (x: number, y: number) => {
      const time = chart.current?.timeScale().coordinateToTime(x);
      const scale = series.current as { coordinateToPrice?: (n: number) => number | null } | null;
      const price = scale?.coordinateToPrice?.(y);
      if (time == null || price == null) return null;
      return { time: Number(time), price };
    },
  }), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const next = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#050508" }, textColor: "#787b86", fontFamily: "Trebuchet MS, Roboto, Ubuntu, sans-serif", fontSize: 12 },
      grid: { vertLines: { color: "#141418" }, horzLines: { color: "#141418" } },
      rightPriceScale: { borderColor: "#1a1c24", textColor: "#b2b5be", minimumWidth: 78 },
      timeScale: { borderColor: "#1a1c24", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8, minBarSpacing: 4, shiftVisibleRangeOnNewBar: false },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#758696", labelBackgroundColor: "#363a45", width: 1, style: LineStyle.Dashed },
        horzLine: { color: "#758696", labelBackgroundColor: "#363a45", width: 1, style: LineStyle.Dashed },
      },
      handleScroll: { vertTouchDrag: false },
    });
    const up = vivid ? "#c6f56a" : UP;
    const down = vivid ? "#ff5d73" : DOWN;
    const price = kind === "volume"
      ? null
      : kind === "line"
        ? next.addLineSeries({ color: "#d1d4dc", lineWidth: 2, priceLineVisible: true, lastValueVisible: true })
        : next.addCandlestickSeries({
            upColor: up,
            downColor: down,
            borderUpColor: up,
            borderDownColor: down,
            wickUpColor: up,
            wickDownColor: down,
            priceLineVisible: true,
            lastValueVisible: true,
            priceLineWidth: 1,
            priceLineStyle: LineStyle.Dashed,
          });
    if (price && kind !== "volume") price.priceScale().applyOptions({ scaleMargins: { top: 0.06, bottom: vivid ? 0.28 : 0.26 } });
    const hist = next.addHistogramSeries({
      priceScaleId: kind === "volume" ? "right" : "volume",
      priceFormat: { type: "volume" },
    });
    if (kind !== "volume") next.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    next.subscribeCrosshairMove((param) => {
      const row = price ? param.seriesData.get(price) : param.seriesData.get(hist);
      const time = row && "time" in row ? Number(row.time) : 0;
      if (!time) {
        hover.current?.(null);
        return;
      }
      const bar = barsRef.current.find((item) => item.time === time);
      hover.current?.(bar ?? null);
    });
    next.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!painting.current && range) holdRange.current = { from: range.from, to: range.to };
      frame.current?.();
    });
    chart.current = next;
    series.current = price ?? hist;
    volume.current = hist;
    fitted.current = "";
    holdRange.current = null;
    seen.current = "";
    linesKey.current = "";
    return () => {
      lines.current = [];
      next.remove();
      chart.current = null;
      series.current = null;
      volume.current = null;
    };
  }, [kind, vivid]);

  useEffect(() => {
    const s = series.current;
    if (!s) return;
    const ordered = [...bars].sort((a, b) => a.time - b.time);
    const data: CandlestickData[] = [];
    const closes: LineData[] = [];
    const vols: HistogramData[] = [];
    let last = -1;
    for (const bar of ordered) {
      if (!(bar.time > last) || !(bar.close > 0)) continue;
      const raw = bar.time > 1e12 ? Math.floor(bar.time / 1000) : bar.time;
      if (!(raw > last)) continue;
      last = raw;
      const time = raw as UTCTimestamp;
      data.push({ time, open: bar.open, high: bar.high, low: bar.low, close: bar.close });
      closes.push({ time, value: bar.close });
      if (bar.volume && bar.volume > 0) {
        vols.push({ time, value: bar.volume, color: bar.close >= bar.open ? (vivid ? "rgba(198,245,106,0.72)" : "rgba(8,153,129,0.55)") : (vivid ? "rgba(255,93,115,0.72)" : "rgba(242,54,69,0.55)") });
      }
    }
    const times = data.map((row) => String(row.time));
    const prev = seen.current ? seen.current.split(",") : [];
    const grown = prev.length > 0 && times.length >= prev.length && prev.every((t, i) => times[i] === t);
    const tip = data[data.length - 1];
    const ts = chart.current?.timeScale();
    const firstLook = Boolean(fitKey) && fitted.current !== fitKey && data.length > 1;
    if (grown && kind === "candles" && tip && !firstLook) {
      (s as ISeriesApi<"Candlestick">).update(tip);
      const vol = vols[vols.length - 1];
      if (vol && vol.time === tip.time) volume.current?.update(vol);
      seen.current = times.join(",");
    } else if (kind === "line") {
      (s as ISeriesApi<"Line">).setData(closes);
      volume.current?.setData(vols);
      seen.current = times.join(",");
    } else if (kind === "volume") {
      (s as ISeriesApi<"Histogram">).setData(vols);
      seen.current = times.join(",");
    } else {
      (s as ISeriesApi<"Candlestick">).setData(data);
      volume.current?.setData(vols);
      seen.current = times.join(",");
    }
    const close = tip;
    if (close && kind === "candles") {
      const rising = close.close >= close.open;
      (s as ISeriesApi<"Candlestick">).applyOptions({ priceLineColor: rising ? (vivid ? "#c6f56a" : UP) : (vivid ? "#ff5d73" : DOWN) });
    }
    if (!(grown && !firstLook) && kind !== "volume") {
      const price = s as ISeriesApi<"Candlestick">;
      const minMove = precision >= 5 ? 0.00001 : precision >= 3 ? 0.001 : 0.01;
      price.applyOptions({ priceFormat: { type: "price", precision, minMove } });
      const nextKey = `${precision}|${levels.join(",")}|${band?.low ?? ""}|${band?.high ?? ""}|${dayOpen}`;
      if (nextKey !== linesKey.current) {
        linesKey.current = nextKey;
        for (const line of lines.current) price.removePriceLine(line);
        lines.current = levels.filter((n) => n > 0).map((n) =>
          price.createPriceLine({ price: n, color: "#2962ff", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "" }),
        );
        if (band && band.high > band.low && band.low > 0) {
          lines.current.push(
            price.createPriceLine({ price: band.high, color: "#089981", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "zone" }),
            price.createPriceLine({ price: band.low, color: "#089981", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "" }),
          );
        }
        if (dayOpen > 0) {
          lines.current.push(price.createPriceLine({ price: dayOpen, color: "#f7d060", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "Day" }));
        }
      }
    }
    const chartApi = chart.current;
    if (chartApi && !grown) {
      const keep = new Set(overlays.map((row) => row.id));
      for (const [id, study] of studies.current) {
        if (!keep.has(id)) {
          chartApi.removeSeries(study);
          studies.current.delete(id);
        }
      }
      for (const row of overlays) {
        let study = studies.current.get(row.id);
        if (!study) {
          study = chartApi.addLineSeries({ color: row.color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
          studies.current.set(row.id, study);
        }
        study.setData(row.points.filter((p) => p.value > 0 && p.time > 1e8).map((p) => ({ time: (p.time > 1e12 ? Math.floor(p.time / 1000) : p.time) as UTCTimestamp, value: p.value })));
      }
    }
    if (!ts || (grown && !firstLook)) return;
    painting.current = true;
    if (firstLook) {
      fitted.current = fitKey;
      ts.setVisibleLogicalRange({ from: Math.max(0, data.length - 90), to: data.length + 6 });
      const now = ts.getVisibleLogicalRange();
      if (now) holdRange.current = { from: now.from, to: now.to };
    } else if (holdRange.current) {
      ts.setVisibleLogicalRange(holdRange.current);
    }
    painting.current = false;
  }, [bars, levels, band, overlays, kind, dayOpen, vivid, precision, fitKey]);

  return <div ref={box} className={`w-full ${className}`} />;
});
