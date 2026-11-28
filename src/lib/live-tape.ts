/** The book stays in memory. A short list paints first. A later page never wipes it. */

import { jupTape, type TapeRow } from "@/lib/world-book";
import { TAPE_SEED } from "@/lib/tape-seed";

let rows: TapeRow[] = TAPE_SEED.slice();
const listeners = new Set<(rows: TapeRow[]) => void>();
let started = false;

const SAVED = "senda.tape.v1";

function readSaved(): TapeRow[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SAVED) || "null") as TapeRow[] | null;
    return Array.isArray(parsed) ? asRows(parsed) : [];
  } catch {
    return [];
  }
}

function emit(next: TapeRow[]) {
  if (!next.length || next.length < rows.length) return;
  const icons = new Map(rows.filter((row) => row.icon).map((row) => [row.id, row.icon]));
  rows = next.map((row) => (row.icon || !icons.has(row.id) ? row : { ...row, icon: icons.get(row.id) }));
  try {
    sessionStorage.setItem(SAVED, JSON.stringify(rows.slice(0, 80)));
  } catch {
    /* private mode or a full disk */
  }
  listeners.forEach((fn) => fn(rows));
}

export function tapeNow(): TapeRow[] {
  return rows;
}

export function watchTape(fn: (rows: TapeRow[]) => void): () => void {
  listeners.add(fn);
  if (rows.length) fn(rows);
  startTape();
  return () => {
    listeners.delete(fn);
  };
}

function asRows(body: unknown): TapeRow[] {
  if (!Array.isArray(body)) return [];
  const out: TapeRow[] = [];
  for (const raw of body) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as {
      id?: unknown;
      symbol?: unknown;
      name?: unknown;
      usdPrice?: unknown;
      price?: unknown;
      icon?: unknown;
      volume?: unknown;
      change?: unknown;
      stats24h?: { priceChange?: unknown; buyVolume?: unknown; sellVolume?: unknown };
    };
    if (typeof row.id !== "string" || typeof row.symbol !== "string") continue;
    const buy = Number(row.stats24h?.buyVolume) || 0;
    const sell = Number(row.stats24h?.sellVolume) || 0;
    const volume = Number(row.volume) || (buy + sell > 0 ? buy + sell : 0);
    const price = Number(row.price ?? row.usdPrice);
    const change = Number(row.change ?? row.stats24h?.priceChange);
    out.push({
      id: row.id,
      symbol: row.symbol,
      name: typeof row.name === "string" && row.name ? row.name : row.symbol,
      price: Number.isFinite(price) ? price : null,
      change: Number.isFinite(change) ? change : null,
      icon: typeof row.icon === "string" ? row.icon : undefined,
      volume: volume > 0 ? volume : undefined,
    });
  }
  return out;
}

async function loadRest() {
  const all: TapeRow[] = [];
  for (let offset = 0; offset < 6000; offset += 400) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(`/api/chain?slim=1&offset=${offset}&limit=400`, {
        headers: { accept: "application/json" },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(String(res.status));
      const chunk = asRows(await res.json());
      if (!chunk.length) break;
      all.push(...chunk);
      emit(all.slice());
      if (chunk.length < 400) break;
    } finally {
      window.clearTimeout(timer);
    }
  }
  if (all.length < 40) {
    const extra = await jupTape().catch(() => [] as TapeRow[]);
    if (extra.length) emit(asRows(extra));
  }
}

export function startTape() {
  if (typeof window === "undefined") return;
  if (!rows.length) {
    const saved = readSaved();
    if (saved.length) emit(saved);
  }
  if (started) return;
  started = true;
  const run = () => {
    void loadRest()
      .catch(() => undefined)
      .finally(() => {
        if (!rows.length) window.setTimeout(run, 2000);
      });
  };
  run();
}
