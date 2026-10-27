import { useMemo, useState } from "react";
import { formatChg, formatUsd } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const WINDOWS = ["24H", "7D", "30D", "ALL"] as const;

function seed(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Endpoints are the 24h open and the last print. The bends are only so the line is readable. */
function pathOf(symbol: string, last: number, change: number) {
  const n = 32;
  const open = change === -1 ? last : last / (1 + change);
  const pts: number[] = [];
  const s = seed(symbol);
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const wave = Math.sin(t * Math.PI * (2 + (s % 3))) * (0.12 + ((s >> 3) % 5) / 40);
    const mid = open + (last - open) * t;
    const wobble = (last - open) * wave * Math.sin(t * Math.PI);
    pts.push(i === n - 1 ? last : mid + wobble);
  }
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const span = hi - lo || Math.abs(last) * 0.02 || 1;
  const pad = span * 0.18;
  const top = hi + pad;
  const bot = lo - pad;
  const h = top - bot;
  const xy = pts.map((y, i) => {
    const x = (i / (n - 1)) * 100;
    const yy = ((top - y) / h) * 100;
    return [x, yy] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
  const area = `${line} L100 100 L0 100 Z`;
  return { line, area };
}

export function MarkChart({
  symbol,
  last,
  change,
  valueLabel,
}: {
  symbol: string;
  last: number;
  change: number | null;
  valueLabel?: string;
}) {
  const [win, setWin] = useState<(typeof WINDOWS)[number]>("24H");
  const chg = change ?? 0;
  const move = chg === -1 ? 0 : (last * chg) / (1 + chg);
  const up = chg >= 0;
  const drawn = useMemo(() => pathOf(symbol || "BOOK", last || 1, chg), [symbol, last, chg]);
  const live = win === "24H";

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-subtle uppercase">{symbol || "Book"}</p>
          <p className="mt-1 font-mono text-4xl tracking-tight tabular-nums lg:text-5xl">{valueLabel ?? formatUsd(last)}</p>
          <p className={cn("mt-1 font-mono text-sm tabular-nums", up ? "text-up" : "text-down")}>
            {formatChg(change)}
            <span className="ml-2">
              {move === 0 ? "" : `${move > 0 ? "+" : "−"}$${Math.abs(move).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
            </span>
            <span className="ml-2 text-subtle">24h</span>
          </p>
        </div>
        <div className="flex gap-1 rounded-full bg-black/40 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWin(w)}
              className={cn(
                "min-h-8 rounded-full px-3 font-mono text-[11px]",
                win === w ? "bg-white text-black" : "text-subtle",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-40 lg:h-52">
        {live ? (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" aria-hidden>
            <defs>
              <linearGradient id={`fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? "#d6ff4a" : "#ff5d73"} stopOpacity="0.28" />
                <stop offset="100%" stopColor={up ? "#d6ff4a" : "#ff5d73"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={drawn.area} fill={`url(#fill-${symbol})`} />
            <path d={drawn.line} fill="none" stroke={up ? "#d6ff4a" : "#ff5d73"} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
        ) : (
          <p className="grid h-full place-items-center text-center text-sm text-muted">
            This feed has a last and a 24h change. It does not publish {win}.
          </p>
        )}
      </div>
      <p className="mt-1 text-[11px] text-subtle">The ends of the line are the 24h open and the last print. Not a candle history.</p>
    </section>
  );
}

export function MiniSpark({ symbol, last, change }: { symbol: string; last: number; change: number | null }) {
  const drawn = useMemo(() => pathOf(symbol, last || 1, change ?? 0), [symbol, last, change]);
  const up = (change ?? 0) >= 0;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-16 shrink-0" aria-hidden>
      <path d={drawn.line} fill="none" stroke={up ? "#d6ff4a" : "#ff5d73"} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
