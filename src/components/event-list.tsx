import type { LiveMarket } from "@/lib/feeds";
import { cn } from "@/lib/utils";

export function EventList({
  rows,
  busy,
  onYes,
  onNo,
}: {
  rows: LiveMarket[];
  busy?: boolean;
  onYes: (m: LiveMarket) => void;
  onNo: (m: LiveMarket) => void;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-8 text-center text-sm text-muted">Loading live event books…</p>;
  }
  return (
    <section className="flex flex-col">
      <p className="px-3 pb-1 text-xs font-medium tracking-wide text-subtle uppercase">Live events</p>
      <div className="divide-y divide-border">
        {rows.map((m) => {
          const p = m.lastYes ?? m.streetYes;
          return (
            <div key={m.id} className="flex items-center gap-3 px-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{m.question}</p>
                <p className="mt-0.5 text-xs text-subtle">
                  {m.venue === "kalshi" ? "Kalshi" : "Polymarket"}
                  {m.volume24h ? ` · $${Math.round(m.volume24h).toLocaleString("en-US")} vol` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onYes(m)}
                  className={cn(
                    "min-h-11 rounded-full bg-up px-3 text-sm font-semibold text-up-fg",
                    busy && "opacity-50",
                  )}
                >
                  Yes {Math.round(p * 100)}¢
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onNo(m)}
                  className={cn(
                    "min-h-11 rounded-full bg-down px-3 text-sm font-semibold text-down-fg",
                    busy && "opacity-50",
                  )}
                >
                  No {Math.round((1 - p) * 100)}¢
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
