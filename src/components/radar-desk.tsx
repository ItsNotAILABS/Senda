import { useState } from "react";
import { TradePad } from "@/components/fill-button";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function RadarDesk({ house }: { house: HouseListing[] }) {
  const rows = [...house]
    .filter((h) => h.venue === "prestocks" && h.mark > 0)
    .sort((a, b) => Math.abs(a.premium ?? 0) - Math.abs(b.premium ?? 0));
  const [pick, setPick] = useState(rows[0]?.mint ?? "");
  const row = rows.find((r) => r.mint === pick) ?? rows[0];

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="font-display text-3xl tracking-tight">Premium radar</h2>
      <p className="mt-2 text-sm text-muted">
        Token price vs SPV mark. Cheap last is a discount to the SPV; rich last is a premium. Tap a name, type a size, Phantom signs.
      </p>
      {row ? <TradePad mint={row.mint} price={row.last} symbol={row.symbol} /> : null}
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => {
          const cheap = (r.premium ?? 0) < 0;
          const on = r.mint === row?.mint;
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setPick(r.mint)} className={cn("w-full py-3 text-left", on && "text-[#d7e36a]")}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold">{r.symbol}</span>
                  <span className={cn("font-mono text-sm font-semibold", cheap ? "text-up" : "text-down")}>{formatPremium(r.premium)}</span>
                </span>
                <span className="font-mono text-[11px] text-subtle">
                  token {formatUsd(r.last)} · mark {formatUsd(r.mark)} · {cheap ? "discount" : "premium"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}