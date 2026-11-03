/** A line of marks this screen has actually received. No invented history. */

export function MarkChart({ points, label }: { points: number[]; label: string }) {
  if (points.length < 2) {
    return <div className="grid h-24 place-items-center rounded-2xl bg-black/30 text-xs text-white/40">{label}</div>;
  }
  const w = 320;
  const h = 96;
  const hi = Math.max(...points);
  const lo = Math.min(...points);
  const span = hi - lo || hi * 0.002 || 1;
  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 8 - ((p - lo) / span) * (h - 16);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = points[points.length - 1] >= points[0];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full rounded-2xl bg-black/30" role="img" aria-label={label}>
      <path d={d} fill="none" stroke={up ? "#c6f56a" : "#ff5d73"} strokeWidth="2" />
    </svg>
  );
}
