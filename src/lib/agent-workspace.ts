/** A worker the user made. Every capability below has a real local implementation. */

const KEY = "senda.workspace.v2";

export const TOOLS = [
  { id: "planner", label: "Plan work", line: "Turns the goal into a clear, saved checklist." },
  { id: "notes", label: "Write a brief", line: "Writes a concise brief into the run log." },
  { id: "book", label: "Read the book", line: "Reads live PreStock prices for the names it watches." },
  { id: "memory", label: "Remember context", line: "Keeps the latest market observation for the next run." },
  { id: "trade", label: "Queue a trade", line: "Prepares one bounded buy or sell. The wallet still signs." },
] as const;

export type ToolId = (typeof TOOLS)[number]["id"];
export type AgentCategory = "research" | "markets" | "operations" | "content" | "personal" | "custom";
export type AgentTrigger = "manual" | "on_open" | "daily";
export type AgentAutonomy = "observe" | "draft" | "queue";
export type AgentStatus = "active" | "paused";

export type Worker = {
  id: string;
  name: string;
  purpose: string;
  instructions: string;
  category: AgentCategory;
  tools: ToolId[];
  trigger: AgentTrigger;
  autonomy: AgentAutonomy;
  status: AgentStatus;
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
  queue: { symbol: string; side: "buy" | "sell"; usd: number; why: string } | null;
  checklist: string[];
  log: { at: string; text: string; kind?: "info" | "action" | "success" }[];
  createdAt: string;
  lastRunAt: string;
  runs: number;
};

function normalize(row: Partial<Worker> & Pick<Worker, "id" | "name" | "purpose">): Worker {
  return {
    id: row.id,
    name: row.name || "Agent",
    purpose: row.purpose || "",
    instructions: row.instructions || "",
    category: row.category || "custom",
    tools: Array.isArray(row.tools) && row.tools.length ? row.tools : ["planner"],
    trigger: row.trigger || "manual",
    autonomy: row.autonomy || (row.tools?.includes("trade") ? "queue" : "draft"),
    status: row.status || "active",
    symbols: Array.isArray(row.symbols) ? row.symbols : [],
    maxUsd: Math.min(5000, Math.max(1, Number(row.maxUsd) || 25)),
    side: row.side === "sell" ? "sell" : "buy",
    queue: row.queue || null,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
    log: Array.isArray(row.log) ? row.log : [],
    createdAt: row.createdAt || new Date().toISOString(),
    lastRunAt: row.lastRunAt || "",
    runs: Number(row.runs) || 0,
  };
}

function load(): Worker[] {
  if (typeof window === "undefined") return [];
  try {
    const current = window.localStorage.getItem(KEY);
    const legacy = window.localStorage.getItem("senda.workspace.v1");
    const rows = JSON.parse(current || legacy || "[]") as (Partial<Worker> & Pick<Worker, "id" | "name" | "purpose">)[];
    return Array.isArray(rows) ? rows.map(normalize) : [];
  } catch {
    return [];
  }
}

function save(rows: Worker[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* local storage quota */
  }
}

export function listWorkers(): Worker[] {
  return load();
}

export function createWorker(input: {
  name: string;
  purpose: string;
  instructions?: string;
  category: AgentCategory;
  tools: ToolId[];
  trigger: AgentTrigger;
  autonomy: AgentAutonomy;
  symbols: string[];
  maxUsd: number;
  side: "buy" | "sell";
}): Worker {
  const now = new Date().toISOString();
  const allowedTools = input.autonomy === "queue" ? input.tools : input.tools.filter((tool) => tool !== "trade");
  const row: Worker = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 48) || "Agent",
    purpose: input.purpose.trim().slice(0, 1200),
    instructions: (input.instructions || "").trim().slice(0, 2000),
    category: input.category,
    tools: allowedTools.length ? allowedTools : ["planner"],
    trigger: input.trigger,
    autonomy: input.autonomy,
    status: "active",
    symbols: input.symbols,
    maxUsd: Math.min(5000, Math.max(1, Math.round(input.maxUsd) || 25)),
    side: input.side,
    queue: null,
    checklist: [],
    log: [],
    createdAt: now,
    lastRunAt: "",
    runs: 0,
  };
  save([row, ...load()]);
  return row;
}

export function patchWorker(id: string, patch: Partial<Worker>): Worker | null {
  const rows = load();
  const i = rows.findIndex((row) => row.id === id);
  if (i < 0) return null;
  rows[i] = normalize({ ...rows[i], ...patch, id });
  save(rows);
  return rows[i];
}

export function dropWorker(id: string) {
  save(load().filter((row) => row.id !== id));
}

export function logWorker(id: string, text: string, kind: "info" | "action" | "success" = "info") {
  const row = load().find((item) => item.id === id);
  if (!row) return;
  patchWorker(id, {
    log: [{ at: new Date().toISOString(), text, kind }, ...row.log].slice(0, 60),
  });
}

export function isWorkerDue(row: Worker, now = new Date()): boolean {
  if (row.status !== "active" || row.trigger === "manual") return false;
  if (row.trigger === "on_open") return true;
  if (!row.lastRunAt) return true;
  return row.lastRunAt.slice(0, 10) !== now.toISOString().slice(0, 10);
}
