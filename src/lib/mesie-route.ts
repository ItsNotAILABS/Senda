/**
 * Route gate from MESIE v0.4 (Apache-2.0, Alfredo Medina).
 * Ported from mesie/features/coherence.py, mesie/matching/metrics.py,
 * and mesie/features/resonance.py. No audio, no latency claim.
 * A route is a 3-bin spectrum: output, impact, quote time.
 */

export type RouteBin = { out: number; impact: number; ms: number };

export type RouteSpectrum = {
  coherence: number;
  cosine: number;
  logDistance: number;
  resonance: number[];
  keep: boolean[];
};

const EPS = 1e-12;

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom <= EPS) return 0;
  return dot / denom;
}

/** 1 / (1 + mean column std). One row returns 1, matching compute_coherence. */
export function coherence(rows: number[][]): number {
  if (rows.length <= 1) return 1;
  const width = rows[0]?.length ?? 0;
  if (!width) return 1;
  let stdSum = 0;
  for (let col = 0; col < width; col += 1) {
    let mean = 0;
    for (const row of rows) mean += row[col];
    mean /= rows.length;
    let acc = 0;
    for (const row of rows) {
      const d = row[col] - mean;
      acc += d * d;
    }
    stdSum += Math.sqrt(acc / rows.length);
  }
  return 1 / (1 + stdSum / width);
}

export function logSpectralDistance(a: number[], b: number[]): number {
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) {
    acc += Math.abs(Math.log(Math.abs(a[i]) + EPS) - Math.log(Math.abs(b[i]) + EPS));
  }
  return acc / a.length;
}

/** Peak-to-mean. find_resonance_peaks treats a peak at or above 2 as resonant. */
export function resonance(row: number[]): number {
  let sum = 0;
  let peak = 0;
  for (const n of row) {
    const v = Math.abs(n);
    sum += v;
    if (v > peak) peak = v;
  }
  const mean = Math.max(sum / Math.max(row.length, 1), EPS);
  return peak / mean;
}

function shape(rows: RouteBin[]): number[][] {
  const bestOut = Math.max(...rows.map((row) => row.out), EPS);
  const raw = rows.map((row) => [row.out / bestOut, 1 / (1 + Math.abs(row.impact)), 1 / (1 + row.ms / 1000)]);
  return raw.map((row) => row.map((value, col) => {
    let peak = EPS;
    for (const other of raw) peak = Math.max(peak, other[col]);
    return value / peak;
  }));
}

/** Drop a route whose spectrum peaks at 2× its own mean when a flatter route also quoted. */
export function readRoutes(rows: RouteBin[]): RouteSpectrum {
  const amp = shape(rows);
  const pair = amp.length >= 2 ? cosineSimilarity(amp[0], amp[1]) : 1;
  const distance = amp.length >= 2 ? logSpectralDistance(amp[0], amp[1]) : 0;
  const peaks = amp.map(resonance);
  const flatter = peaks.some((n) => n < 2);
  const keep = peaks.map((n) => (flatter ? n < 2 : true));
  return { coherence: coherence(amp), cosine: pair, logDistance: distance, resonance: peaks, keep };
}
