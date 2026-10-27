import { useEffect, useState } from "react";
import { loadPrints, type BookRow, type PrintBook } from "@/lib/tx-tape";
import { RestTicket } from "@/components/rest-ticket";

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

function usd(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(3)}`;
}

function sz(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(3);
  return n.toPrecision(3);
}

function Row({ row, max, side, onPick }: { row: BookRow; max: number; side: "bid" | "ask"; onPick: (price: number) => void }) {
  const pct = Math.max(4, Math.min(100, (row.total / max) * 100));
  const tone = side === "ask" ? "text-down" : "text-up";
  const wash = side === "ask" ? "bg-down/15" : "bg-up/15";
  return (
    <button type="button" onClick={() => onPick(row.price)} className="relative grid w-full grid-cols-[1.1fr_1fr_1fr] items-center px-2 text-left font-mono text-[11px] leading-5 tabular-nums hover:bg-white/5">
      <span className={`absolute inset-y-0 right-0 ${wash}`} style={{ width: `${pct}%` }} />
      <span className={`relative ${tone}`}>{px(row.price)}</span>
      <span className="relative text-right text-white/80">{sz(row.size)}</span>
      <span className="relative text-right text-white/45">{sz(row.total)}</span>
    </button>
  );
}

/** Bid/ask ladder from the pool's latest fills. Refreshes about every 1.5s. */
export function PrintTape({ mint, symbol, size = 5 }: { mint: string; symbol: string; size?: number }) {
  const [book, setBook] = useState<PrintBook | null>(null);
  const [rest, setRest] = useState<{ side: "buy" | "sell"; price: number } | null>(null);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    const pull = () => {
      loadPrints({ data: { mint } })
        .then((next) => {
          if (!live) return;
          setBook((cur) => (next.bids.length || next.asks.length || next.prints.length || !cur ? next : cur));
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 1_500);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [mint]);

  const asks = [...(book?.asks || [])].reverse();
  const bids = book?.bids || [];
  const max = Math.max(1, ...asks.map((row) => row.total), ...bids.map((row) => row.total));
  const up = (book?.prints[0]?.side || "buy") === "buy";

  return (
    <div className="border-t border-white/10">
      <div className="flex items-center justify-between px-2 py-1.5">
        <p className="text-[10px] tracking-[0.14em] text-white/40 uppercase">Book · {symbol}</p>
        <p className="font-mono text-[10px] text-white/35">{book?.ageSec != null ? `${book.ageSec}s` : "…"}{book?.dex ? ` · ${book.dex}` : ""}</p>
      </div>
      <div className="grid grid-cols-3 gap-1 px-2 pb-2">
        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
          <p className="text-[9px] tracking-wide text-white/35 uppercase">Window</p>
          <p className="font-mono text-[12px] tabular-nums">{book ? usd(book.usd) : "—"}</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
          <p className="text-[9px] tracking-wide text-white/35 uppercase">Spread</p>
          <p className="font-mono text-[12px] tabular-nums">{book?.call.spreadBps != null ? `${book.call.spreadBps.toFixed(0)} bp` : "—"}</p>
        </div>
        <div className="rounded-lg bg-white/[0.04] px-2 py-1.5">
          <p className="text-[9px] tracking-wide text-white/35 uppercase">Lean</p>
          <p className={`font-mono text-[12px] ${book?.call.lean === "ask" ? "text-down" : book?.call.lean === "bid" ? "text-up" : "text-white/70"}`}>{book?.call.lean || "…"}</p>
        </div>
      </div>
      {book?.call.imbalance != null ? (
        <div className="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-down/40">
          <div className="h-full bg-up" style={{ width: `${Math.max(0, Math.min(100, ((book.call.imbalance + 1) / 2) * 100))}%` }} />
        </div>
      ) : null}
      <div className="grid grid-cols-[1.1fr_1fr_1fr] px-2 pb-1 font-mono text-[10px] tracking-wide text-white/30 uppercase">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div className="flex min-h-[132px] flex-col justify-end">
        {asks.map((row) => (
          <Row key={`a${row.price}`} row={row} max={max} side="ask" onPick={(price) => setRest({ side: "buy", price })} />
        ))}
      </div>
      <div className={`flex items-baseline justify-between border-y border-white/10 px-2 py-1 ${up ? "text-up" : "text-down"}`}>
        <span className="font-mono text-sm tabular-nums">{book?.lastPrice ? px(book.lastPrice) : "—"}</span>
        <span className="font-mono text-[10px] text-white/40">{book?.spread ? `spread ${px(book.spread)}` : book?.note || ""}</span>
      </div>
      <div>
        {bids.map((row) => (
          <Row key={`b${row.price}`} row={row} max={max} side="bid" onPick={(price) => setRest({ side: "sell", price })} />
        ))}
      </div>
      {rest ? <RestTicket key={`${rest.side}:${rest.price}`} mint={mint} symbol={symbol} price={rest.price} usd={size} side={rest.side} /> : <p className="px-2 py-1.5 text-[10px] text-white/30">Tap a price to rest a limit. An ask rests a buy. A bid rests a sell.</p>}
    </div>
  );
}
