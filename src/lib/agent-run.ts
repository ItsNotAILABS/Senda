/** Turn a plain instruction into a real pass over the live book. It writes. It does not sign. */

import { decide } from "@/lib/engine";
import { remember } from "@/lib/agent-memory";
import type { ToolId } from "@/lib/agent-workspace";
import { formatPremium, formatUsd, type HouseListing } from "@/lib/sol-house";

export type AgentQueue = { symbol: string; side: "buy" | "sell"; usd: number; why: string };

export type AgentPass = {
  title: string;
  symbols: string[];
  tools: ToolId[];
  lines: string[];
  queue: AgentQueue | null;
};

function mentioned(text: string, book: HouseListing[]): HouseListing[] {
  const hay = text.toLowerCase();
  return book.filter((n) => {
    const sym = n.symbol.toLowerCase();
    const name = n.name.toLowerCase();
    return hay.includes(sym) || (name.length > 3 && hay.includes(name));
  });
}

function lineFor(n: HouseListing): string {
  const move = n.change24h == null ? "" : ` · 24h ${(n.change24h * 100).toFixed(1)}%`;
  return `${n.symbol} ${formatUsd(n.last)} ${formatPremium(n.premium)}${move}`;
}

export function runInstruction(
  purpose: string,
  book: HouseListing[],
  opts: { side: "buy" | "sell"; maxUsd: number; symbols: string[]; trade?: boolean },
): AgentPass {
  const live = book.filter((n) => n.venue === "prestocks" && n.last > 0);
  const text = purpose.trim();
  const picked = opts.symbols.length ? live.filter((n) => opts.symbols.includes(n.symbol)) : mentioned(text, live);
  const scope = picked.length ? picked : live;
  const cheap = [...scope].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...scope].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  const lower = text.toLowerCase();
  const wantsSell = /\bsell\b|\brich\b|\bexit\b/.test(lower);
  const wantsBuy = !wantsSell && /\bbuy\b|\bcheap\b|\bdiscount\b|\baccumulate\b/.test(lower);
  const wantsCover = /\bcover\b|\bdrop\b|\bdown\b|\bhedge\b/.test(lower);
  const wantsMemory = /\bremember\b|\bmemory\b|\bnote\b|\blog\b/.test(lower);
  const wantsWatch = /\bwatch\b|\bscout\b|\bbrief\b|\bsummar|\breport\b|\bwhat moved\b/.test(lower) || (!wantsBuy && !wantsSell && !wantsCover);
  const trade = wantsBuy || wantsSell || (opts.trade && !wantsWatch);

  const tools: ToolId[] = ["book"];
  if (wantsBuy || wantsSell) tools.push("trade");
  if (wantsMemory || wantsWatch) tools.push("memory");

  const lines: string[] = [];
  lines.push(text ? `Order: ${text}` : "Order: watch the book and write what is on it.");
  if (!scope.length) {
    lines.push("The live book is empty, so this agent has nothing to read yet.");
    return { title: "Watcher", symbols: [], tools, lines, queue: null };
  }
  lines.push(scope.slice(0, 8).map(lineFor).join(" · "));

  let queue: AgentQueue | null = null;
  if (wantsCover) {
    const hit = [...scope].sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))[0];
    const hard = (hit.change24h ?? 0) < -0.03;
    lines.push(hard ? `${hit.symbol} is the drop. ${lineFor(hit)}. This agent flagged it. It did not buy.` : "Nothing in scope is down hard enough to flag.");
  }
  if (trade && wantsSell && rich) {
    const pick = decide(scope, "sell", false);
    if (pick) {
      queue = { symbol: pick.symbol, side: "sell", usd: opts.maxUsd, why: `${pick.symbol} is rich versus its mark.` };
      lines.push(`Queued a sell of ${pick.symbol} for $${opts.maxUsd}. Waiting for your signature.`);
    } else {
      lines.push(`${rich.symbol} is the richest in scope and it is not rich enough to sell. Nothing queued.`);
    }
  } else if (trade && cheap) {
    const side = wantsBuy || opts.side === "buy" ? "buy" : opts.side;
    const pick = decide(scope, side === "sell" ? "sell" : "buy", wantsBuy || side === "sell");
    if (pick) {
      queue = { symbol: pick.symbol, side: pick.side, usd: opts.maxUsd, why: `${pick.symbol} is ${pick.side === "sell" ? "rich" : "cheap"} versus its mark.` };
      lines.push(`Queued a ${pick.side} of ${pick.symbol} for $${opts.maxUsd}. Waiting for your signature.`);
    } else {
      lines.push(`${cheap.symbol} is the cheapest in scope and it is not cheap enough to buy. Nothing queued.`);
    }
  }
  if (wantsMemory) {
    const row = scope[0];
    remember({
      at: new Date().toISOString(),
      symbol: row.symbol,
      side: queue?.side ?? opts.side,
      usd: opts.maxUsd,
      premium: row.premium ?? 0,
      change24h: row.change24h ?? 0,
      drawdown: 0,
    });
    lines.push(`Remembered ${row.symbol} at ${formatUsd(row.last)}.`);
  }
  if (wantsWatch && !wantsBuy && !wantsSell) {
    lines.push(cheap && rich ? `Cheap is ${cheap.symbol}. Rich is ${rich.symbol}.` : "Watching.");
  }

  const title = (text.split(/[.\n]/)[0] || "Agent").trim().slice(0, 42) || "Agent";
  return {
    title,
    symbols: picked.map((n) => n.symbol),
    tools,
    lines,
    queue,
  };
}
