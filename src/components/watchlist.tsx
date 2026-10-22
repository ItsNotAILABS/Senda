import { NameCard } from "@/components/name-card";
import { markHouse, type HouseBook } from "@/lib/house-paper";
import type { HouseListing } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export type DeskMode = "spot" | "minty" | "book" | "options" | "wrap" | "curve" | "perps" | "basket" | "lend" | "eco";

export function Watchlist({
  rows,
  book,
}: {
  rows: HouseListing[];
  busyId?: string | null;
  flash?: { id: string; side: string } | null;
  book: HouseBook;
  onLong?: (stock: HouseListing) => void;
  onFade?: (stock: HouseListing) => void;
  onInsure?: (stock: HouseListing) => void;
}) {
  const mtm = rows.reduce((s, r) => s + markHouse(book[r.id], r.last), 0);
  const cost = rows.reduce((s, r) => s + (book[r.id]?.cost ?? 0), 0);
  const pnl = mtm - cost;
  const held = rows.filter((r) => (book[r.id]?.shares ?? 0) !== 0);

  if (rows.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted">Waiting on live names.</p>;
  }

  return (
    <div className="px-3 pb-4">
      {held.length > 0 ? (
        <div className="flex items-baseline justify-between px-1 pb-3">
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            {held.length} holding{held.length === 1 ? "" : "s"}
          </p>
          <p className={cn("font-mono text-xs font-semibold", pnl < 0 ? "text-down" : "text-up")} suppressHydrationWarning>
            {pnl >= 0 ? "+" : ""}
            {pnl.toFixed(2)}
          </p>
        </div>
      ) : (
        <p className="px-1 pb-3 text-xs font-medium tracking-wide text-subtle uppercase">
          PreStocks lineup · last vs mark
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {rows.map((stock) => (
          <NameCard key={stock.id} stock={stock} protectHref />
        ))}
      </div>
    </div>
  );
}
