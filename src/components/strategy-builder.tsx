import { useState } from "react";
import { toast } from "sonner";
import { createEnvelope } from "@/lib/agent-envelope";
import { runBacktest, type Backtest, type Rule } from "@/lib/backtest";
import { getPrint, type PrintTf } from "@/lib/print";
import type { HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const TFS: PrintTf[] = ["15m", "1H", "4H", "1D"];

export function StrategyBuilder({ names, onSaved }: { names: HouseListing[]; onSaved: () => void }) {
  const book = names.filter((n) => n.mint && n.last > 0);
  const [symbol, setSymbol] = useState(book[0]?.symbol ?? "");
  const [tf, setTf] = useState<PrintTf>("1H");
  const [kind, setKind] = useState<"sma" | "drop">("drop");
  const [period, setPeriod] = useState(20);
  const [lookback, setLookback] = useState(12);
  const [dropPct, setDropPct] = useState(3);
  const [takePct, setTakePct] = useState(4);
  const [stopPct, setStopPct] = useState(2);
  const [usd, setUsd] = useState(25);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<Backtest | null>(null);
  const row = book.find((n) => n.symbol === symbol) ?? book[0];

  function rule(): Rule {
    return kind === "sma"
      ? { kind: "sma", period: Math.max(2, period), takePct, stopPct }
      : { kind: "drop", lookback: Math.max(2, lookback), dropPct, takePct, stopPct };
  }

  function mandate() {
    const r = rule();
    return r.kind === "sma"
      ? `Buy ${symbol} when the ${tf} close crosses under a ${r.period}-bar average. Sell on a cross back, +${r.takePct}%, or -${r.stopPct}%. Size $${usd}. The user signs.`
      : `Buy ${symbol} when the ${tf} close is ${r.dropPct}% under the last ${r.lookback} closes. Sell at +${r.takePct}% or -${r.stopPct}%. Size $${usd}. The user signs.`;
  }

  async function run() {
    if (!row) return;
    setBusy(true);
    try {
      const print = await getPrint({ data: { mint: row.mint, tf } });
      if (print.bars.length < 8) throw new Error(print.note || "Not enough candles.");
      setOut(runBacktest(print.bars.map((b) => ({ t: b.t, c: b.c })), usd, rule()));
    } catch (e) {
      setOut(null);
      toast.error(e instanceof Error ? e.message : "The candle feed did not answer.");
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!row) return;
    createEnvelope({
      name: `${row.symbol} ${kind === "sma" ? "average" : "drop"}`,
      mandate: mandate(),
      symbols: [row.symbol],
      maxUsd: usd,
      side: "buy",
      job: "discount",
    });
    onSaved();
    toast.success("On the roster. It can queue. It cannot sign.");
  }

  return (
    <section className="rounded-[28px] border border-[#c6f56a]/20 bg-[#070b08] p-4">
      <p className="text-sm font-semibold">Strategy</p>
      <p className="mt-1 text-xs text-white/45">A rule, then the pool candles for that mint. The walk is closes, one position, 10 bps each way. Saving it arms an agent. You still sign.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {book.map((n) => (
          <button key={n.id} type="button" onClick={() => setSymbol(n.symbol)} className={cn("min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold", n.symbol === row?.symbol ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {n.symbol}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        {TFS.map((id) => (
          <button key={id} type="button" onClick={() => setTf(id)} className={cn("min-h-9 flex-1 rounded-full text-xs font-semibold", tf === id ? "bg-white text-black" : "bg-[#2a2a2e]")}>
            {id}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setKind("drop")} className={cn("min-h-11 rounded-2xl text-sm font-semibold", kind === "drop" ? "bg-[#c6f56a] text-black" : "bg-[#141a14]")}>
          Buy the drop
        </button>
        <button type="button" onClick={() => setKind("sma")} className={cn("min-h-11 rounded-2xl text-sm font-semibold", kind === "sma" ? "bg-[#c6f56a] text-black" : "bg-[#141a14]")}>
          Cross the average
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {kind === "sma" ? (
          <label className="rounded-2xl bg-[#141a14] px-3 py-2">
            <span className="text-[11px] text-white/45">Average bars</span>
            <input inputMode="numeric" value={period} onChange={(e) => setPeriod(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
          </label>
        ) : (
          <>
            <label className="rounded-2xl bg-[#141a14] px-3 py-2">
              <span className="text-[11px] text-white/45">Lookback</span>
              <input inputMode="numeric" value={lookback} onChange={(e) => setLookback(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
            </label>
            <label className="rounded-2xl bg-[#141a14] px-3 py-2">
              <span className="text-[11px] text-white/45">Drop %</span>
              <input inputMode="decimal" value={dropPct} onChange={(e) => setDropPct(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
            </label>
          </>
        )}
        <label className="rounded-2xl bg-[#141a14] px-3 py-2">
          <span className="text-[11px] text-white/45">Take %</span>
          <input inputMode="decimal" value={takePct} onChange={(e) => setTakePct(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
        </label>
        <label className="rounded-2xl bg-[#141a14] px-3 py-2">
          <span className="text-[11px] text-white/45">Stop %</span>
          <input inputMode="decimal" value={stopPct} onChange={(e) => setStopPct(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
        </label>
        <label className="rounded-2xl bg-[#141a14] px-3 py-2">
          <span className="text-[11px] text-white/45">Size, USD</span>
          <input inputMode="decimal" value={usd} onChange={(e) => setUsd(Number(e.target.value) || 0)} className="mt-1 w-full bg-transparent font-mono text-lg outline-none" />
        </label>
      </div>
      <p className="mt-3 text-xs text-white/55">{row ? mandate() : "No name on the book."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy || !row} onClick={() => void run()} className="min-h-12 rounded-full bg-white text-sm font-semibold text-black disabled:opacity-50">
          {busy ? "Reading candles…" : "Backtest"}
        </button>
        <button type="button" disabled={!row} onClick={save} className="min-h-12 rounded-full bg-[#c6f56a] text-sm font-semibold text-black disabled:opacity-50">
          Arm on the roster
        </button>
      </div>
      {out ? (
        <div className="mt-4 rounded-2xl bg-black/40 p-3">
          <p className={cn("font-mono text-2xl tabular-nums", out.pnl < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
            {out.pnl >= 0 ? "+" : ""}${out.pnl.toFixed(2)}
          </p>
          <p className="mt-1 text-xs text-white/45">
            ${out.start.toFixed(2)} to ${out.end.toFixed(2)} · {out.trades.length ? Math.round((out.wins / out.trades.length) * 100) : 0}% winners · drawdown {(out.maxDd * 100).toFixed(1)}% · {out.bars} candles
          </p>
          <p className="mt-1 text-[11px] text-white/35">{out.note}</p>
          <ul className="mt-2 max-h-40 overflow-y-auto">
            {out.trades.slice(-8).map((t) => (
              <li key={`${t.entry}-${t.exit}`} className="flex justify-between gap-3 border-t border-white/10 py-2 text-xs">
                <span className="text-white/55">{t.why}</span>
                <span className={cn("font-mono", t.pnl < 0 ? "text-[#ff5d73]" : "text-[#c6f56a]")}>
                  {t.pnl >= 0 ? "+" : ""}${t.pnl.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
