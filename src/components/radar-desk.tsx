import { rails } from "@/lib/ecosystem";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export function RadarDesk({ house }: { house: HouseListing[] }) {
  const rows = [...house]
    .filter((h) => h.venue === "prestocks" && h.mark > 0)
    .sort((a, b) => Math.abs(a.premium ?? 0) - Math.abs(b.premium ?? 0));

  return (
    <div className="px-4 pb-10 pt-4">
      <h2 className="font-display text-3xl tracking-tight">Premium radar</h2>
      <p className="mt-2 text-sm text-muted">
        Token price vs SPV mark. Cheap last is a discount to the SPV; rich last is a premium. Institutions mint/redeem
        against the SPV (KYC) to close the gap. You swap the SPL on Jupiter.
      </p>
      <ul className="mt-4 divide-y divide-border">
        {rows.map((r) => {
          const cheap = (r.premium ?? 0) < 0;
          const href = rails(r.mint, r.symbol).jupiter;
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold">{r.symbol}</p>
                <p className={cn("font-mono text-sm font-semibold", cheap ? "text-up" : "text-down")}>
                  {formatPremium(r.premium)}
                </p>
              </div>
              <p className="font-mono text-[11px] text-subtle">
                token {formatUsd(r.last)} · mark {formatUsd(r.mark)} · {cheap ? "discount" : "premium"}
              </p>
              <a href={href} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-muted">
                Jupiter USDC → {r.symbol}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
