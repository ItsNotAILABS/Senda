/** Paper fills against a live print. The tape stays in this browser. Nothing is signed. */

const AGENTS = "senda.paper.agents.v1";
const FILLS = "senda.paper.fills.v1";

export type PaperRule = "cheap" | "rich" | "either";

export type PaperAgent = {
  id: string;
  name: string;
  symbol: string;
  mint: string;
  rule: PaperRule;
  size: number;
  armed: boolean;
  lastFillAt: number;
};

export type PaperFill = {
  id: string;
  agentId: string;
  agent: string;
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  px: number;
  at: string;
};

function read<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(key) || "[]") as T[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(key: string, rows: unknown[]) {
  window.localStorage.setItem(key, JSON.stringify(rows.slice(0, 200)));
}

export function listPaperAgents(): PaperAgent[] {
  return read<PaperAgent>(AGENTS);
}

export function listPaperFills(): PaperFill[] {
  return read<PaperFill>(FILLS);
}

export function hirePaperAgent(input: { name: string; symbol: string; mint: string; rule: PaperRule; size: number }): PaperAgent {
  const row: PaperAgent = {
    id: crypto.randomUUID(),
    name: input.name.trim().slice(0, 40) || input.symbol,
    symbol: input.symbol,
    mint: input.mint,
    rule: input.rule,
    size: Math.min(5000, Math.max(1, Math.round(input.size) || 25)),
    armed: true,
    lastFillAt: 0,
  };
  write(AGENTS, [row, ...listPaperAgents()]);
  return row;
}

export function patchPaperAgent(id: string, patch: Partial<PaperAgent>): PaperAgent | null {
  const rows = listPaperAgents();
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return null;
  rows[i] = { ...rows[i], ...patch, id: rows[i].id };
  write(AGENTS, rows);
  return rows[i];
}

export function dropPaperAgent(id: string) {
  write(AGENTS, listPaperAgents().filter((r) => r.id !== id));
}

export function recordPaperFill(input: Omit<PaperFill, "id" | "at">): PaperFill {
  const row: PaperFill = { ...input, id: crypto.randomUUID(), at: new Date().toISOString() };
  write(FILLS, [row, ...listPaperFills()]);
  patchPaperAgent(input.agentId, { lastFillAt: Date.now() });
  return row;
}

export function paperPnl(side: "buy" | "sell", entry: number, mark: number, usd: number): number | null {
  if (!(entry > 0) || !(mark > 0) || !(usd > 0)) return null;
  const move = (mark - entry) / entry;
  return (side === "buy" ? move : -move) * usd;
}
