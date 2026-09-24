import { formatCents } from "@/lib/markets";
import { isHouse } from "@/lib/feeds";
import { formatUsd } from "@/lib/sol-house";
import {
  formatAgo,
  formatPrintSize,
  sourceLabel,
  type TapePrint,
} from "@/lib/tape";
import { cn } from "@/lib/utils";

function formatTapePrice(p: TapePrint): string {
  if (p.venue !== "pit" && isHouse(p.venue)) return formatUsd(p.price);
  if (p.price > 1) return formatUsd(p.price);
  return formatCents(p.price);
}

function sideLabel(p: TapePrint): string {
  if (p.venue !== "pit" && isHouse(p.venue)) return p.side === "yes" ? "LONG" : "FADE";
  return p.side.toUpperCase();
}

function PrintLine({ p, compact }: { p: TapePrint; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono", compact ? "text-[0.7rem]" : "text-xs")}>
      <span className="text-subtle">{formatAgo(p.at)}</span>
      <span className="text-muted">{sourceLabel(p)}</span>
      <span className="text-fg">{p.name}</span>
      <span className={p.side === "no" ? "text-accent" : "text-fg"}>{sideLabel(p)}</span>
      <span className="tabular-nums text-fg/90">{formatTapePrice(p)}</span>
      <span className="text-subtle">× {formatPrintSize(p)}</span>
    </span>
  );
}

export function ActionTape({
  prints,
  live,
}: {
  prints: TapePrint[];
  live?: boolean;
}) {
  const row = prints.slice(0, 16);
  const loop = row.length ? [...row, ...row] : [];

  return (
    <div className="border-b border-border bg-felt-ink/80">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-1.5 sm:px-6">
        <span
          className={cn(
            "shrink-0 font-mono text-[0.6rem] tracking-[0.18em] uppercase",
            live ? "text-accent" : "text-subtle",
          )}
        >
          {live ? "Live" : "Tape"}
        </span>
        <div className="min-w-0 flex-1 overflow-hidden" role="marquee" aria-label="Live street tape">
          {loop.length === 0 ? (
            <p className="font-mono text-[0.7rem] text-subtle">Pulling street prints…</p>
          ) : (
            <div className="tape-scroll flex w-max gap-6 whitespace-nowrap">
              {loop.map((p, i) => (
                <PrintLine key={`${p.id}-${i}`} p={p} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ActionList({
  prints,
  marketId,
}: {
  prints: TapePrint[];
  marketId?: string;
}) {
  const rows = (marketId ? prints.filter((p) => p.marketId === marketId) : prints).slice(0, 8);
  if (rows.length === 0) {
    return (
      <p className="px-1 font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
        Waiting on the next print
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between gap-2 rounded-md bg-elevated px-3 py-2 shadow-panel"
        >
          <PrintLine p={p} />
        </li>
      ))}
    </ul>
  );
}
