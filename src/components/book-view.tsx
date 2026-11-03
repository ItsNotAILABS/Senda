import { useEffect, useMemo, useState } from "react";
import { lotsFrom, readFills, type Lot } from "@/lib/book";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

export function BookView({
  tokens,
  names,
  marks = [],
}: {
  tokens: Array<{ mint: string; ui: number; symbol?: string }>;
  names: HouseListing[];
  marks?: Array<{ mint: string; symbol: string; last: number }>;
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener("senda-book", bump);
    return () => window.removeEventListener("senda-book", bump);
  }, []);
  const view = useMemo(() => {
    const byMint = new Map<string, { mint: string; symbol: string; last: number }>();
    for (const name of names) {
      if (name.mint && name.last > 0) byMint.set(name.mint, { mint: name.mint, symbol: name.symbol, last: name.last });
    }
    for (const mark of marks) {
      if (mark.mint && mark.last > 0 && !byMint.has(mark.mint)) byMint.set(mark.mint, mark);
    }
    for (const token of tokens) {
      if (token.mint && token.symbol && !byMint.has(token.mint)) byMint.set(token.mint, { mint: token.mint, symbol: token.symbol, last: 0 });
    }
    return lotsFrom(readFills(), tokens, [...byMint.values()]);
  }, [tokens, names, marks, tick]);
  const empty = view.hold.length + view.trade.length === 0;
  return (
    <div className="mt-4 border-t border-white/8 pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] tracking-[0.16em] text-subtle">YOUR BOOK</p>
        <p className="font-mono text-[11px] text-subtle">
          {empty ? "Nothing held yet" : `P&L ${view.pnl >= 0 ? "+" : ""}${view.pnl.toFixed(2)}`}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Pile label="Hold" hint="Long term" value={view.holdValue} rows={view.hold} />
        <Pile label="Trade" hint="Same names, separate" value={view.tradeValue} rows={view.trade} />
      </div>
    </div>
  );
}

function Pile({ label, hint, value, rows }: { label: string; hint: string; value: number; rows: Lot[] }) {
  return (
    <div className="rounded-2xl bg-black/40 px-3 py-2">
      <p className="text-[10px] tracking-[0.14em] text-subtle">{label.toUpperCase()}</p>
      <p className="font-mono text-lg tabular-nums">{formatUsd(value)}</p>
      <p className="text-[10px] text-subtle">{hint}</p>
      {rows.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={`${r.bucket}-${r.mint}`} className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold">{r.symbol}</span>
              <span className="text-right font-mono text-[10px] leading-tight">
                <span className="block">{r.qty.toFixed(4)}</span>
                <span className="block text-subtle">
                  {formatUsd(r.value)}
                  {r.pnl == null ? "" : ` ${r.pnl >= 0 ? "+" : ""}${r.pnl.toFixed(2)}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[10px] text-subtle">Empty</p>
      )}
    </div>
  );
}
