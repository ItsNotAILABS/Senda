import { useState } from "react";
import { FillButton } from "@/components/fill-button";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

const PAGE = 24;

export function RadarDesk({ house, onOpen }: { house: HouseListing[]; onOpen?: (mint: string) => void }) {
  const [page, setPage] = useState(0);
  const rows = [...house]
    .filter((h) => h.venue === "prestocks" && h.mark > 0)
    .sort((a, b) => Math.abs(a.premium ?? 0) - Math.abs(b.premium ?? 0));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="font-display text-3xl tracking-tight">Premium tape</h2>
      <p className="mt-2 text-sm text-muted">
        {rows.length} names. Token price vs SPV mark. Cheap last is a discount to the SPV; rich last is a premium. You swap the SPL on Jupiter.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {shown.map((r) => {
          const cheap = (r.premium ?? 0) < 0;
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
              <button type="button" onClick={() => onOpen?.(r.mint)} className="text-left">
                <p className="text-sm font-semibold">{r.symbol}</p>
              </button>
                <p className={cn("font-mono text-sm font-semibold", cheap ? "text-up" : "text-down")}>
                  {formatPremium(r.premium)}
                </p>
              </div>
              <p className="font-mono text-[11px] text-subtle">
                token {formatUsd(r.last)} · mark {formatUsd(r.mark)} · {cheap ? "discount" : "premium"}
              </p>
              <FillButton
                mint={r.mint}
                usd={10}
                price={r.last}
                label={`Buy $10 ${r.symbol}`}
                className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-muted"
              />
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between text-sm">
        <button type="button" disabled={page <= 0} onClick={() => setPage((n) => Math.max(0, n - 1))} className="min-h-11 rounded-full bg-white/10 px-4 disabled:opacity-40">Back</button>
        <span className="font-mono text-xs text-muted">{page + 1} / {pages}</span>
        <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((n) => n + 1)} className="min-h-11 rounded-full bg-white px-4 font-semibold text-black disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
