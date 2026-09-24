import { BetPad } from "@/components/bet-pad";
import { Button } from "@/components/ui/button";
import type { Side } from "@/lib/lmsr";
import {
  formatPremium,
  formatUsd,
  formatValuation,
  houseVenueLabel,
  type HouseListing,
} from "@/lib/sol-house";
import { cn } from "@/lib/utils";

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">{label}</p>
      <p className={cn("truncate font-mono text-xs tabular-nums sm:text-sm", accent ? "text-accent" : "text-fg")}>
        {value}
      </p>
    </div>
  );
}

export function StockCard({
  stock,
  spend,
  busy,
  flash,
  stackYes,
  stackNo,
  onDrop,
  onOpen,
}: {
  stock: HouseListing;
  spend: number | null;
  busy: boolean;
  flash: Side | null;
  stackYes: number[];
  stackNo: number[];
  onDrop: (side: Side) => void;
  onOpen: () => void;
}) {
  const prem = stock.premium;
  const down = (prem ?? 0) < 0;

  return (
    <article className="flex flex-col gap-4 rounded-2xl bg-elevated p-4 shadow-panel sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            {houseVenueLabel(stock.venue)} · {stock.sector || "Solana"}
          </p>
          <h3 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {stock.name}
          </h3>
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{stock.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl font-semibold tabular-nums leading-none sm:text-4xl">
            {formatUsd(stock.last)}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] tracking-[0.16em] text-subtle uppercase">Last</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        <Stat label="Mark" value={formatUsd(stock.mark)} />
        <Stat label="Prem" value={formatPremium(prem)} accent={down} />
        <Stat label="Val" value={formatValuation(stock.valuation)} />
        <Stat label="Liq" value={stock.liquidity > 0 ? formatValuation(stock.liquidity) : "—"} />
        <Stat
          label="Holders"
          value={stock.holders > 0 ? stock.holders.toLocaleString("en-US") : "—"}
        />
        <Stat
          label="Δ 24h"
          value={
            stock.change24h == null
              ? "—"
              : `${stock.change24h > 0 ? "+" : ""}${(stock.change24h * 100).toFixed(1)}%`
          }
          accent={(stock.change24h ?? 0) < 0}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BetPad
          side="yes"
          title="LONG"
          price={stock.last}
          spend={spend}
          busy={busy}
          flash={flash === "yes"}
          variant="row"
          padKey={`${stock.id}-yes`}
          stack={stackYes}
          formatPrice={formatUsd}
          onDrop={() => onDrop("yes")}
        />
        <BetPad
          side="no"
          title="FADE"
          price={stock.last}
          spend={spend}
          busy={busy}
          flash={flash === "no"}
          variant="row"
          padKey={`${stock.id}-no`}
          stack={stackNo}
          formatPrice={formatUsd}
          onDrop={() => onDrop("no")}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <a
          href={stock.swapUrl}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[0.65rem] tracking-wide text-subtle uppercase hover:text-fg"
        >
          Swap on Jupiter
        </a>
        <Button type="button" variant="secondary" size="sm" className="min-h-11" disabled={busy} onClick={onOpen}>
          Open table
        </Button>
      </div>
    </article>
  );
}
