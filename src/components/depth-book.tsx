import { formatCents } from "@/lib/markets";
import type { DepthLevel } from "@/lib/street";
import { cn } from "@/lib/utils";

function Side({
  title,
  levels,
  max,
  ask,
}: {
  title: string;
  levels: DepthLevel[];
  max: number;
  ask?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between font-mono text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
        <span>{title}</span>
        <span>Size</span>
      </div>
      <ul className="space-y-1">
        {levels.length === 0 ? (
          <li className="py-6 text-center text-sm text-muted">Empty</li>
        ) : (
          levels.map((lvl) => (
            <li key={`${title}-${lvl.price}`} className="relative overflow-hidden rounded-md">
              <span
                className={cn("absolute inset-y-0 bg-fg/10", ask ? "right-0" : "left-0")}
                style={{ width: `${Math.max(6, (lvl.size / max) * 100)}%` }}
              />
              <div className="relative flex items-center justify-between px-2 py-1.5 font-mono text-xs tabular-nums">
                <span className={ask ? "text-accent" : "text-fg"}>{formatCents(lvl.price)}</span>
                <span className="text-muted">
                  {lvl.size <= 0 ? "—" : lvl.size >= 1000 ? `${(lvl.size / 1000).toFixed(1)}k` : lvl.size.toFixed(0)}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function DepthBook({
  bids,
  asks,
  loading,
}: {
  bids: DepthLevel[];
  asks: DepthLevel[];
  loading?: boolean;
}) {
  const max = Math.max(1, ...bids.map((l) => l.size), ...asks.map((l) => l.size));
  if (loading && bids.length === 0 && asks.length === 0) {
    return <div className="h-48 animate-pulse rounded-xl bg-elevated" />;
  }
  return (
    <div className="rounded-xl bg-elevated p-3 shadow-panel sm:p-4">
      <p className="mb-3 font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">Order book</p>
      <div className="grid grid-cols-2 gap-4">
        <Side title="Bids" levels={bids} max={max} />
        <Side title="Asks" levels={asks} max={max} ask />
      </div>
    </div>
  );
}
