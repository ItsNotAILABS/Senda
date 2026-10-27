/**
 * Internal financial tokens and the close.
 * Supplies are what the app runs on. The digest replays the journal
 * and reports the difference. Equity is the plug that keeps the trial balanced.
 */

import { CCY_META, type Ccy, type Wallet } from "@/lib/wallet";

export type TokenRole = "asset" | "liability" | "equity" | "memo";

export type BookToken = {
  code: string;
  name: string;
  role: TokenRole;
  ccy: Ccy | "USD";
  supply: number;
  usd: number;
};

export type Digest = {
  id: string;
  at: string;
  tokens: BookToken[];
  assets: number;
  equity: number;
  suspense: number;
  ghost: number;
  stock: number;
  fees: number;
  tied: boolean;
};

export type LedgerBookName = "chain" | "fill" | "pair" | "journal" | "card";

export type LedgerLine = {
  id: string;
  at: number;
  book: LedgerBookName;
  side: "in" | "out" | "memo";
  title: string;
  detail: string;
  amount: number | null;
  unit: string;
  href: string;
  status: string;
};

type LedgerInput = {
  sigs: Array<{ signature: string; err: boolean; time: number | null }>;
  moves: Array<{ signature: string; delta: number; other: string; time: number | null; err: boolean }>;
  fills: Array<{ at: number; symbol: string; side: "buy" | "sell" | "send"; usd: number; signature: string }>;
  pairs: Array<{ id: string; pair: string; symbol: string; usd: number; got: number; signature: string; at: number; closed?: string }>;
  journal: Array<{ id: string; kind: string; amount: number; ccy: string; counterparty: string; note: string; status: string; createdAt: string }>;
  cards: Array<{ id: string; last4: string; merchant: string; amount: number; status: string; at: string; rc?: string }>;
};

/** One book. A chain fact stays a chain fact. A browser line stays a browser line. */
export function assembleLedger(input: LedgerInput): LedgerLine[] {
  const lines: LedgerLine[] = [];
  const used = new Set<string>();
  for (const fill of input.fills) {
    used.add(fill.signature);
    lines.push({
      id: `fill:${fill.signature}`,
      at: fill.at,
      book: "fill",
      side: fill.side === "sell" ? "in" : "out",
      title: `${fill.side === "buy" ? "Bought" : fill.side === "sell" ? "Sold" : "Sent"} ${fill.symbol}`,
      detail: "Signed in this browser. The signature is the record.",
      amount: fill.usd,
      unit: "USD",
      href: `https://solscan.io/tx/${fill.signature}`,
      status: "signed",
    });
  }
  for (const pair of input.pairs) {
    used.add(pair.signature);
    lines.push({
      id: `pair:${pair.id}`,
      at: pair.at,
      book: "pair",
      side: pair.closed ? "memo" : "out",
      title: `${pair.closed ? "Closed" : "Long"} ${pair.pair}`,
      detail: pair.got > 0 ? `${pair.got} ${pair.symbol} in the wallet` : pair.symbol,
      amount: pair.usd,
      unit: "USDC",
      href: `https://solscan.io/tx/${pair.closed || pair.signature}`,
      status: pair.closed ? "closed" : "open",
    });
  }
  for (const move of input.moves) {
    if (used.has(move.signature)) continue;
    used.add(move.signature);
    lines.push({
      id: `usdc:${move.signature}`,
      at: (move.time || 0) * 1000,
      book: "chain",
      side: move.delta < 0 ? "out" : "in",
      title: move.delta < 0 ? "USDC out" : "USDC in",
      detail: move.other ? `Other ${move.other.slice(0, 4)}…${move.other.slice(-4)}` : "USDC on this address",
      amount: Math.abs(move.delta),
      unit: "USDC",
      href: `https://solscan.io/tx/${move.signature}`,
      status: move.err ? "failed" : "confirmed",
    });
  }
  for (const sig of input.sigs) {
    if (used.has(sig.signature)) continue;
    lines.push({
      id: `sig:${sig.signature}`,
      at: (sig.time || 0) * 1000,
      book: "chain",
      side: "memo",
      title: "Signature",
      detail: "On this address. The amount is not in the USDC account.",
      amount: null,
      unit: "",
      href: `https://solscan.io/tx/${sig.signature}`,
      status: sig.err ? "failed" : "confirmed",
    });
  }
  for (const tx of input.journal) {
    const out = tx.kind === "withdraw" || tx.kind === "send" || tx.kind === "card" || tx.kind === "cover";
    lines.push({
      id: `journal:${tx.id}`,
      at: Date.parse(tx.createdAt) || 0,
      book: "journal",
      side: out ? "out" : "in",
      title: tx.counterparty || tx.kind,
      detail: `${tx.kind}${tx.note ? ` · ${tx.note}` : ""} · this browser, not the chain`,
      amount: tx.amount,
      unit: tx.ccy,
      href: "",
      status: tx.status,
    });
  }
  for (const card of input.cards) {
    lines.push({
      id: `card:${card.id}`,
      at: Date.parse(card.at) || 0,
      book: "card",
      side: card.status === "approved" ? "out" : "memo",
      title: `${card.merchant} ··${card.last4}`,
      detail: "Browser auth. The card number was not charged.",
      amount: card.amount,
      unit: "USD",
      href: "",
      status: card.rc ? `${card.status} ${card.rc}` : card.status,
    });
  }
  return lines.sort((a, b) => b.at - a.at);
}

const CCY: Ccy[] = ["USD", "EUR", "GBP", "MXN", "USDC", "SOL"];

function usdOf(amount: number, ccy: Ccy, usdPer: Record<string, number>): number {
  const px = ccy === "USD" || ccy === "USDC" ? 1 : usdPer[ccy] || 0;
  return Math.round((amount * (px || (ccy === "USD" ? 1 : 0)) + Number.EPSILON) * 100) / 100;
}

function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

function parseFx(counterparty: string): { to: Ccy; got: number } | null {
  const m = counterparty.match(/^([A-Z]+) → ([A-Z]+) ([0-9.]+)$/);
  if (!m) return null;
  const to = m[2] as Ccy;
  if (!CCY.includes(to)) return null;
  return { to, got: Number(m[3]) || 0 };
}

/** Replay journal into expected spendable+vault balances and stock at cost. */
function replay(w: Wallet): { cash: Record<Ccy, number>; stock: number; fees: number } {
  const cash = Object.fromEntries(CCY.map((c) => [c, 0])) as Record<Ccy, number>;
  let stock = 0;
  let fees = 0;
  const txs = [...w.txs].reverse();
  for (const tx of txs) {
    if (tx.status === "failed") continue;
    fees += (tx.auroFee || 0) + (tx.revolutFee || 0);
    const amt = tx.amount;
    const ccy = tx.ccy;
    if (!CCY.includes(ccy)) continue;
    if (tx.kind === "add" || tx.kind === "receive") cash[ccy] += amt;
    else if (tx.kind === "withdraw" || tx.kind === "send" || tx.kind === "card" || tx.kind === "cover" || tx.kind === "nearby") {
      cash[ccy] -= amt;
    } else if (tx.kind === "vault") {
      if (/into vault/i.test(tx.note)) cash[ccy] -= amt;
      else if (/out of vault/i.test(tx.note)) cash[ccy] += amt;
    } else if (tx.kind === "invest") {
      const sale = /sale/i.test(tx.note);
      const fromVault = /from /i.test(tx.note);
      if (sale) {
        cash[ccy] += amt;
        stock -= amt;
      } else {
        if (!fromVault) cash[ccy] -= amt;
        stock += amt;
      }
    } else if (tx.kind === "fx") {
      cash[ccy] -= amt;
      const leg = parseFx(tx.counterparty);
      if (leg) cash[leg.to] += leg.got;
    }
  }
  return { cash, stock: Math.round(stock * 100) / 100, fees: Math.round(fees * 100) / 100 };
}

export function digestBooks(w: Wallet, usdPer: Record<string, number> = {}): Digest {
  const replayed = replay(w);
  const tokens: BookToken[] = [];

  let assets = 0;
  let suspense = 0;
  for (const ccy of CCY) {
    const vault = w.vaults.filter((v) => v.ccy === ccy).reduce((s, v) => s + v.balance, 0);
    const held = (w.balances[ccy] || 0) + vault;
    const usd = usdOf(held, ccy, usdPer);
    if (held !== 0 || replayed.cash[ccy] !== 0) {
      tokens.push({
        code: `s${ccy}`,
        name: `Cash ${CCY_META[ccy].name}`,
        role: "asset",
        ccy,
        supply: Math.round(held * 10000) / 10000,
        usd,
      });
    }
    assets += usd;
    const gap = usdOf(held - replayed.cash[ccy], ccy, usdPer);
    suspense += gap;
  }

  const stock = replayed.stock;
  if (stock !== 0) {
    tokens.push({
      code: "sSTK",
      name: "Stock at cost",
      role: "asset",
      ccy: "USD",
      supply: stock,
      usd: stock,
    });
    assets += stock;
  }

  const ghost = Math.round(
    w.cards
      .filter((c) => c.disposable && c.status !== "terminated")
      .reduce((s, c) => s + Math.max(0, c.limit - c.spent), 0) * 100,
  ) / 100;
  tokens.push({
    code: "sGHOST",
    name: "Ghost outstanding",
    role: "memo",
    ccy: "USD",
    supply: ghost,
    usd: ghost,
  });

  if (replayed.fees !== 0) {
    tokens.push({
      code: "sFEE",
      name: "Fees charged",
      role: "memo",
      ccy: "USD",
      supply: replayed.fees,
      usd: replayed.fees,
    });
  }

  suspense = Math.round(suspense * 100) / 100;
  if (suspense !== 0) {
    tokens.push({
      code: "sSUSP",
      name: "Suspense",
      role: suspense > 0 ? "asset" : "liability",
      ccy: "USD",
      supply: suspense,
      usd: suspense,
    });
  }

  const capital = Math.round(assets * 100) / 100;
  tokens.push({
    code: "sCAP",
    name: "Owner capital",
    role: "equity",
    ccy: "USD",
    supply: capital,
    usd: capital,
  });

  const cashForGhost = (w.balances.USD || 0) + (w.balances.USDC || 0);
  const body = tokens
    .map((t) => `${t.code}:${t.supply}`)
    .sort()
    .join("|");

  return {
    id: hash(`${w.tag}|${body}|${suspense}`),
    at: new Date().toISOString(),
    tokens,
    assets: Math.round(assets * 100) / 100,
    equity: capital,
    suspense,
    ghost,
    stock,
    fees: replayed.fees,
    tied: Math.abs(suspense) < 0.01 && ghost <= cashForGhost + 0.01 && Math.abs(capital - assets) < 0.01,
  };
}
