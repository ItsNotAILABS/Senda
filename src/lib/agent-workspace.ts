/** A worker the user made. The purpose is theirs. The tools are the ones that actually run. */

import type { AgentKind } from "@/lib/agent-kinds";

const KEY = "senda.workspace.v1";

export const TOOLS = [
  { id: "book", label: "Read the book", line: "Writes the live print for the names it watches." },
  { id: "trade", label: "Queue a trade", line: "Prepares one buy, sell, or short. You still sign." },
  { id: "chart", label: "Read the chart", line: "Uses RSI, MACD, and the averages from a chart that was opened." },
  { id: "memory", label: "Remember the tape", line: "Keeps this print so the next run can see it." },
] as const;

export type ToolId = (typeof TOOLS)[number]["id"];

export type Worker = {
  id: string;
  name: string;
  purpose: string;
  kind?: AgentKind;
  tools: ToolId[];
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
  auto?: boolean;
  lastStakeAt?: number;
  queue: { symbol: string; side: "buy" | "sell" | "short"; usd: number; why: string } | null;
  notes: string;
  madeBy?: string;
  log: { at: string; text: string; role?: "you" | "agent" }[];
};

function load(): Worker[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Worker[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function save(rows: Worker[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listWorkers(): Worker[] {
  return load();
}

export function createWorker(input: {
  name: string;
  purpose: string;
  tools: ToolId[];
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
  kind?: AgentKind;
}): Worker {
  const row: Worker = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 48) || "Agent",
    purpose: input.purpose.trim().slice(0, 2000),
    kind: input.kind,
    tools: input.tools.length ? input.tools : ["book"],
    symbols: input.symbols,
    maxUsd: input.maxUsd > 0 ? Math.min(5000, Math.round(input.maxUsd)) : 0,
    side: input.side,
    queue: null,
    notes: "",
    log: [],
  };
  save([row, ...load()]);
  return row;
}

export function patchWorker(id: string, patch: Partial<Worker>): Worker | null {
  const rows = load();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, id };
  save(rows);
  return rows[i];
}

export function dropWorker(id: string) {
  save(load().filter((r) => r.id !== id));
}

export function logWorker(id: string, text: string, role: "you" | "agent" = "agent") {
  const row = load().find((r) => r.id === id);
  if (!row) return;
  patchWorker(id, { log: [{ at: new Date().toISOString(), text, role }, ...row.log].slice(0, 80) });
}
