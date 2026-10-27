/** Names and strategies an outside agent can read. A strategy does not sign. */

import { BACKPACK } from "@/lib/backpack";
import { PRESTOCK_MINTS } from "@/lib/phantom";
import { BOOK } from "@/lib/sol-books";

export type AgentName = {
  symbol: string;
  name: string;
  mint: string;
  decimals: number;
  lane: string;
  trade: boolean;
};

export type PlanStep = {
  kind: "clip" | "coherence" | "dip" | "momentum";
  side: "buy" | "sell";
  symbols: string[];
};

export type StrategyRule = {
  kind: "clip" | "coherence" | "dip" | "momentum" | "note" | "plan";
  side: "buy" | "sell";
  symbols: string[];
  /** Ordered checks. The first one the market satisfies is the one that queues. */
  steps?: PlanStep[];
};

export type StrategyCard = {
  id: string;
  name: string;
  category: string;
  thesis: string;
  rule: StrategyRule;
  executable: boolean;
};

export const SEED_STRATEGIES: StrategyCard[] = [
  {
    id: "clip",
    name: "Daily clip",
    category: "attempt",
    thesis: "One trade a day, sized to the mission's daily aim, and never past the bankroll left. The aim is the amount put at risk that day. It is not a profit this desk owes you.",
    rule: { kind: "clip", side: "buy", symbols: [] },
    executable: true,
  },
  {
    id: "coherence",
    name: "Coherence clip",
    category: "attempt",
    thesis: "Same daily size. When you sign, MESIE drops a Jupiter route whose peak is at least twice its own mean if a flatter route exists. The wallet still signs.",
    rule: { kind: "coherence", side: "buy", symbols: [] },
    executable: true,
  },
  {
    id: "dip",
    name: "Dip clip",
    category: "attempt",
    thesis: "Same daily size, and only when that name is down at least 2% over 24 hours on Jupiter. A flat or up day is refused. The wallet still signs.",
    rule: { kind: "dip", side: "buy", symbols: [] },
    executable: true,
  },
  {
    id: "momentum",
    name: "Momentum clip",
    category: "attempt",
    thesis: "Same daily size, and only when that name is up between 2% and 12% over 24 hours. A blow-off past 12% is refused. The wallet still signs.",
    rule: { kind: "momentum", side: "buy", symbols: [] },
    executable: true,
  },
  {
    id: "shares",
    name: "Share clip",
    category: "shares",
    thesis: "Same daily size, and only on a Backpack Securities name. The wallet still signs. A thin pool is not a reason to size up.",
    rule: { kind: "clip", side: "buy", symbols: ["AAPL", "NVDA", "TSLA", "META", "AMZN", "SPCX"] },
    executable: true,
  },
  {
    id: "day-plan",
    name: "Day plan",
    category: "portfolio",
    thesis: "Two checks, in order. If the name is down at least 2% today, queue a buy. If it is up between 2% and 12%, queue a sell. A flat day waits. One step queues. The wallet still signs, and the next ask runs the checks again.",
    rule: {
      kind: "plan",
      side: "buy",
      symbols: [],
      steps: [
        { kind: "dip", side: "buy", symbols: [] },
        { kind: "momentum", side: "sell", symbols: [] },
      ],
    },
    executable: true,
  },
];

export function agentNames(): AgentName[] {
  const rows: AgentName[] = [];
  const seen = new Set<string>();
  const add = (row: AgentName) => {
    if (!row.symbol || seen.has(row.mint || row.symbol)) return;
    seen.add(row.mint || row.symbol);
    rows.push(row);
  };
  for (const asset of BOOK) {
    add({
      symbol: asset.symbol,
      name: asset.name,
      mint: asset.mint,
      decimals: asset.decimals,
      lane: asset.lane,
      trade: asset.trade !== false && Boolean(asset.mint),
    });
  }
  for (const share of BACKPACK) {
    add({ symbol: share.symbol, name: share.name, mint: share.mint, decimals: share.decimals, lane: "shares", trade: true });
  }
  for (const [symbol, mint] of PRESTOCK_MINTS) {
    add({ symbol, name: symbol, mint, decimals: 6, lane: "companies", trade: true });
  }
  return rows;
}

export function parseRule(raw: unknown): StrategyRule | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { kind?: unknown; side?: unknown; symbols?: unknown; steps?: unknown };
  const kind = row.kind === "coherence" || row.kind === "note" || row.kind === "clip" || row.kind === "dip" || row.kind === "momentum" || row.kind === "plan" ? row.kind : null;
  if (!kind) return null;
  const side = row.side === "sell" ? "sell" : "buy";
  const symbols = symbolsOf(row.symbols);
  if (kind !== "plan") return { kind, side, symbols };
  const steps = stepsOf(row.steps);
  if (steps.length < 2) return null;
  return { kind, side, symbols, steps };
}

function symbolsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((s): s is string => typeof s === "string" && /^[A-Z0-9.]{1,12}$/.test(s)).slice(0, 40) : [];
}

function stepsOf(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  const steps: PlanStep[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as { kind?: unknown; side?: unknown; symbols?: unknown };
    const kind = row.kind === "clip" || row.kind === "coherence" || row.kind === "dip" || row.kind === "momentum" ? row.kind : null;
    if (!kind) continue;
    steps.push({ kind, side: row.side === "sell" ? "sell" : "buy", symbols: symbolsOf(row.symbols) });
    if (steps.length === 6) break;
  }
  return steps;
}

export function clipLeft(mission: { bankrollUsd: number; aimUsd: number; spentUsd: number; day: string; daySpent: number }, today: string): number {
  const bank = Math.max(0, mission.bankrollUsd - mission.spentUsd);
  const used = mission.day === today ? mission.daySpent : 0;
  const day = Math.max(0, mission.aimUsd - used);
  return Math.round(Math.min(bank, day) * 100) / 100;
}
