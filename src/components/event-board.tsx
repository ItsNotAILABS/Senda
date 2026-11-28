import { useEffect, useState } from "react";
import { getEventBoard, type EventBoard, type EventQuote } from "@/lib/event-board";

/** Live Polymarket prices. A price is shown only after the same market id agrees. This app does not take the stake. */
export function EventBoard() {
  const [board, setBoard] = useState<EventBoard | null>(null);

  useEffect(() => {
    let live = true;
    getEventBoard()
      .then((next) => {
        if (live) setBoard(next);
      })
      .catch(() => {
        if (live) setBoard(null);
      });
    return () => {
      live = false;
    };
  }, []);

  const rows: EventQuote[] = board?.rows ?? [];
  if (!board) return null;

  return (
    <section className="mt-4 rounded-[22px] border border-white/10 bg-[#10131c] p-5">
      <p className="font-mono text-[11px] tracking-[0.16em] text-subtle uppercase">Event book</p>
      <h2 className="mt-1 text-2xl tracking-tight">
        Live yes-prices. <span className="text-accent">The stake is on their book.</span>
      </h2>
      <p className="mt-2 text-sm text-muted">
        Each row was read again from Polymarket by market id. There is no API key, so this is a public check, not a signed session. {board.dropped ? `${board.dropped} did not match and were left off.` : "Nothing mismatched."} This desk does not hold the stake.
      </p>
      {rows.length === 0 ? <p className="mt-3 text-sm text-white/55">No price verified on this read.</p> : null}
      <ul className="mt-3 divide-y divide-white/10">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{row.question}</p>
              <p className="mt-1 font-mono text-[11px] text-subtle">
                24h ${Math.round(row.volume).toLocaleString("en-US")}
                {row.bid != null && row.ask != null ? ` · ${Math.round(row.bid * 100)}–${Math.round(row.ask * 100)}¢` : ""}
                {row.spread != null ? ` · spread ${Math.round(row.spread * 1000) / 10}¢` : ""}
                {row.change != null ? ` · day ${row.change > 0 ? "+" : ""}${Math.round(row.change * 100)}¢` : ""}
                {row.end ? ` · ends ${row.end}` : ""}
              </p>
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
