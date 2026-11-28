import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getLiquifyDecimals, getLiquifyLadder, type LiquifyResult } from "@/lib/liquify";
import { describeCurve, type CurveRow } from "@/lib/liquify-math.mjs";

const NAMES = [
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
];

function price(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toPrecision(3)}`;
}

function tokens(row: CurveRow): string {
  if (!row.tokens) return "—";
  const n = Number(row.tokens);
  if (!Number.isFinite(n)) return row.tokens;
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

export function LiquifyCurve() {
  const [mint, setMint] = useState(NAMES[0].mint);
  const [symbol, setSymbol] = useState("SOL");
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<LiquifyResult | null>(null);
  const [rows, setRows] = useState<CurveRow[]>([]);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!rows.length) return;
    listRef.current?.scrollIntoView({ block: "center" });
  }, [rows]);

  async function read(next = mint, name = symbol) {
    setBusy(true);
    setBook(null);
    setRows([]);
    try {
      const [ladder, decimals] = await Promise.all([
        getLiquifyLadder({ data: { mint: next } }),
        getLiquifyDecimals({ data: { mint: next } }),
      ]);
      setBook(ladder);
      setSymbol(name);
      if (decimals == null) {
        toast.error("The mint did not report decimals. Sizes are quoted, but token amounts stay hidden.");
        return;
      }
      setRows(describeCurve(ladder.sizes, decimals));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The size curve did not come back.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#10131c] p-4 sm:p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-accent uppercase">Size curve</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">What the route clears</h2>
      <p className="mt-2 max-w-xl text-sm leading-snug text-white/55">Four USDC sizes, asked at the same time. A worse price at a larger size is the cost of the route. It is a quote, not a fill, and nothing is signed.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {NAMES.map((row) => (
          <button key={row.mint} type="button" onClick={() => { setMint(row.mint); setSymbol(row.symbol); void read(row.mint, row.symbol); }} className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${mint === row.mint ? "bg-white text-black" : "bg-white/10 text-white/80"}`}>
            {row.symbol}
          </button>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={() => void read()} className="mt-3 min-h-12 w-full rounded-full bg-[#d7e36a] text-sm font-semibold text-black disabled:opacity-40">
        {busy ? "Reading four sizes…" : `Read ${symbol}`}
      </button>
      {book ? (
        <div className="mt-4">
          <p className="text-xs text-white/45">{book.source}</p>
          {rows.length ? (
            <ul ref={listRef} className="mt-3 space-y-2">
              {rows.map((row) => (
                <li key={row.usd} className="rounded-2xl bg-white/[0.04] px-3 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-lg">${row.usd}</p>
                    <p className="text-right text-sm font-semibold">{row.status === "available" ? `${tokens(row)} ${symbol}` : "No quote"}</p>
                  </div>
                  {row.status === "available" ? (
                    <p className="mt-1 text-xs text-white/50">
                      {price(row.usdPerToken ?? 0)} each
                      {row.executionPremiumPct != null && row.executionPremiumPct !== 0 ? ` · ${row.executionPremiumPct > 0 ? "+" : ""}${row.executionPremiumPct.toFixed(2)}% vs the smallest` : ""}
                      {row.impactPct != null ? ` · impact ${Math.abs(row.impactPct).toFixed(2)}%` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-white/45">{row.reason || "No verified route at this size."}</p>
                  )}
                  {row.router ? <p className="mt-1 text-[11px] text-white/35">{row.router}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <ul className="mt-3 space-y-2">
              {book.sizes.map((row) => (
                <li key={row.usd} className="rounded-2xl bg-white/[0.04] px-3 py-3 text-sm">
                  <span className="font-mono">${row.usd}</span>
                  <span className="mt-1 block text-xs text-white/45">{row.status === "available" ? row.quote?.router || "Quoted. Decimals did not come back." : row.reason || "No quote."}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs leading-snug text-white/40">{book.note}</p>
        </div>
      ) : null}
    </section>
  );
}
