/** A sentence becomes a contract only when the name is already on the book. */

import { spendCap } from "@/lib/spend-cap";

export type IntentBook = { symbol: string; name: string };

export type ParsedIntent =
  | {
      ok: true;
      side: "buy" | "sell";
      usd: number;
      symbol: string;
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

export function parseIntent(text: string, book: IntentBook[]): ParsedIntent {
  const said = text.trim();
  if (said.length < 4) return { ok: false, error: "Say the size and the name." };
  const usd = amountOf(said);
  if (usd == null) return { ok: false, error: "Say a dollar size. Nothing was queued." };
  const cap = spendCap();
  if (usd - cap > 0.001) return { ok: false, error: `That is $${usd.toFixed(2)}. The cap is $${cap.toFixed(2)}. Nothing was queued.` };
  const hit = nameOf(said, book);
  if (!hit) return { ok: false, error: "That name is not on this book. Nothing was queued." };
  const side: "buy" | "sell" = /\b(sell|short|dump|exit|trim)\b/i.test(said) ? "sell" : "buy";
  const maxImpact = impactOf(said);
  const rotate = /\b(rotate|bridge|switch)\b/i.test(said) && /\b(base|ethereum|arbitrum)\b/i.test(said);
  const refused = rotate ? "A rotate onto Base, Ethereum, or Arbitrum is not signed. The token stays the Solana one." : null;
  const slip = maxImpact != null ? ` It refuses the quote if impact is over ${maxImpact}%.` : "";
  return {
    ok: true,
    side,
    usd,
    symbol: hit.symbol,
    maxImpact,
    refused,
    line: `${side === "buy" ? "Buy" : "Sell"} $${usd.toFixed(2)} ${hit.symbol}.${slip}`,
  };
}
