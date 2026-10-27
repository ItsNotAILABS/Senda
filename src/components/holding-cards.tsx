import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { HoldMove } from "@/lib/hold-tape";
import type { TokenMark } from "@/lib/token-mark";

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

export function LineGlance({ points, down }: { points: number[]; down: boolean }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 30 - ((p - min) / span) * 26;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="mt-3 h-8 w-full" aria-hidden>
      <path d={d} fill="none" stroke={down ? "var(--color-down)" : "var(--color-accent)"} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function VolumeBars({ points }: { points: number[] }) {
  if (points.filter((n) => n > 0).length < 2) return null;
  const max = Math.max(...points, 1);
  return (
    <span className="mt-2 flex h-8 items-end gap-px" aria-hidden>
      {points.map((n, i) => (
        <span key={i} className="min-w-0 flex-1 rounded-sm bg-white/35" style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function money(n: number): string {
  if (!(n > 0)) return "";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function MarkFace({ icon, symbol }: { icon?: string; symbol: string }) {
  if (icon) {
    return <img src={icon} alt="" className="size-9 rounded-full bg-white object-cover" />;
  }
  return <span className="grid size-9 place-items-center rounded-full bg-white text-[10px] font-bold text-black">{symbol.slice(0, 2)}</span>;
}

export function HoldingCards({
  rows,
  moves,
  marks = {},
  className,
  activeMint,
  onOpen,
}: {
  rows: HoldingRow[];
  moves: Record<string, HoldMove>;
  marks?: Record<string, TokenMark>;
  className?: string;
  activeMint?: string;
  onOpen?: (row: HoldingRow) => void;
}) {
  if (!rows.length) return null;
  return (
    <ul className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {rows.map((row) => {
        const move = moves[row.mint];
        const value = row.value > 0 ? row.value : move?.price ? row.qty * move.price : 0;
        const day = move?.day ?? null;
        const mark = marks[row.mint];
        const on = activeMint === row.mint;
        const body = (
          <>
            <span className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2">
                <MarkFace icon={mark?.icon} symbol={row.symbol} />
                <span>
                  <span className="block text-[10px] tracking-[0.14em] text-white/40 uppercase">{row.name}</span>
                  <span className="mt-0.5 block text-lg font-semibold tracking-tight">{row.symbol}</span>
                </span>
              </span>
              <span className={cn("rounded-full px-2 py-1 font-mono text-[11px] tabular-nums", (day ?? 0) < 0 ? "bg-down/15 text-down" : "bg-accent/15 text-accent")}>
                {pct(day)}
              </span>
            </span>
            <span className="mt-3 block font-mono text-2xl tabular-nums tracking-tight">{move?.price ? usd(move.price) : "—"}</span>
            <span className="mt-1 block font-mono text-[11px] text-white/40">{qty(row.qty)} · {usd(value)}</span>
            {mark?.line && mark.line.length > 1 ? (
              <LineGlance points={mark.line} down={(day ?? mark.line[mark.line.length - 1] - mark.line[0]) < 0} />
            ) : (
              <span className="mt-3 block h-8 text-[10px] text-white/30">No hourly print</span>
            )}
            <VolumeBars points={mark?.volume || []} />
            <span className="mt-1 block font-mono text-[10px] text-white/40">
              {mark?.poolVol ? `24h ${mark.poolDex || "pool"} ${money(mark.poolVol)}` : mark?.vol24 ? `24h chart ${money(mark.vol24)}` : "No 24h volume"}
            </span>
            <span className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-2 font-mono text-[11px] tabular-nums">
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
        const cls = cn(
          "block w-full rounded-2xl border bg-[#12151e] px-3 py-3 text-left",
          on ? "border-accent" : "border-white/10 hover:border-white/25",
        );
        if (onOpen) {
          return (
            <li key={row.mint} className="min-w-[230px] snap-start lg:min-w-0">
              <button type="button" onClick={() => onOpen(row)} className={cls}>{body}</button>
            </li>
          );
        }
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