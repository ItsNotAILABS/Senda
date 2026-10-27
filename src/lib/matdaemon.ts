/** Bounded matmul from MatDaemon (MIT, ItsNotAILABS). A score, not a fill time. */

const BOUND = 16;
const TOP_K_MAX = 8;
const TOP_ROWS = 32;

export function matmul(a: number[][], b: number[][]): number[][] {
  if (a.length > BOUND || b.length > BOUND) throw new Error("Matrix is over the 16-row bound.");
  const k = a[0]?.length ?? 0;
  const n = b[0]?.length ?? 0;
  if (!k || b.length !== k || b.some((row) => row.length !== n)) throw new Error("Matrix shapes do not match.");
  return a.map((row) => {
    const out = Array.from({ length: n }, () => 0);
    for (let j = 0; j < n; j += 1) {
      let sum = 0;
      for (let t = 0; t < k; t += 1) sum += row[t] * b[t][j];
      out[j] = sum;
    }
    return out;
  });
}

/** Cosine via a 1×n by n×1 product. Same shape as a similarity rank. */
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  const dot = matmul([a], b.map((n) => [n]))[0][0];
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (denom <= 1e-12) return 0;
  return dot / denom;
}

function zeroVector(v: number[]): boolean {
  for (let i = 0; i < v.length; i += 1) if (v[i] !== 0) return false;
  return true;
}

function clampK(k: number): number {
  if (!Number.isFinite(k)) return 1;
  return Math.min(TOP_K_MAX, Math.max(1, Math.trunc(k)));
}

/** k nearest rows by cosine. Zero vectors drop out. k is 1..8, and only 32 rows are read. */
export function topK(
  query: number[],
  rows: { id: string; vector: number[] }[],
  k: number,
): { id: string; score: number }[] {
  if (query.length > BOUND) throw new Error("Matrix is over the 16-row bound.");
  if (!query.length) throw new Error("Matrix shapes do not match.");
  const hits: { id: string; score: number }[] = [];
  const limited = rows.slice(0, TOP_ROWS);
  for (let i = 0; i < limited.length; i += 1) {
    const row = limited[i];
    if (row.vector.length !== query.length) throw new Error("Matrix shapes do not match.");
    if (zeroVector(row.vector)) continue;
    hits.push({ id: row.id, score: cosine(query, row.vector) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, clampK(k));
}

/** The clock `started` came from. Date.now() when performance is missing. No GPU. */
function clockNow(started: number): number {
  const wall = Date.now();
  if (typeof performance === "undefined" || typeof performance.now !== "function") return wall;
  const perf = performance.now();
  return Math.abs(perf - started) <= Math.abs(wall - started) ? perf : wall;
}

/** A local timing receipt. ms is at least 1. The bound stays 16. */
export function receipt(op: string, started: number, rows: number): { op: string; ms: number; rows: number; bound: 16 } {
  const delta = clockNow(started) - started;
  const ms = Number.isFinite(delta) ? Math.max(1, Math.round(delta)) : 1;
  return { op, ms, rows, bound: 16 };
}

function columnMax(values: number[]): number {
  let max = values.length ? values[0] : 0;
  for (let i = 1; i < values.length; i += 1) if (values[i] > max) max = values[i];
  return max;
}

function byMax(value: number, max: number): number {
  return max === 0 ? 0 : value / max;
}

/**
 * Rank quotes by cosine against [1, 0, 1].
 * Row is [out / max(out), 1 - min(impact, 1), liquidity / max(liquidity)].
 * A max of 0 stays 0. This does not send a quote.
 */
export function scorePaths(
  paths: { id: string; out: number; impact: number; liquidity: number }[],
): { id: string; score: number }[] {
  const query = [1, 0, 1];
  const maxOut = columnMax(paths.map((path) => path.out));
  const maxLiq = columnMax(paths.map((path) => path.liquidity));
  return paths
    .map((path) => {
      const row = [byMax(path.out, maxOut), 1 - Math.min(path.impact, 1), byMax(path.liquidity, maxLiq)];
      return { id: path.id, score: cosine(query, row) };
    })
    .sort((a, b) => b.score - a.score);
}
