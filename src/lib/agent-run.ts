/** Turn a plain instruction into a real pass over the live book. It writes. It does not sign. */

import { recall, remember } from "@/lib/agent-memory";
import type { ToolId } from "@/lib/agent-workspace";
import { loadTapes } from "@/lib/indicators";
import { shortBook } from "@/lib/short-market";
import { formatChg, formatPremium, formatUsd, formatValuation, type HouseListing } from "@/lib/sol-house";

export type AgentQueue = { symbol: string; side: "buy" | "sell" | "short"; usd: number; why: string };

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
  return `${n.symbol} last ${formatUsd(n.last)} against a ${formatUsd(n.mark)} mark (${formatPremium(n.premium)}). 24h ${formatChg(n.change24h)}. Liquidity ${formatValuation(n.liquidity)}.`;
}

function readCall(focus: HouseListing, side: "buy" | "sell" | "watch"): string[] {
  const premium = focus.premium ?? 0;
  const day = focus.change24h ?? 0;
  const lines = [lineFor(focus)];
  const prior = recall({ premium, change24h: day, drawdown: premium < 0 ? -premium : 0, side: side === "sell" ? "sell" : "buy" }, 3).find(
    (h) => h.memory.symbol === focus.symbol,
  );
  if (prior) {
    const moved = premium - prior.memory.premium;
    lines.push(
      `Last look at ${focus.symbol} was ${formatPremium(prior.memory.premium)} versus the mark. It has moved ${formatPremium(moved)} since then.`,
    );
  }
  if (side === "sell") {
    lines.push(
      premium > 0.01
        ? `${focus.symbol} is the rich name. A sell gives the premium back. It is queued. You still sign.`
        : `${focus.symbol} is the richest in scope and it is not rich enough to sell. Nothing queued.`,
    );
  } else if (side === "buy") {
    lines.push(
      premium < -0.01
        ? `${focus.symbol} is under its mark. A buy is queued at your size. You still sign.`
        : `${focus.symbol} is not cheap versus its mark. Paying up is the trade, so nothing is queued unless you asked to buy anyway.`,
    );
  } else {
    lines.push(
      premium < -0.02
        ? `${focus.symbol} is the cheap name.`
        : premium > 0.02
          ? `${focus.symbol} is the rich name.`
          : `${focus.symbol} is close to its mark.`,
    );
  }
  if (focus.liquidity > 0 && focus.liquidity < 50_000) {
    lines.push("The pool is thin. A Jupiter fill can move the price. Read the impact before you sign.");
  }
  remember({
    at: new Date().toISOString(),
    symbol: focus.symbol,
    side: side === "sell" ? "sell" : "buy",
    usd: 0,
    premium,
    change24h: day,
    drawdown: premium < 0 ? -premium : 0,
  });
  return lines;
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
  const wantsSignal = /\bshort\b|\brsi\b|\bmacd\b|\bindicator\b|\bsignal\b|\bchart\b/.test(lower);
  const wantsWatch = /\bwatch\b|\bscout\b|\bbrief\b|\bsummar|\breport\b|\bwhat moved\b/.test(lower) || (!wantsBuy && !wantsSell && !wantsCover && !wantsSignal);
  const trade = (wantsBuy || wantsSell || (opts.trade && !wantsWatch)) && opts.maxUsd > 0;
  const forceBuy = /\bbuy\b/.test(lower) && !/\bif\b|\bwhen\b|\bonly\b/.test(lower);
  const tools: ToolId[] = ["book"];
  if (wantsBuy || wantsSell || wantsSignal) tools.push("trade");
  if (wantsSignal) tools.push("chart");
  tools.push("memory");
  const lines: string[] = [];
  if (!scope.length) {
    lines.push("The live book is empty, so this agent has nothing to read yet.");
    return { title: "Watcher", symbols: [], tools, lines, queue: null };
  }
  let queue: AgentQueue | null = null;
  if (wantsSignal) {
    const tapes = loadTapes();
    const hit = scope
      .map((n) => ({ n, tape: tapes[n.symbol.toUpperCase()] }))
      .find((row) => row.tape && row.tape.bias !== "flat");
    if (!hit?.tape) {
      lines.push("No chart is open on these names. Open one. RSI, MACD, the averages, and ATR are saved from that chart.");
    } else if (hit.tape.bias === "long") {
      queue = { symbol: hit.n.symbol, side: "buy", usd: opts.maxUsd, why: hit.tape.why };
      lines.push(`${hit.n.symbol} reads long. ${hit.tape.why} A buy is queued. You still sign.`);
    } else if (shortBook(hit.n.symbol)) {
      queue = { symbol: hit.n.symbol, side: "short", usd: opts.maxUsd, why: hit.tape.why };
      lines.push(`${hit.n.symbol} reads short. ${hit.tape.why} The short uses ${shortBook(hit.n.symbol)?.label}. You still sign.`);
    } else {
      lines.push(`${hit.n.symbol} reads short. ${hit.tape.why} There is no short market, so nothing was queued.`);
    }
  } else if (wantsCover) {
    const focus = [...scope].sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))[0];
    const hard = (focus.change24h ?? 0) < -0.03;
    lines.push(...readCall(focus, "watch"));
    lines.push(hard ? `${focus.symbol} is the drop today. Flagged. Not bought.` : "Nothing in scope is down hard enough to flag.");
  } else if (trade && wantsSell && rich) {
    if ((rich.premium ?? 0) > 0.01) {
      queue = { symbol: rich.symbol, side: "sell", usd: opts.maxUsd, why: `${rich.symbol} is ${formatPremium(rich.premium)} versus its mark.` };
    }
    lines.push(...readCall(rich, "sell"));
  } else if (trade && cheap) {
    const side = wantsBuy || opts.side === "buy" ? "buy" : opts.side;
    if (side === "sell" && rich) {
      queue = { symbol: rich.symbol, side: "sell", usd: opts.maxUsd, why: `Sell ${rich.symbol} at the size you set.` };
      lines.push(...readCall(rich, "sell"));
    } else {
      const worthIt = (cheap.premium ?? 0) < -0.01 || forceBuy;
      if (worthIt) {
        queue = { symbol: cheap.symbol, side: "buy", usd: opts.maxUsd, why: `${cheap.symbol} is ${formatPremium(cheap.premium)} versus its mark.` };
      }
      lines.push(...readCall(cheap, worthIt ? "buy" : "watch"));
    }
  } else {
    lines.push(...readCall(cheap, "watch"));
    if (rich && rich.symbol !== cheap.symbol) lines.push(`Rich end of the book is ${rich.symbol} at ${formatPremium(rich.premium)}.`);
  }
  const title = (text.split(/[.\n]/)[0] || "Agent").trim().slice(0, 42) || "Agent";
  return { title, symbols: picked.map((n) => n.symbol), tools, lines, queue };
}
