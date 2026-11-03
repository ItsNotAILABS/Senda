import { useEffect, useState } from "react";
import { getEventBoard, type EventQuote } from "@/lib/event-board";

/** Live Polymarket prices. Opening the venue is the bet. This app does not take the stake. */
export function EventBoard() {
  const [rows, setRows] = useState<EventQuote[]>([]);

  useEffect(() => {
    let live = true;
    getEventBoard()
      .then((next) => {
        if (live) setRows(next);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (rows.length === 0) return null;

  return (
    <section className="mt-4 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Event book</p>
      <h2 className="mt-1 text-2xl tracking-tight">
        Live yes-prices. <span className="text-accent">The stake is on their book.</span>
      </h2>
      <p className="mt-2 text-sm text-muted">Polymarket’s public prices. This desk does not hold the stake and does not invent a fill. Open the market to take it.</p>
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{row.question}</p>
              <p className="mt-1 font-mono text-[11px] text-subtle">24h ${Math.round(row.volume).toLocaleString("en-US")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm tabular-nums">{Math.round(row.yes * 100)}¢</p>
              <a href={row.href} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent">
                Open
              </a>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
