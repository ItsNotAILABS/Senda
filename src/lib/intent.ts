/** A sentence becomes a signable action only when the name, or the address, is already real. */

import { spendCap } from "@/lib/spend-cap";

export type IntentBook = { symbol: string; name: string; mint?: string };

export type IntentKind = "swap" | "earn" | "send";

export type ParsedIntent =
  | {
      ok: true;
      kind: IntentKind;
      side: "buy" | "sell";
      usd: number;
      symbol: string;
      mint: string;
      to: string;
      maxImpact: number | null;
      line: string;
      refused: string | null;
    }
  | { ok: false; error: string };

function amountOf(text: string): number | null {
  const dollar = text.match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)/);
  const word = text.match(/([0-9][0-9,]*(?:\.[0-9]+)?)\s*(?:usdc|usd|dollars?)\b/i);
  const raw = (dollar?.[1] ?? word?.[1] ?? "").replace(/,/g, "");
  const n = Number(raw);
  return n > 0 ? Math.round(n * 100) / 100 : null;
}

function impactOf(text: string): number | null {
  const named = text.match(/slippage[^0-9]{0,16}([0-9]+(?:\.[0-9]+)?)\s*%/i);
  const bare = text.match(/([0-9]+(?:\.[0-9]+)?)\s*%\s*slippage/i);
  const n = Number(named?.[1] ?? bare?.[1]);
  return n > 0 && n <= 50 ? n : null;
}

function nameOf(text: string, book: IntentBook[]): IntentBook | null {
  const hay = text.toLowerCase();
  const ranked = [...book].sort((a, b) => b.symbol.length - a.symbol.length);
  for (const row of ranked) {
    const symbol = row.symbol.toLowerCase();
    if (symbol.length >= 2 && new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) return row;
    const name = row.name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
    if (name.length >= 4 && hay.includes(name)) return row;
  }
  return null;
}

/** What Phantom will be asked to sign. No calldata is invented. */
export function intentPlan(row: Extract<ParsedIntent, { ok: true }>): {
  type: "INTENT_BATCH_EXECUTION";
  executionBlock: {
    strategy: "JUPITER_SWAP" | "USDC_TRANSFER";
    description: string;
    mint: string;
    to: string;
    usd: number;
    side: "buy" | "sell";
    constraints: { maxSlippageBps: number; deadline: number };
  };
} {
  const bps = row.maxImpact != null ? Math.round(row.maxImpact * 100) : 100;
  return {
    type: "INTENT_BATCH_EXECUTION",
    executionBlock: {
      strategy: row.kind === "send" ? "USDC_TRANSFER" : "JUPITER_SWAP",
      description: row.line,
      mint: row.mint,
      to: row.to,
      usd: row.usd,
      side: row.side,
      constraints: { maxSlippageBps: bps, deadline: Math.floor(Date.now() / 1000) + 120 },
    },
  };
}

export function parseIntent(text: string, book: IntentBook[]): ParsedIntent {
  const said = text.trim();
  if (said.length < 4) return { ok: false, error: "Say the size and the name." };
  const usd = amountOf(said);
  if (usd == null) return { ok: false, error: "Say a dollar size. Nothing was queued." };
  const cap = spendCap();
  if (usd - cap > 0.001) return { ok: false, error: `That is $${usd.toFixed(2)}. The cap is $${cap.toFixed(2)}. Nothing was queued.` };
  const maxImpact = impactOf(said);
  const address = said.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  if (/\b(send|pay|transfer)\b/i.test(said) && address) {
    return {
      ok: true,
      kind: "send",
      side: "sell",
      usd,
      symbol: "USDC",
      mint: "",
      to: address[0],
      maxImpact,
      refused: null,
      line: `Send $${usd.toFixed(2)} USDC to ${address[0]}. Phantom signs the transfer.`,
    };
  }
  const hit = nameOf(said, book);
  if (!hit) return { ok: false, error: "That name is not on this book. Nothing was queued." };
  const side: "buy" | "sell" = /\b(sell|short|dump|exit|trim)\b/i.test(said) ? "sell" : "buy";
  const earn = /\b(earn|stake|lend|deposit|supply)\b/i.test(said);
  const rotate = /\b(rotate|bridge|switch)\b/i.test(said) && /\b(base|ethereum|arbitrum)\b/i.test(said);
  const refused = rotate ? "A rotate onto Base, Ethereum, or Arbitrum is not a Jupiter swap. USDC to those chains is the CCTP lane, and this sentence did not open it." : null;
  const slip = maxImpact != null ? ` It refuses the quote if impact is over ${maxImpact}%.` : "";
  const kind: IntentKind = earn ? "earn" : "swap";
  const verb = kind === "earn" ? "Buy the receipt" : side === "buy" ? "Buy" : "Sell";
  return {
    ok: true,
    kind,
    side: kind === "earn" ? "buy" : side,
    usd,
    symbol: hit.symbol,
    mint: hit.mint ?? "",
    to: "",
    maxImpact,
    refused,
    line: `${verb} $${usd.toFixed(2)} ${hit.symbol}.${slip}`,
  };
}
