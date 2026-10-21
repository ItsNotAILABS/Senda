import type { ReactNode } from "react";

export function Spark({ points, down }: { points: number[]; down?: boolean }) {
  const vals = points.filter((n) => Number.isFinite(n));
  if (vals.length < 2) {
    const y = 28;
    return (
      <svg viewBox="0 0 320 56" className="mt-3 h-14 w-full" role="img" aria-label="One reading">
        <line x1="0" x2="320" y1={y} y2={y} stroke={down ? "#ff5d73" : "#c6f56a"} strokeWidth="2" />
      </svg>
    );
  }
  const hi = Math.max(...vals);
  const lo = Math.min(...vals);
  const span = hi - lo || Math.abs(hi) * 0.02 || 1;
  const step = 320 / (vals.length - 1);
  const d = vals
    .map((v, i) => {
      const x = i * step;
      const y = 4 + ((hi - v) / span) * 48;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const color = (vals[vals.length - 1] ?? 0) < (vals[0] ?? 0) ? "#ff5d73" : "#c6f56a";
  return (
    <svg viewBox="0 0 320 56" className="mt-3 h-14 w-full" role="img" aria-label="Mark">
      <path d={d} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function InstrumentCard({
  title,
  sub,
  value,
  change,
  logo,
  starred,
  onStar,
  onOpen,
  points,
}: {
  title: string;
  sub: string;
  value: string;
  change?: number | null;
  logo?: string;
  starred: boolean;
  onStar: () => void;
  onOpen: () => void;
  points: number[];
}) {
  const down = (change ?? 0) < 0;
  return (
    <article className="overflow-hidden rounded-[28px] border border-[#c6f56a]/20 bg-[#070b08] px-4 py-4">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          {logo ? (
            <img src={logo} alt="" className="size-11 shrink-0 rounded-full bg-white object-contain p-1.5" />
          ) : (
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-black">{title.slice(0, 2)}</span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-base font-semibold">{title}</span>
            <span className="block truncate text-xs text-white/40">{sub}</span>
          </span>
        </button>
        <button type="button" aria-label={starred ? "Unstar" : "Star"} onClick={onStar} className={starred ? "text-xl text-[#c6f56a]" : "text-xl text-white/25"}>
          ★
        </button>
      </div>
      <button type="button" onClick={onOpen} className="mt-3 block w-full text-left">
        <span className="font-mono text-3xl tabular-nums">{value}</span>
        {change == null ? (
          <span className="mt-1 block text-sm text-white/40">Open</span>
        ) : (
          <span className={down ? "mt-1 block font-mono text-sm text-[#ff5d73]" : "mt-1 block font-mono text-sm text-[#c6f56a]"}>
            {change >= 0 ? "+" : ""}
            {(change * 100).toFixed(1)}%
          </span>
        )}
        <Spark points={points} down={down} />
      </button>
    </article>
  );
}

export function AccountChart({
  label,
  windowId,
  onWindow,
  points,
  note,
}: {
  label: string;
  windowId: string;
  onWindow: (id: "15m" | "1H" | "4H" | "1D") => void;
  points: number[];
  note: string;
}) {
  const last = points[points.length - 1];
  const first = points[0];
  const down = points.length > 1 && last < first;
  return (
    <div className="mt-4">
      <div className="flex gap-2">
        {(["15m", "1H", "4H", "1D"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onWindow(id)}
            className={id === windowId ? "grid size-9 place-items-center rounded-full bg-white text-[11px] font-semibold text-black" : "grid size-9 place-items-center rounded-full bg-black/50 text-[11px] text-white/70"}
          >
            {id}
          </button>
        ))}
      </div>
      <Spark points={points} down={down} />
      <p className="mt-1 font-mono text-[11px] text-white/40">
        {label} · {windowId}
        {last != null ? ` · ${last.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""} · {note}
      </p>
    </div>
  );
}

export function CardActions({ children }: { children: ReactNode }) {
  return <div className="mt-4 grid grid-cols-4 gap-2 text-center">{children}</div>;
}
