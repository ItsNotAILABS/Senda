import { useEffect, useState } from "react";
import { loadPrints, type PrintBook } from "@/lib/tx-tape";
import { cn } from "@/lib/utils";

function usd(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

/** The pool's latest swaps, under the ticket. Prices are the fills, not a candle. */
export function PrintTape({ mint, symbol }: { mint: string; symbol: string }) {
  const [book, setBook] = useState<PrintBook | null>(null);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    const pull = () => {
      loadPrints({ data: { mint } })
        .then((next) => {
          if (live) setBook(next);
        })
        .catch(() => {
          if (live) setBook(null);
        });
    };
    pull();
    const id = window.setInterval(pull, 12_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [mint]);

  const max = Math.max(1, ...(book?.levels.map((row) => row.usd) || [1]));

  return (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] tracking-[0.14em] text-white/40 uppercase">Prints</p>
        <p className="font-mono text-[11px] text-white/45">{book?.ageSec != null ? `${book.ageSec}s` : ""}</p>
      </div>
      <p className="mt-1 font-mono text-lg tabular-nums">{book ? usd(book.usd) : "…"}</p>
      <p className="text-[11px] text-white/40">
        {symbol} in this window
        {book?.lastPrice ? ` · last fill ${px(book.lastPrice)}` : ""}
        {book?.dex ? ` · ${book.dex}` : ""}
      </p>
      {book?.levels.length ? (
        <ul className="mt-3 space-y-1">
          {book.levels.map((row) => (
            <li key={row.price} className="grid grid-cols-[72px_1fr_52px] items-center gap-2 font-mono text-[11px]">
              <span className="tabular-nums text-white/70">{px(row.price)}</span>
              <span className="h-2 overflow-hidden rounded-full bg-white/10">
                <span className="block h-full bg-accent" style={{ width: `${Math.max(6, (row.usd / max) * 100)}%` }} />
              </span>
              <span className="text-right tabular-nums text-white/50">{usd(row.usd)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="mt-3 divide-y divide-white/10">
        {(book?.prints || []).slice(0, 5).map((row) => (
          <li key={row.signature}>
            <a href={`https://solscan.io/tx/${row.signature}`} target="_blank" rel="noreferrer" className="flex items-baseline justify-between gap-2 py-1.5 font-mono text-[11px]">
              <span className={cn(row.side === "sell" ? "text-down" : "text-up")}>{row.side}</span>
              <span className="tabular-nums">{px(row.price)}</span>
              <span className="text-white/45">{usd(row.usd)}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] leading-snug text-white/35">{book?.note || "Reading the pool."}</p>
    </div>
  );
}
