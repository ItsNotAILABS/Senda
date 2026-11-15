import { useEffect, useState } from "react";
import { FillButton } from "@/components/fill-button";
import { loadWeek, type WeekRow } from "@/lib/week-markets";

function money(n: number): string {
  if (!(n > 0)) return "pool not reported";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M pool`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k pool`;
  return `$${Math.round(n)} pool`;
}

/** This week's named listings. A row is a Jupiter mint, not the issuer's weekly volume. */
export function WeekMarkets() {
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [usd, setUsd] = useState(25);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    loadWeek()
      .then((next) => live && setRows(next))
      .catch((e: unknown) => live && setErr(e instanceof Error ? e.message : "Jupiter did not list these."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <section className="px-3 pb-2 lg:px-4">
      <h2 className="text-lg font-semibold">This week on Solana</h2>
      <p className="mt-1 text-sm text-white/50">
        Every Backpack Securities mint Jupiter returned for this book, plus Hastra AUTO. A name that is not on that list is not here. The pool is Jupiter's, not a weekly volume figure. Deepest first.
      </p>
      <div className="mt-3 flex gap-2">
        {[10, 25, 100].map((n) => (
          <button key={n} type="button" onClick={() => setUsd(n)} className={usd === n ? "min-h-10 rounded-full bg-white px-3 text-sm font-semibold text-black" : "min-h-10 rounded-full bg-white/10 px-3 text-sm font-semibold"}>
            ${n}
          </button>
        ))}
      </div>
      {err ? <p className="mt-3 text-sm text-down">{err}</p> : null}
      {!rows.length && !err ? <p className="mt-3 text-sm text-white/40">Asking Jupiter for the pools…</p> : null}
      {rows.length ? <p className="mt-3 font-mono text-[11px] text-white/40">{rows.length} names · deepest pool first</p> : null}
      <ul className="mt-2">
        {rows.map((row) => {
          const thin = row.liquidity > 0 && usd > row.liquidity * 0.05;
          return (
            <li key={row.mint} className="flex items-center gap-3 border-b border-white/10 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.symbol}</p>
                <p className="truncate text-xs text-white/40">{row.issuer} · {money(row.liquidity)} · {row.holders.toLocaleString("en-US")} holders</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm">{row.price > 0 ? `$${row.price.toFixed(2)}` : "—"}</p>
                {thin ? (
                  <p className="max-w-[140px] text-[11px] text-down">Over 5% of this pool.</p>
                ) : (
                  <FillButton mint={row.mint} usd={usd} symbol={row.symbol} label={`Buy $${usd}`} className="text-xs font-semibold text-white/80" />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
