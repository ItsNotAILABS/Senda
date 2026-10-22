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
  action?: "swap" | "pay" | "lend" | "watch";
  order?: "market" | "limit" | "stop";
  limitPx?: number;
  payTo?: string;
  strategy?: string;
  /** Dollars this contract has already signed. It stops at maxUsd. */
  spentUsd?: number;
  /** Hard price-impact ceiling for this contract, in percent. 0 means the desk default. */
  maxImpact?: number;
  /** The day this contract last signed. One fill a day. */
  signedOn?: string;
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
          action: e.action || "swap",
          order: e.order || "market",
          limitPx: e.limitPx || 0,
          payTo: e.payTo || "",
          strategy: e.strategy || "",
          signedOn: e.signedOn || "",
          spentUsd: e.spentUsd && e.spentUsd > 0 ? e.spentUsd : 0,
          maxImpact: e.maxImpact && e.maxImpact > 0 ? e.maxImpact : 0,
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
  action?: Envelope["action"];
  order?: Envelope["order"];
  limitPx?: number;
  payTo?: string;
  strategy?: string;
  maxImpact?: number;
}): Envelope {
  const row: Envelope = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 40) || "Agent",
    mandate: input.mandate.trim().slice(0, 240),
    symbols: input.symbols,
    maxUsd: Math.min(5000, Math.max(1, Math.round(input.maxUsd))),
    side: input.side,
    job: input.job,
    action: input.action || "swap",
    order: input.order || "market",
    limitPx: input.limitPx && input.limitPx > 0 ? input.limitPx : 0,
    payTo: (input.payTo || "").trim(),
    strategy: input.strategy || "",
    maxImpact: input.maxImpact && input.maxImpact > 0 ? input.maxImpact : 0,
    spentUsd: 0,
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
