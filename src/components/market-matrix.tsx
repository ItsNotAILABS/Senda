import { useMemo, useState } from "react";
import { evaluateMatrix, normalizeBars, type MatrixBar } from "@/lib/matrix-engine";

const color: Record<string, string> = {
  bull: "text-[#b6f36a] bg-[#b6f36a]/10 border-[#b6f36a]/20",
  bear: "text-[#ff7585] bg-[#ff7585]/10 border-[#ff7585]/20",
  neutral: "text-white/65 bg-white/[0.04] border-white/10",
  caution: "text-amber-300 bg-amber-300/10 border-amber-300/20",
  blocked: "text-white/35 bg-white/[0.025] border-white/5",
};

function cash(n: number | null) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function px(n: number | null) {
  if (n == null || !(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

/** Five strategy cells from real pool volume. A blocked cell is not a signal. */
export function MarketMatrix({ bars, pool, symbol }: { bars: MatrixBar[]; pool: boolean; symbol: string }) {
  const [expanded, setExpanded] = useState(false);
  const matrix = useMemo(() => evaluateMatrix({ bars, source: pool ? "gecko-pool" : "price-only" }), [bars, pool]);
  const recent = useMemo(() => normalizeBars(bars).slice(-30), [bars]);
  const volumePeak = Math.max(1, ...recent.map((b) => b.v));
  return (
    <section className="border-t border-[#2a2e39] bg-[#080d13] px-3 py-3 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.16em] text-[#c6f56a] uppercase">Matrix · {symbol}</p>
          <p className="mt-1 text-[11px] text-white/40">{pool ? "Pool OHLCV in USD. Volume is the pool, not a guess." : "Price history only. Volume signals stay off."}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[10px] ${matrix.volumeReliable ? "border-[#c6f56a]/30 text-[#c6f56a]" : "border-amber-300/25 text-amber-300"}`}>
          {matrix.volumeReliable ? "Volume verified" : "Signals held"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat title="Last bar volume" value={cash(matrix.volumeUsd)} />
        <Stat title="Rel. volume / 20" value={matrix.volumeRatio == null ? "—" : `${matrix.volumeRatio.toFixed(2)}×`} />
        <Stat title="ATR 14 / close" value={matrix.atrPct == null ? "—" : `${matrix.atrPct.toFixed(2)}%`} />
        <Stat title="Rolling VWAP" value={px(matrix.vwap)} />
        <Stat title="RSI 14" value={matrix.rsi == null ? "—" : matrix.rsi.toFixed(1)} />
        <Stat title="Alignment" value={matrix.volumeReliable ? `${matrix.confidence}/100` : "Blocked"} />
      </div>
      {matrix.volumeReliable ? (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/25 p-2">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-white/40">
            <span>Pool volume by bar</span>
            <span>Last {recent.length}</span>
          </div>
          <div className="flex h-14 items-end gap-[2px]">
            {recent.map((b, i) => (
              <div key={`${b.t}-${i}`} title={`${new Date(b.t > 1e12 ? b.t : b.t * 1000).toLocaleString()} · ${cash(b.v)}`} className={`min-w-0 flex-1 rounded-t-sm ${b.c >= b.o ? "bg-[#b6f36a]/75" : "bg-[#ff7585]/75"}`} style={{ height: `${Math.max(2, (b.v / volumePeak) * 100)}%` }} />
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-300/[0.04] p-3 text-[11px] text-amber-200/80">{matrix.reason} No buy or sell signal is invented.</p>
      )}
      {matrix.cells.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {matrix.cells.map((c) => (
            <div key={c.id} className={`rounded-xl border p-2 ${color[c.signal] || color.blocked}`}>
              <p className="text-[10px] font-medium">{c.label}</p>
              <p className="mt-1 font-mono text-xs font-bold uppercase">{c.signal}</p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-white/55">{matrix.volumeReliable ? `${matrix.market}. Research only. Not an order.` : "No executable signal."}</p>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="min-h-9 shrink-0 rounded-lg border border-white/10 px-3 text-[11px] text-white/70">{expanded ? "Less" : "Details"}</button>
      </div>
      {expanded ? (
        <div className="mt-2 space-y-2 border-t border-white/10 pt-2">
          {matrix.cells.map((c) => (
            <div key={c.id} className="flex justify-between gap-4 text-[11px]">
              <span className="shrink-0 text-white/70">{c.label}</span>
              <span className="text-right text-white/40">{c.explain}</span>
            </div>
          ))}
          <p className="text-[10px] text-white/35">OBV follows the candle, not who hit the bid. VWAP is the last 20 bars, not a session VWAP. The wallet is a separate step.</p>
        </div>
      ) : null}
    </section>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2">
      <p className="text-[10px] text-white/40">{title}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-white/90">{value}</p>
    </div>
  );
}
