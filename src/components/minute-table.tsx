import { useEffect, useMemo, useState } from "react";
import type { HouseListing } from "@/lib/sol-house";
import { formatChg, formatUsd } from "@/lib/sol-house";
import {
  MINUTE_PAYS,
  formatClock,
  minuteId,
  minuteOpen,
  openBetsFor,
  remainingMs,
  type MinuteBet,
  type MinuteSide,
} from "@/lib/minute-book";
import { cn } from "@/lib/utils";

export function pickFeatured(
  rows: HouseListing[],
  chg1m: Record<string, number | null>,
  now: number,
): HouseListing | null {
  if (rows.length === 0) return null;
  const scored = [...rows].sort((a, b) => {
    const da = Math.abs(chg1m[a.id] ?? 0);
    const db = Math.abs(chg1m[b.id] ?? 0);
    return db - da || b.liquidity - a.liquidity;
  });
  const mover = scored.find((r) => Math.abs(chg1m[r.id] ?? 0) > 0);
  return mover ?? scored[minuteId(now) % scored.length] ?? scored[0];
}

export function MinuteRail({
  rows,
  spend,
  busy,
  chg1m,
  onBet,
}: {
  rows: HouseListing[];
  spend: number;
  busy: boolean;
  chg1m: Record<string, number | null>;
  onBet: (stock: HouseListing, side: MinuteSide, open: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [bets, setBets] = useState<MinuteBet[]>([]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setBets(openBetsFor(minuteId(now)));
  }, [now]);

  const featured = useMemo(() => pickFeatured(rows, chg1m, now), [rows, chg1m, now]);
  const left = remainingMs(now);
  const urgent = left < 10_000;
  const open = featured ? minuteOpen(featured.id, featured.last) : 0;
  const last = featured?.last ?? 0;
  const move = open > 0 && last > 0 ? (last - open) / open : null;

  if (!featured) {
    return (
      <div className="rounded-xl bg-elevated px-3 py-2 text-sm text-muted shadow-panel">
        Waiting on the first print this minute.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-elevated px-3 py-2 shadow-panel">
      <div className="flex items-center gap-2">
        <div className="w-14 shrink-0 text-center">
          <p
            className={cn(
              "font-display text-2xl font-semibold tabular-nums leading-none",
              urgent && "clock-urgent",
            )}
          >
            {formatClock(left)}
          </p>
          <p className="mt-0.5 font-mono text-[0.65rem] tracking-wider text-subtle uppercase">
            {MINUTE_PAYS.toFixed(1)}×
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold tracking-tight">{featured.symbol}</p>
          <p className={cn("font-mono text-[0.65rem] tabular-nums", (move ?? 0) < 0 ? "text-accent" : "text-muted")}>
            {formatUsd(last)} · {formatChg(move)} · vs {formatUsd(open)}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onBet(featured, "up", open)}
          className="min-h-11 min-w-14 rounded-lg bg-fg px-3 font-display text-sm font-semibold text-bg transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50"
        >
          Up
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onBet(featured, "down", open)}
          className="min-h-11 min-w-14 rounded-lg border border-border bg-bg px-3 font-display text-sm font-semibold text-accent transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-50"
        >
          Down
        </button>
      </div>
      {bets.length > 0 ? (
        <p className="mt-1 truncate font-mono text-[0.65rem] text-muted">
          In: {bets.map((b) => `${b.symbol} ${b.side.toUpperCase()} ${b.spend}`).join(" · ")}
        </p>
      ) : (
        <p className="sr-only">
          {spend} chips vs this minute’s open
        </p>
      )}
    </div>
  );
}
