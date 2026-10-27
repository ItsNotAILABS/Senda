import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { HoldMove } from "@/lib/hold-tape";

export type HoldingRow = {
  mint: string;
  symbol: string;
  name: string;
  qty: number;
  value: number;
  where: "share" | "pre" | "coin" | "cash";
};

function qty(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function usd(n: number): string {
  if (!(n > 0)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 });
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function HoldingCards({ rows, moves, className }: { rows: HoldingRow[]; moves: Record<string, HoldMove>; className?: string }) {
  if (!rows.length) return null;
  return (
    <ul className={cn("mt-3 grid gap-2 sm:grid-cols-2", className)}>
      {rows.map((row) => {
        const move = moves[row.mint];
        const value = row.value > 0 ? row.value : move?.price ? row.qty * move.price : 0;
        const day = move?.day ?? null;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold">{row.symbol}</span>
              <span className="font-mono text-sm tabular-nums">{usd(value)}</span>
            </span>
            <span className="mt-1 block truncate text-xs text-white/45">{row.name}</span>
            <span className="mt-1 block font-mono text-[11px] text-white/55">{qty(row.qty)} held</span>
            <span className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px] tabular-nums">
              <span>
                <span className="block text-white/35">Hour</span>
                <span className={cn((move?.hour ?? 0) < 0 ? "text-down" : "text-up")}>{pct(move?.hour ?? null)}</span>
              </span>
              <span>
                <span className="block text-white/35">Day</span>
                <span className={cn((day ?? 0) < 0 ? "text-down" : "text-up")}>{pct(day)}</span>
              </span>
              <span>
                <span className="block text-white/35">Week</span>
                <span className={cn((move?.week ?? 0) < 0 ? "text-down" : "text-up")}>{pct(move?.week ?? null)}</span>
              </span>
            </span>
          </>
        );
        const cls = "block rounded-[22px] border border-white/10 bg-black/30 px-3 py-3";
        if (row.where === "share") {
          return (
            <li key={row.mint}>
              <Link to="/equities" className={cls}>{body}</Link>
            </li>
          );
        }
        if (row.where === "pre") {
          return (
            <li key={row.mint}>
              <Link to="/pre" className={cls}>{body}</Link>
            </li>
          );
        }
        if (row.where === "coin") {
          return (
            <li key={row.mint}>
              <Link to="/invest" search={{ desk: "tape" }} className={cls}>{body}</Link>
            </li>
          );
        }
        return (
          <li key={row.mint}>
            <div className={cls}>{body}</div>
          </li>
        );
      })}
    </ul>
  );
}
