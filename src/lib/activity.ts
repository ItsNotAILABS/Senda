/** One list of what this wallet signed or sent. The chain status wins over a local trade note. */

import type { JournalEntry } from "./tx-journal.d.mts";
import type { TradeFill } from "./trade-log.ts";

export type ActivityStatus = JournalEntry["status"] | "signed";

export type ActivityRow = {
  id: string;
  at: number;
  kind: "send" | "swap";
  status: ActivityStatus;
  asset: string;
  amount: string;
  destination: string;
  signature: string;
};

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function amountOf(entry: JournalEntry): string {
  if (entry.asset === "USDC") return (Number(entry.amountRaw) / 1_000_000).toFixed(2);
  if (entry.asset === "SOL") return (Number(entry.amountRaw) / 1_000_000_000).toFixed(6);
  return entry.amountRaw;
}

export function buildActivity(journal: JournalEntry[], trades: TradeFill[]): ActivityRow[] {
  const bySig = new Map<string, ActivityRow>();
  for (const trade of trades) {
    if (!trade.signature) continue;
    bySig.set(trade.signature, {
      id: trade.signature,
      at: trade.at || 0,
      kind: trade.side === "send" ? "send" : "swap",
      status: "signed",
      asset: trade.symbol || trade.paidAsset || "USDC",
      amount: Number.isFinite(trade.usd) ? trade.usd.toFixed(2) : "",
      destination: trade.mint || "",
      signature: trade.signature,
    });
  }
  for (const entry of journal) {
    const prior = bySig.get(entry.signature);
    bySig.set(entry.signature, {
      id: entry.signature,
      at: prior?.at || entry.submittedAt,
      kind: entry.kind,
      status: entry.status,
      asset: entry.asset,
      amount: amountOf(entry),
      destination: entry.destination,
      signature: entry.signature,
    });
  }
  return [...bySig.values()].sort((a, b) => b.at - a.at);
}

export function searchActivity(rows: ActivityRow[], query: string): ActivityRow[] {
  const q = query.replace(/\s+/g, " ").trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.kind, row.status, row.asset, row.amount, row.destination, row.signature].join(" ").toLowerCase().includes(q),
  );
}

export type Recipient = { address: string; count: number; lastAt: number; asset: string };

export function recipientsOf(rows: ActivityRow[]): Recipient[] {
  const by = new Map<string, Recipient>();
  for (const row of rows) {
    if (row.kind !== "send" || !ADDRESS.test(row.destination)) continue;
    const have = by.get(row.destination);
    if (!have) by.set(row.destination, { address: row.destination, count: 1, lastAt: row.at, asset: row.asset });
    else {
      have.count += 1;
      if (row.at > have.lastAt) {
        have.lastAt = row.at;
        have.asset = row.asset;
      }
    }
  }
  return [...by.values()].sort((a, b) => b.lastAt - a.lastAt);
}

export type RecoveryFile = { v: 1; owner: string; journal: JournalEntry[]; trades: TradeFill[]; exportedAt: number };

export function recoveryFile(owner: string, journal: JournalEntry[], trades: TradeFill[], now = Date.now()): RecoveryFile {
  return { v: 1, owner, journal: journal.filter((row) => row.owner === owner), trades, exportedAt: now };
}

export function parseRecovery(raw: string, owner: string): RecoveryFile | { error: string } {
  let parsed: RecoveryFile;
  try {
    parsed = JSON.parse(raw) as RecoveryFile;
  } catch {
    return { error: "That file is not a recovery export." };
  }
  if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.journal) || !Array.isArray(parsed.trades)) {
    return { error: "That file is not a Senda recovery export." };
  }
  if (parsed.owner !== owner) return { error: "That file is for a different wallet. Nothing was replaced." };
  return parsed;
}
