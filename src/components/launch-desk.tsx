import { useState } from "react";
import { TradePad } from "@/components/fill-button";
import { PROGRAM_ID, FEE_BPS } from "@/lib/senda-program";
import { formatUsd, type HouseListing } from "@/lib/sol-house";

export function LaunchDesk({ names = [] }: { names?: HouseListing[] }) {
  const book = names.filter((name) => name.venue === "prestocks" && name.last > 0).slice(0, 8);
  const [mint, setMint] = useState(book[0]?.mint ?? "");
  const row = book.find((name) => name.mint === mint) ?? book[0];
  return (
    <div className="px-4 pb-8">
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">Names that already trade</h2>
      <p className="mt-2 text-sm text-muted">Pick one. The size is on the ticket. Phantom signs the swap and the token stays in the wallet.</p>
      <div className="mt-3 flex gap-2 overflow-x-auto">
        {book.map((name) => (
          <button key={name.mint} type="button" onClick={() => setMint(name.mint)} className={`min-h-12 shrink-0 rounded-2xl border px-3 text-left ${row?.mint === name.mint ? "border-white" : "border-white/10"}`}>
            <span className="block text-xs font-semibold">{name.symbol}</span>
            <span className="font-mono text-[11px] text-white/45">{formatUsd(name.last)}</span>
          </button>
        ))}
      </div>
      {row ? <TradePad mint={row.mint} price={row.last} symbol={row.symbol} /> : null}
      <p className="mt-8 font-mono text-[11px] leading-relaxed text-subtle">
        Agency program {PROGRAM_ID}
        <br />
        route_fill · fee {FEE_BPS} bps · the route is built here · you sign it
      </p>
    </div>
  );
}
