/** An agent the user made. The envelope is the bound. The log is its computer. */

const KEY = "senda.envelopes.v1";

import type { Job, Queue } from "@/lib/agent-shift";

export type Envelope = {
  id: string;
  name: string;
  mandate: string;
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
  job: Job;
  armed: boolean;
  lastTick: string;
  queue: Queue | null;
  log: { at: string; text: string }[];
};

function load(): Envelope[] {
  if (typeof window === "undefined") return [];
  try {
    const p = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Envelope[];
    return Array.isArray(p)
      ? p.map((e) => ({
          ...e,
          job: e.job || "scout",
          armed: e.armed !== false,
          lastTick: e.lastTick || "",
          queue: e.queue ?? null,
          log: e.log || [],
          symbols: e.symbols || [],
        }))
      : [];
  } catch {
    return [];
  }
}

function save(rows: Envelope[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 24)));
  } catch {
    /* quota */
  }
}

export function listEnvelopes(): Envelope[] {
  return load();
}

export function createEnvelope(input: {
  name: string;
  mandate: string;
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
  job: Envelope["job"];
}): Envelope {
  const row: Envelope = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 40) || "Agent",
    mandate: input.mandate.trim().slice(0, 240),
    symbols: input.symbols,
    maxUsd: Math.min(5000, Math.max(1, Math.round(input.maxUsd))),
    side: input.side,
    job: input.job,
    armed: true,
    lastTick: "",
    queue: null,
    log: [],
  };
  save([row, ...load()]);
  return row;
}

export function patchEnvelope(id: string, patch: Partial<Envelope>): Envelope | null {
  const rows = load();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, id: rows[i].id };
  save(rows);
  return rows[i];
}

export function writeLog(id: string, text: string): Envelope | null {
  const rows = load();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  const next = { ...rows[i], log: [{ at: new Date().toISOString(), text }, ...rows[i].log].slice(0, 30) };
  rows[i] = next;
  save(rows);
  return next;
}

export function dropEnvelope(id: string) {
  save(load().filter((r) => r.id !== id));
}
