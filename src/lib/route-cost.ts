/** Compare two Jupiter outputs. The saving is this quote, not a fee table. */

export function quoteEdge(directOut: number, hopOut: number) {
  if (!(directOut > 0) || !(hopOut > 0)) return null;
  const routed = hopOut >= directOut;
  const best = routed ? hopOut : directOut;
  const other = routed ? directOut : hopOut;
  const bps = ((best - other) / other) * 10_000;
  const lane = bps < 0.5 ? "same" : routed ? "routed" : "direct";
  return { lane, bps, best, other } as const;
}

export function feeDrag(usd: number, bps: number) {
  if (!(usd > 0) || !(bps > 0)) return 0;
  return (usd * bps) / 10_000;
}

/** Equal slices. The last one keeps the cents. Nothing is sent. */
export function sliceUsd(usd: number, count = 4): number[] {
  const n = Math.min(4, Math.max(2, Math.round(count)));
  if (!(usd > 0)) return [];
  const each = Math.floor((usd / n) * 100) / 100;
  const rows = Array.from({ length: n - 1 }, () => each);
  const last = Math.round((usd - each * (n - 1)) * 100) / 100;
  return [...rows, last].filter((n) => n >= 0.5);
}
