/**
 * Episodic memory for agent sends.
 *
 * PGlite (already the auth database) can load pgvector. That database is the
 * wrong place for this: it is shared, server-side, and not the wallet. These
 * rows are one browser's past decisions. The vector is the market state
 * (premium, 24h change, drawdown, side), not a text embedding. There is no
 * embedding model in this app, so inventing one would be a fake.
 */

const KEY = "senda.agent.memory.v1";

export type Memory = {
  at: string;
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  premium: number;
  change24h: number;
  drawdown: number;
};

export type Hit = { memory: Memory; score: number };

function load(): Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Memory[];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function vec(m: Pick<Memory, "premium" | "change24h" | "drawdown" | "side">): number[] {
  const clip = (n: number) => Math.max(-1, Math.min(1, n));
  return [clip(m.premium), clip(m.change24h), Math.max(0, Math.min(1, m.drawdown)), m.side === "buy" ? 1 : -1];
}

export function recentMemories(): Memory[] {
  return load().slice(0, 8);
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let aa = 0;
  let bb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    aa += a[i] * a[i];
    bb += b[i] * b[i];
  }
  if (aa === 0 || bb === 0) return 0;
  return dot / Math.sqrt(aa * bb);
}

export function remember(row: Memory) {
  const next = [...load(), row].slice(-40);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota */
  }
}

export function recall(
  query: Pick<Memory, "premium" | "change24h" | "drawdown" | "side">,
  k = 3,
): Hit[] {
  const q = vec(query);
  return load()
    .map((memory) => ({ memory, score: cosine(q, vec(memory)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
