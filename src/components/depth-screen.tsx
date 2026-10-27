import { useEffect, useState } from "react";
import { loadPrints, type BookRow, type PrintBook } from "@/lib/tx-tape";
import { loadVenues, type VenueBook } from "@/lib/venue-book";

function money(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toPrecision(2)}`;
}

function px(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 4 })}`;
  return `$${n.toPrecision(4)}`;
}

function sz(n: number): string {
  if (!(n > 0)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return n.toLocaleString("en-US", { maximumFractionDigits: n >= 1 ? 2 : 4 });
}

function wall(rows: BookRow[]): BookRow | null {
  return rows.reduce<BookRow | null>((best, row) => (!best || row.usd > best.usd ? row : best), null);
}

function stairs(rows: BookRow[], side: "bid" | "ask", max: number): string {
  if (!rows.length || !(max > 0)) return "";
  const n = rows.length;
  let acc = 0;
  let d = side === "bid" ? "M 100 78" : "M 100 78";
  rows.forEach((row, i) => {
    const x = side === "bid" ? 100 - ((i + 1) / n) * 96 : 100 + ((i + 1) / n) * 96;
    d += ` H ${x.toFixed(2)}`;
    acc += row.usd;
    const y = 78 - (acc / max) * 66;
    d += ` V ${y.toFixed(2)}`;
  });
  const edge = side === "bid" ? 4 : 196;
  d += ` H ${edge} V 78 Z`;
  return d;
}

/** Depth of the filled book, with the dollar size of every Solana venue beside it. */
export function DepthScreen({
  mint,
  symbol,
  onBuy,
  onSell,
}: {
  mint: string;
  symbol: string;
  onBuy?: () => void;
  onSell?: () => void;
}) {
  const [book, setBook] = useState<PrintBook | null>(null);
  const [venues, setVenues] = useState<VenueBook | null>(null);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    const pull = () => {
      loadPrints({ data: { mint } })
        .then((next) => {
          if (live) setBook(next);
        })
        .catch(() => undefined);
    };
    pull();
    const id = window.setInterval(pull, 2_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [mint]);

  useEffect(() => {
    if (!mint) return;
    let live = true;
    loadVenues({ data: { mint } })
      .then((next) => {
        if (live) setVenues(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [mint]);

  const bids = book?.bids || [];
  const asks = book?.asks || [];
  const buy = wall(bids);
  const sell = wall(asks);
  const bidUsd = bids.reduce((sum, row) => sum + row.usd, 0);
  const askUsd = asks.reduce((sum, row) => sum + row.usd, 0);
  const total = bidUsd + askUsd;
  const bidPct = total > 0 ? (bidUsd / total) * 100 : 50;
  const mid = book && book.spread > 0 && bids[0] && asks[0] ? (bids[0].price + asks[0].price) / 2 : book?.lastPrice || 0;
  const max = Math.max(bidUsd, askUsd, 1);
  const bidPath = stairs(bids, "bid", max);
  const askPath = stairs(asks, "ask", max);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#070b14]">
      <div className="grid gap-2 border-b border-white/10 p-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#14f195]/40 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#14f195] uppercase">Buy wall</span>
            <span className="font-mono text-lg font-semibold text-[#14f195]">{buy ? px(buy.price) : "—"}</span>
            <span className="font-mono text-[11px] text-white/45">{buy ? `${sz(buy.size)} ${symbol} · ${money(buy.usd)}` : "No bid filled"}</span>
            <button type="button" onClick={onBuy} disabled={!onBuy} className="min-h-8 rounded-full bg-[#14f195] px-3 text-[11px] font-semibold text-black disabled:opacity-40">1-click buy</button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#fb7185]/40 px-2 py-1 text-[10px] font-semibold tracking-wide text-[#fb7185] uppercase">Sell wall</span>
            <span className="font-mono text-lg font-semibold text-[#fb7185]">{sell ? px(sell.price) : "—"}</span>
            <span className="font-mono text-[11px] text-white/45">{sell ? `${sz(sell.size)} ${symbol} · ${money(sell.usd)}` : "No ask filled"}</span>
            <button type="button" onClick={onSell} disabled={!onSell} className="min-h-8 rounded-full bg-[#fb7185] px-3 text-[11px] font-semibold text-white disabled:opacity-40">1-click sell</button>
          </div>
        </div>
        <div className="min-w-[9rem]">
          <p className="text-right font-mono text-[10px] text-white/40">Bids {bidPct.toFixed(1)}% · Asks {(100 - bidPct).toFixed(1)}%</p>
          <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-[#fb7185]">
            <div className="h-full bg-[#14f195]" style={{ width: `${bidPct}%` }} />
          </div>
          <p className="mt-1 text-right text-[10px] text-white/35">Imbalance</p>
        </div>
      </div>
      <div className="px-3 pt-2 font-mono text-[11px] text-white/55">
        <span className="text-[#14f195]">{buy ? px(buy.price) : "—"}</span>
        <span> · mid {px(mid)} · spread {book?.spread ? px(book.spread) : "—"} · </span>
        <span className="text-[#fb7185]">{sell ? px(sell.price) : "—"}</span>
      </div>
      <svg viewBox="0 0 200 86" className="h-44 w-full">
        {bidPath ? <path d={bidPath} fill="rgba(20,241,149,0.28)" stroke="#14f195" strokeWidth="1.2" /> : null}
        {askPath ? <path d={askPath} fill="rgba(251,113,133,0.28)" stroke="#fb7185" strokeWidth="1.2" /> : null}
        <line x1="100" y1="6" x2="100" y2="78" stroke="#7dd3fc" strokeDasharray="2 2" />
        <text x="100" y="84" textAnchor="middle" fill="#94a3b8" fontSize="5">Mid {px(mid)}</text>
      </svg>
      <div className="flex items-center justify-between px-3 pb-2 font-mono text-[10px] text-white/35">
        <span>{mid > 0 ? px(mid * 0.95) : "—"} · −5%</span>
        <span>{venues ? `${venues.venues.length} venues · ${money(venues.vol)} 24h` : "Reading venues"}</span>
        <span>+5% · {mid > 0 ? px(mid * 1.05) : "—"}</span>
      </div>
      {venues && venues.venues.length > 0 ? (
        <div className="grid grid-cols-2 gap-1 border-t border-white/10 px-3 py-2 sm:grid-cols-4">
          {venues.venues.slice(0, 8).map((row) => (
            <p key={row.dex} className="font-mono text-[10px] text-white/55">
              <span className="text-white/80">{row.dex}</span> {money(row.vol)}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
