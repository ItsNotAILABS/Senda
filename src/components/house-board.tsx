import type { Side } from "@/lib/lmsr";
import { markHouse, type HouseBook } from "@/lib/house-paper";
import type { MinuteSide } from "@/lib/minute-book";
import { formatPays, parlayPays, type ParlayLeg } from "@/lib/parlay-book";
import {
  formatChg,
  formatUsd,
  type HouseListing,
} from "@/lib/sol-house";
import { cn } from "@/lib/utils";

export type BoardPlay = "spot" | "minute" | "parlay";

const CELL_SYMS = [
  "KALSHI",
  "OPENAI",
  "SPACEX",
  "ANTHROPIC",
  "ANDURIL",
  "POLYMARKET",
  "NEURALINK",
  "FIGUREAI",
] as const;

export const OUTSIDE: Array<{ id: string; label: string; symbols: string[] }> = [
  { id: "ai", label: "AI", symbols: ["OPENAI", "ANTHROPIC"] },
  { id: "aero", label: "Aero", symbols: ["SPACEX", "ANDURIL"] },
  { id: "pred", label: "Pred", symbols: ["KALSHI", "POLYMARKET"] },
];

function findSym(rows: HouseListing[], sym: string): HouseListing | undefined {
  const u = sym.toUpperCase();
  return rows.find((r) => r.symbol.toUpperCase() === u);
}

function shortSym(s: string): string {
  return s.replace(/^T-/, "T-");
}

function Pocket({
  stock,
  play,
  busy,
  flash,
  chg1m,
  slipSide,
  onSpot,
  onMinute,
  onToggle,
}: {
  stock: HouseListing | null;
  play: BoardPlay;
  busy: boolean;
  flash: Side | null;
  chg1m: number | null;
  slipSide: MinuteSide | null;
  onSpot: (side: Side) => void;
  onMinute: (side: MinuteSide) => void;
  onToggle: (side: MinuteSide) => void;
}) {
  if (!stock) {
    return <div className="min-h-14 rounded-md bg-felt-ink/40 sm:min-h-16" />;
  }
  const down = (chg1m ?? stock.change24h ?? 0) < 0;
  const parlay = play === "parlay";
  const chg = chg1m ?? stock.change24h;

  function hit(side: MinuteSide) {
    if (parlay) onToggle(side);
    else if (play === "minute") onMinute(side);
    else onSpot(side === "up" ? "yes" : "no");
  }

  return (
    <div
      className={cn(
        "flex min-h-14 overflow-hidden rounded-md border border-fg/10 bg-felt-ink/55 sm:min-h-16",
        flash === "yes" && "ring-2 ring-fg",
        flash === "no" && "ring-2 ring-accent",
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => hit("up")}
        aria-label={`${stock.symbol} ${parlay ? "add up" : play === "minute" ? "up" : "long"}`}
        aria-pressed={slipSide === "up"}
        className={cn(
          "flex min-h-14 min-w-0 flex-1 flex-col items-start justify-center px-1.5 py-1 text-left sm:min-h-16 sm:px-2",
          "transition-[background-color,color,transform] duration-150 ease-out active:not-disabled:scale-[0.96]",
          slipSide === "up" ? "bg-fg text-bg" : "text-fg hover:bg-fg/10",
          busy && "opacity-50",
        )}
      >
        <span className="w-full truncate font-display text-xs font-semibold leading-tight tracking-tight sm:text-sm">
          {shortSym(stock.symbol)}
        </span>
        <span
          className={cn(
            "font-mono text-[0.65rem] tabular-nums leading-none",
            slipSide === "up" ? "text-bg/70" : down ? "text-accent" : "text-muted",
          )}
        >
          {formatUsd(stock.last)} {formatChg(chg)}
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => hit("down")}
        aria-label={`${stock.symbol} ${parlay ? "add fade" : play === "minute" ? "down" : "fade"}`}
        aria-pressed={slipSide === "down"}
        className={cn(
          "flex min-h-14 w-11 shrink-0 flex-col items-center justify-center border-l border-fg/10 sm:min-h-16",
          "font-display text-[0.65rem] font-semibold tracking-tight",
          "transition-[background-color,color,transform] duration-150 ease-out active:not-disabled:scale-[0.96]",
          slipSide === "down" ? "bg-accent text-accent-fg" : "text-accent hover:bg-accent/15",
          busy && "opacity-50",
        )}
      >
        {parlay ? "DN" : play === "minute" ? "DN" : "F"}
      </button>
    </div>
  );
}

export function HouseBoard({
  rows,
  play,
  spend,
  busyId,
  flash,
  chg1m,
  book,
  slip,
  onSpot,
  onMinute,
  onToggle,
  onOutside,
  onDropParlay,
  onClear,
}: {
  rows: HouseListing[];
  play: BoardPlay;
  spend: number;
  busyId: string | null;
  flash: { id: string; side: Side } | null;
  chg1m: Record<string, number | null>;
  book: HouseBook;
  slip: ParlayLeg[];
  onSpot: (stock: HouseListing, side: Side) => void;
  onMinute: (stock: HouseListing, side: MinuteSide) => void;
  onToggle: (stock: HouseListing, side: MinuteSide) => void;
  onOutside: (symbols: string[], side: MinuteSide) => void;
  onDropParlay: () => void;
  onClear: () => void;
}) {
  const mtm = rows.reduce((s, r) => s + markHouse(book[r.id], r.last), 0);
  const cost = rows.reduce((s, r) => s + (book[r.id]?.cost ?? 0), 0);
  const pnl = mtm - cost;
  const byId = new Map(slip.map((l) => [l.marketId, l.side]));
  const cells = CELL_SYMS.map((sym) => findSym(rows, sym) ?? null);
  const parlay = play === "parlay";
  const mult = parlayPays(slip.length);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-elevated px-4 py-8 text-center text-sm text-muted">
        No live names on this tape yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1">
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">
          {parlay ? "Parlay board · skill, not a spin" : play === "minute" ? "This minute" : "Spot"}
        </p>
        <p
          className={cn("font-mono text-[0.65rem] tabular-nums uppercase", pnl < 0 ? "text-accent" : "text-muted")}
          suppressHydrationWarning
        >
          Paper P&L {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(1)}
        </p>
      </div>

      <div className="felt-surface rounded-2xl p-2 shadow-panel sm:p-3">
        <p className="mb-2 px-1 font-mono text-[0.6rem] tracking-[0.18em] text-fg/50 uppercase">
          Left is up · right is fade
        </p>
        <div className="grid grid-cols-3 gap-1">
          {cells.map((stock, i) => (
            <Pocket
              key={stock?.id ?? `empty-${i}`}
              stock={stock}
              play={play}
              busy={
                stock
                  ? busyId?.startsWith(`${stock.id}:`) || busyId?.startsWith(`min:${stock.id}:`) || busyId === "parlay"
                    ? true
                    : false
                  : false
              }
              flash={stock && flash?.id === stock.id ? flash.side : null}
              chg1m={stock ? (chg1m[stock.id] ?? null) : null}
              slipSide={stock ? (byId.get(stock.id) ?? null) : null}
              onSpot={(side) => stock && onSpot(stock, side)}
              onMinute={(side) => stock && onMinute(stock, side)}
              onToggle={(side) => stock && onToggle(stock, side)}
            />
          ))}
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1">
          {OUTSIDE.map((g) => {
            const loaded =
              g.symbols.every((s) => {
                const row = findSym(rows, s);
                return row && byId.get(row.id) === "up";
              }) && g.symbols.length > 0;
            const faded =
              g.symbols.every((s) => {
                const row = findSym(rows, s);
                return row && byId.get(row.id) === "down";
              }) && g.symbols.length > 0;
            return (
              <button
                key={g.id}
                type="button"
                disabled={!parlay}
                onClick={() => onOutside(g.symbols, faded ? "up" : loaded ? "down" : "up")}
                className={cn(
                  "min-h-11 rounded-md border border-fg/10 px-1 font-display text-xs font-semibold tracking-tight",
                  "transition-[background-color,color,transform] duration-150 ease-out active:not-disabled:scale-[0.96]",
                  loaded
                    ? "bg-fg text-bg"
                    : faded
                      ? "bg-accent text-accent-fg"
                      : "bg-felt-ink/70 text-fg/80 hover:bg-felt-ink",
                  !parlay && "opacity-40",
                )}
              >
                {g.label}
                <span className="mt-0.5 block font-mono text-[0.6rem] font-normal opacity-70">
                  {formatPays(parlayPays(g.symbols.length))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {parlay ? (
        <div className="sticky bottom-2 z-20 rounded-xl bg-elevated p-3 shadow-panel">
          {slip.length === 0 ? (
            <p className="text-sm text-muted">
              Tap a name to load a leg. Tap the red strip to fade it. Outside is a 3-leg street.
              All legs have to finish this minute your way.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-[0.65rem] tracking-[0.16em] text-subtle uppercase">
                {slip.length}-leg · {formatPays(mult)} · {spend} chips
              </p>
              <p className="text-sm text-fg">
                {slip.map((l) => `${l.symbol} ${l.side === "up" ? "UP" : "DN"}`).join(" · ")}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId !== null}
                  onClick={onDropParlay}
                  className="min-h-11 flex-1 rounded-lg bg-fg font-display text-sm font-semibold text-bg transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50"
                >
                  Drop {spend} · {formatPays(mult)}
                </button>
                <button
                  type="button"
                  onClick={onClear}
                  className="min-h-11 rounded-lg bg-bg px-4 text-sm text-muted hover:text-fg"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="px-1 font-mono text-[0.65rem] tracking-wide text-subtle uppercase">
          Size {spend} · last $ · paper fill · not a Jupiter fill
        </p>
      )}
    </div>
  );
}
