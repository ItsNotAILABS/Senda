import { useEffect, useState } from "react";
import { loadUsMarkets, type UsMarket } from "@/lib/us-markets";

function cents(n: number): string {
  return `${Math.round(n * 100)}¢`;
}

/** Kalshi contracts. Legal for a US person on Kalshi. This desk does not hold the stake. */
export function UsBoard() {
  const [rows, setRows] = useState<UsMarket[]>([]);

  useEffect(() => {
    loadUsMarkets().then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <section className="px-3 py-3">
      <p className="font-mono text-[11px] tracking-[0.14em] text-white/40 uppercase">United States</p>
      <h2 className="mt-1 text-lg font-semibold">Kalshi is the book a US person can hold.</h2>
      <p className="mt-1 text-sm text-white/50">Bitcoin, ether, football, and the New York high. The price is the last trade. Opening one leaves this desk and signs on Kalshi. Senda does not take the stake.</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.ticker} className="rounded-2xl border border-white/10 px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-snug">{row.title}</p>
              <p className="font-mono text-sm tabular-nums">{cents(row.yes || row.bid)}</p>
            </div>
            <p className="mt-1 text-[11px] text-white/45">
              Bid {cents(row.bid)} · ask {cents(row.ask)} · 24h {Math.round(row.volume).toLocaleString("en-US")} contracts
            </p>
            <a href={row.href} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-8 items-center text-xs font-semibold text-white/80">
              Open on Kalshi
            </a>
          </li>
        ))}
      </ul>
      {!rows.length ? <p className="mt-3 text-sm text-white/40">Kalshi did not return a live market.</p> : null}
    </section>
  );
}
