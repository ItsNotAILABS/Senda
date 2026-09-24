import { formatCents, formatSpread, formatVolume, streetLast, type BookExtra } from "@/lib/markets";
import type { Venue } from "@/lib/feeds";
import { cn } from "@/lib/utils";

function Cell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 px-2 py-2 sm:px-3">
      <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">{label}</p>
      <p className={cn("truncate font-mono text-sm tabular-nums", accent ? "text-accent" : "text-fg")}>
        {value}
      </p>
    </div>
  );
}

export function formatChange(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n === 0) return "flat";
  const cents = n * 100;
  const sign = cents > 0 ? "+" : "";
  return `${sign}${cents.toFixed(1)}¢`;
}

export function BookStrip({
  book,
  venue,
  streetYes,
  volume,
}: {
  book: BookExtra;
  venue: Venue;
  streetYes: number;
  volume: number;
}) {
  const bid = book.bidYes;
  const ask = book.askYes;
  const last = streetLast({ lastYes: book.lastYes, streetYes });
  const vol = book.volume24h > 0 ? book.volume24h : volume;
  const chg = formatChange(book.change24h);
  const down = (book.change24h ?? 0) < 0;
  const spread = book.spread ?? (bid != null && ask != null ? ask - bid : null);

  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl bg-elevated shadow-panel sm:grid-cols-4 lg:grid-cols-8">
      <Cell label="Last" value={formatCents(last)} />
      <Cell label="Bid" value={bid != null ? formatCents(bid) : "—"} />
      <Cell label="Ask" value={ask != null ? formatCents(ask) : "—"} />
      <Cell label="Spread" value={formatSpread(spread)} />
      <Cell label="24h" value={formatVolume(vol, venue)} />
      <Cell label="Δ 24h" value={chg} accent={down} />
      <Cell label="OI" value={book.openInterest > 0 ? formatVolume(book.openInterest, venue) : "—"} />
      <Cell label="Liq" value={book.liquidity > 0 ? formatVolume(book.liquidity, venue) : "—"} />
    </div>
  );
}
