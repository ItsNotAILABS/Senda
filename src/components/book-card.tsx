import { BetPad } from "@/components/bet-pad";
import { formatChange } from "@/components/book-strip";
import { Button } from "@/components/ui/button";
import { venueLabel, type LiveMarket, type Venue } from "@/lib/feeds";
import type { Side } from "@/lib/lmsr";
import {
  formatCents,
  formatDate,
  formatSpread,
  formatVolume,
  spreadOf,
  streetLast,
} from "@/lib/markets";
import type { MarketView } from "@/lib/pit";
import { cn } from "@/lib/utils";

export type FloorBook = LiveMarket | MarketView;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[0.6rem] tracking-wider text-subtle uppercase">{label}</p>
      <p className="truncate font-mono text-xs tabular-nums text-fg sm:text-sm">{value}</p>
    </div>
  );
}

export function BookCard({
  book,
  frozen,
  spend,
  busy,
  flash,
  stackYes,
  stackNo,
  hot,
  onDrop,
  onOpen,
}: {
  book: FloorBook;
  frozen: boolean;
  spend: number | null;
  busy: boolean;
  flash: Side | null;
  stackYes: number[];
  stackNo: number[];
  hot?: boolean;
  onDrop: (side: Side) => void;
  onOpen: () => void;
}) {
  const last = streetLast(book);
  const bid = book.bidYes ?? null;
  const ask = book.askYes ?? null;
  const vol = ("volume24h" in book ? book.volume24h : 0) || book.volume;
  const chg = "change24h" in book ? book.change24h : null;
  const spread = ("spread" in book ? book.spread : null) ?? spreadOf(bid, ask);
  const desc = ("description" in book ? book.description : "") || "";
  const oi = "openInterest" in book ? book.openInterest : 0;
  const liq = "liquidity" in book ? book.liquidity : 0;
  const resolveBy = "resolveBy" in book ? book.resolveBy : "";

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl bg-elevated p-4 shadow-panel sm:p-5",
        hot && "ring-1 ring-fg/20",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
            {venueLabel(book.venue)}
            {resolveBy ? ` · ${formatDate(resolveBy)}` : ""}
          </p>
          <h3 className="mt-1.5 font-display text-xl font-semibold tracking-tight text-balance sm:text-2xl">
            {book.question}
          </h3>
          {desc ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{desc}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-3xl font-semibold tabular-nums leading-none sm:text-4xl">
            {(last * 100).toFixed(1)}
          </p>
          <p className="mt-1 font-mono text-[0.65rem] tracking-[0.16em] text-subtle uppercase">YES ¢</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
        <Stat label="Last" value={formatCents(last)} />
        <Stat
          label="Bid / ask"
          value={bid != null && ask != null ? `${formatCents(bid)} / ${formatCents(ask)}` : "—"}
        />
        <Stat label="Spread" value={formatSpread(spread)} />
        <Stat label="24h" value={formatVolume(vol, book.venue as Venue)} />
        <Stat label="Δ 24h" value={formatChange(chg)} />
        <Stat
          label="OI / liq"
          value={
            oi > 0 || liq > 0
              ? `${oi > 0 ? formatVolume(oi, book.venue as Venue) : "—"} / ${liq > 0 ? formatVolume(liq, book.venue as Venue) : "—"}`
              : "—"
          }
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BetPad
          side="yes"
          price={last}
          spend={spend}
          disabled={frozen}
          busy={busy}
          flash={flash === "yes"}
          variant="row"
          padKey={`${book.id}-yes`}
          stack={stackYes}
          onDrop={() => onDrop("yes")}
        />
        <BetPad
          side="no"
          price={1 - last}
          spend={spend}
          disabled={frozen}
          busy={busy}
          flash={flash === "no"}
          variant="row"
          padKey={`${book.id}-no`}
          stack={stackNo}
          onDrop={() => onDrop("no")}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
          Paper chips · street ¢
        </p>
        <Button type="button" variant="secondary" size="sm" className="min-h-11" disabled={busy} onClick={onOpen}>
          Open book
        </Button>
      </div>
    </article>
  );
}
