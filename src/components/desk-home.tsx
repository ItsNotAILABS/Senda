import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { type WrapperPair } from "@/lib/basis";
import { cheaperVenue, structureOf, wrapLine } from "@/lib/explain";
import { markHouse, type HouseBook } from "@/lib/house-paper";
import { BUY_IN_CHIPS, formatChips } from "@/lib/markets";
import { formatChg, formatPremium, formatUsd, type HouseListing, type HouseVenue } from "@/lib/sol-house";
import { cn } from "@/lib/utils";

type Filter = "all" | HouseVenue;

export function DeskHome({
  house,
  pairs,
  book,
  chips,
  frozen,
  busy,
  filter,
  onFilter,
  onStart,
}: {
  house: HouseListing[];
  pairs: WrapperPair[];
  book: HouseBook;
  chips: number;
  frozen: boolean;
  busy: boolean;
  filter: Filter;
  onFilter: (f: Filter) => void;
  onStart: () => void;
}) {
  const rows = house.filter((r) => (filter === "all" ? true : r.venue === filter));
  const mtm = house.reduce((s, r) => s + markHouse(book[r.id], r.last), 0);
  const cost = house.reduce((s, r) => s + (book[r.id]?.cost ?? 0), 0);
  const pnl = mtm - cost;
  const empty = chips <= 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-5 sm:px-6 sm:py-8">
      <header className="space-y-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Paper desk for tokenized pre-IPO
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted">
          These tokens track private companies. Last is the DEX price. Mark is the
          private reference. They are not shares. This book is paper — live prices,
          no real money.
        </p>
        {empty ? (
          <button
            type="button"
            disabled={frozen || busy}
            onClick={onStart}
            className="min-h-12 w-full rounded-xl bg-fg px-4 font-display text-base font-semibold text-bg sm:w-auto sm:px-6"
          >
            Start with ${formatChips(BUY_IN_CHIPS)} paper
          </button>
        ) : (
          <p className="font-mono text-sm tabular-nums text-muted" suppressHydrationWarning>
            ${formatChips(chips)} paper
            {cost !== 0 ? (
              <span className={cn("ml-2", pnl < 0 ? "text-accent" : "text-fg")}>
                · book {pnl >= 0 ? "+" : ""}
                {pnl.toFixed(0)}
              </span>
            ) : null}
          </p>
        )}
      </header>

      <ol className="grid gap-2 sm:grid-cols-3">
        {[
          { n: "1", t: "Get paper", b: "One tap funds a $1,000 practice book." },
          { n: "2", t: "Open a name", b: "Read last vs mark. That is the premium." },
          { n: "3", t: "Buy or short", b: "Paper inventory, marked to last." },
        ].map((s) => (
          <li key={s.n} className="rounded-xl bg-elevated px-4 py-3 shadow-panel">
            <p className="font-mono text-xs tracking-wide text-subtle">{s.n}</p>
            <p className="mt-1 font-display text-base font-semibold">{s.t}</p>
            <p className="mt-0.5 text-sm text-muted">{s.b}</p>
          </li>
        ))}
      </ol>

      {pairs.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">Same company, two wrappers</h2>
          <p className="text-sm text-muted">
            Dollar last is not comparable. Implied company value is.
          </p>
          <div className="flex flex-col gap-2">
            {pairs.map((p) => {
              const cheap = cheaperVenue(p);
              const href = p.tessera?.id ?? p.prestocks?.id;
              if (!href) return null;
              return (
                <Link
                  key={p.family}
                  to="/house/$id"
                  params={{ id: href }}
                  className="block rounded-xl bg-elevated px-4 py-3 shadow-panel transition-transform duration-150 ease-out active:scale-[0.99]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-display text-base font-semibold">{p.label}</p>
                    {cheap ? (
                      <p className="font-mono text-xs tracking-wide text-muted uppercase">{cheap} cheaper</p>
                    ) : (
                      <p className="font-mono text-xs tracking-wide text-subtle uppercase">even</p>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-muted">{wrapLine(p)}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-fg">
                    Open {p.tessera?.symbol}
                    <ArrowRight className="size-3.5" strokeWidth={1.75} />
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="font-display text-lg font-semibold tracking-tight">Names</h2>
          <div className="flex gap-1" role="tablist" aria-label="Venue">
            {(
              [
                ["all", "All"],
                ["tessera", "Tessera"],
                ["prestocks", "PreStocks"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => onFilter(id)}
                className={cn(
                  "min-h-11 rounded-lg px-3 text-sm",
                  filter === id ? "bg-elevated text-fg shadow-panel" : "text-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-elevated" />
            <div className="h-16 animate-pulse rounded-xl bg-elevated" />
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((stock) => {
              const pos = book[stock.id];
              const held = pos && pos.shares !== 0;
              return (
                <li key={stock.id}>
                  <Link
                    to="/house/$id"
                    params={{ id: stock.id }}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-elevated px-4 py-3 shadow-panel transition-transform duration-150 ease-out active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold">
                        {stock.symbol}
                        {held ? (
                          <span className="ml-2 font-mono text-xs font-normal tracking-wide text-subtle uppercase">
                            {pos.shares > 0 ? "long" : "short"}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-muted">
                        {structureOf(stock)} · {stock.sector}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-base tabular-nums">{formatUsd(stock.last)}</p>
                      <p
                        className={cn(
                          "font-mono text-xs tabular-nums",
                          (stock.premium ?? 0) > 0 ? "text-accent" : "text-muted",
                        )}
                      >
                        {formatPremium(stock.premium)} to mark · {formatChg(stock.change24h)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

