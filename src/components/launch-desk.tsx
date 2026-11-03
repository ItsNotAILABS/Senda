import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatChg, formatUsd, getHouse, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

/** Names that already trade. A buy is the PreStocks ticket, not a new mint. */
export function LaunchDesk() {
  const [rows, setRows] = useState<HouseListing[]>([]);
  const [note, setNote] = useState("Reading the book");

  useEffect(() => {
    let live = true;
    getHouse()
      .then((book) => {
        if (!live) return;
        const names = book.filter((h) => h.venue === "prestocks" && h.last > 0).sort((a, b) => b.last - a.last);
        setRows(names);
        setNote(names.length ? `${names.length} names already trading` : "The book did not come back");
      })
      .catch(() => live && setNote("The book did not come back"));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-3 px-3 pt-3 pb-8">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Launch</h1>
        <p className="mt-1 text-xs text-white/45">{note}. Buy one and it lands in the wallet. Nothing here opens a new token.</p>
      </header>
      <ul className="overflow-hidden rounded-2xl border border-white/10 bg-[#12141a]">
        {rows.map((n) => (
          <li key={n.id} className="border-t border-white/[0.06] first:border-t-0">
            <Link to="/pre" search={{ q: n.symbol }} className="flex items-center gap-3 px-3 py-2.5">
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#1c1f28] text-[10px] font-semibold text-white/70">
                {n.symbol.slice(0, 2)}
                {n.image ? (
                  <img src={n.image} alt="" className="absolute inset-0 size-9 rounded-full bg-white object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{n.symbol}</span>
                <span className="block truncate text-[11px] text-white/40">{n.name}</span>
              </span>
              <span className="shrink-0 font-mono text-sm tabular-nums">{formatUsd(n.last)}</span>
              <span className={cn("w-14 shrink-0 text-right font-mono text-xs tabular-nums", (n.change24h ?? 0) < 0 ? "text-[#ff5d73]" : "text-[#3dd68c]")}>
                {formatChg(n.change24h)}
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 ? <li className="px-3 py-6 text-sm text-white/45">{note}</li> : null}
      </ul>
    </div>
  );
}
