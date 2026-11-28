/** A line of marks this screen has actually received. No invented history. */

import { useId } from "react";

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

/** Closes from the last day. High and low are labeled. No invented path. */
export function DayChart({ points, highText, lowText, empty = "The last day has not come back." }: { points: number[]; highText: string; lowText: string; empty?: string }) {
  const id = useId().replace(/:/g, "");
  if (points.length < 2) {
    return <div className="grid h-40 place-items-center rounded-2xl bg-black/40 px-6 text-center text-xs text-white/40">{empty}</div>;
  }
  const w = 320;
  const h = 148;
  const hi = Math.max(...points);
  const lo = Math.min(...points);
  const span = hi - lo || hi * 0.002 || 1;
  const xy = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = 28 + (h - 52) - ((p - lo) / span) * (h - 52);
    return [x, y] as const;
  });
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  const up = points[points.length - 1] >= points[0];
  const stroke = up ? "#c6f56a" : "#ff5d73";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" role="img" aria-label={`Last day. High ${highText}. Low ${lowText}.`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="1" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={stroke} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <text x="12" y={h - 10} fill="rgba(255,255,255,0.55)" fontSize="11">Low {lowText}</text>
      <text x={w - 12} y="16" textAnchor="end" fill="rgba(255,255,255,0.55)" fontSize="11">High {highText}</text>
    </svg>
  );
}
