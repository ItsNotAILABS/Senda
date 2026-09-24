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
