import { formatCents } from "@/lib/markets";
import type { HistPoint } from "@/lib/street";

function fmtDay(t: number): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(t));
}

export function StreetChart({
  history,
  last,
  loading,
}: {
  history: HistPoint[];
  last: number | null;
  loading?: boolean;
}) {
  if (loading && history.length < 2) {
    return <div className="h-48 animate-pulse rounded-xl bg-elevated" />;
  }
  if (history.length < 2) {
    return (
      <div className="grid h-48 place-items-center rounded-xl bg-elevated px-4 text-center">
        <div>
          <p className="font-mono text-lg tabular-nums">{last != null ? formatCents(last) : "—"}</p>
          <p className="mt-1 text-sm text-muted">No street history on this book yet.</p>
        </div>
      </div>
    );
  }

  const ps = history.map((h) => h.p);
  const min = Math.min(...ps);
  const max = Math.max(...ps);
  const pad = Math.max(0.008, (max - min) * 0.18);
  const lo = Math.max(0, min - pad);
  const hi = Math.min(1, max + pad);
  const span = hi - lo || 0.01;
  const w = 640;
  const h = 200;
  const l = 44;
  const r = 12;
  const t = 12;
  const b = 28;
  const innerW = w - l - r;
  const innerH = h - t - b;
  const coords = history.map((p, i) => {
    const x = l + (i / (history.length - 1)) * innerW;
    const y = t + (1 - (p.p - lo) / span) * innerH;
    return { x, y };
  });
  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `${l},${t + innerH} ${line} ${l + innerW},${t + innerH}`;
  const lastPt = coords[coords.length - 1];
  const firstT = history[0].t;
  const lastT = history[history.length - 1].t;
  const midT = firstT + (lastT - firstT) / 2;

  return (
    <div className="rounded-xl bg-elevated p-3 shadow-panel sm:p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[0.65rem] tracking-[0.18em] text-subtle uppercase">7-day street</p>
        <p className="font-mono text-sm tabular-nums text-fg">
          {last != null ? formatCents(last) : formatCents(history[history.length - 1].p)}
        </p>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-44 w-full text-fg sm:h-52" role="img" aria-label="Street price history">
        <line x1={l} y1={t} x2={l} y2={t + innerH} stroke="currentColor" strokeOpacity="0.12" />
        <line x1={l} y1={t + innerH} x2={l + innerW} y2={t + innerH} stroke="currentColor" strokeOpacity="0.12" />
        <text x={4} y={t + 4} fill="currentColor" opacity="0.45" fontSize="11" fontFamily="ui-monospace, monospace">
          {formatCents(hi)}
        </text>
        <text x={4} y={t + innerH} fill="currentColor" opacity="0.45" fontSize="11" fontFamily="ui-monospace, monospace">
          {formatCents(lo)}
        </text>
        <polygon points={area} fill="currentColor" opacity="0.16" />
        <polyline
          points={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {lastPt ? <circle cx={lastPt.x} cy={lastPt.y} r="3.5" fill="currentColor" /> : null}
        <text x={l} y={h - 6} fill="currentColor" opacity="0.45" fontSize="11" fontFamily="ui-monospace, monospace">
          {fmtDay(firstT)}
        </text>
        <text
          x={l + innerW / 2}
          y={h - 6}
          textAnchor="middle"
          fill="currentColor"
          opacity="0.45"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
        >
          {fmtDay(midT)}
        </text>
        <text
          x={l + innerW}
          y={h - 6}
          textAnchor="end"
          fill="currentColor"
          opacity="0.45"
          fontSize="11"
          fontFamily="ui-monospace, monospace"
        >
          {fmtDay(lastT)}
        </text>
      </svg>
    </div>
  );
}
