import { dollarsOf, recordMove } from "@/lib/moves";

export type Bucket = "hold" | "trade" | "send";

export type Fill = {
  id: string;
  ts: number;
  symbol: string;
  mint: string;
  side: "buy" | "sell";
  bucket: Bucket;
  usd: number;
  qty: number;
  signature: string;
};

export type Lot = {
  bucket: Bucket;
  mint: string;
  symbol: string;
  qty: number;
  cost: number;
  value: number;
  pnl: number | null;
};

export type Act = {
  id: string;
  ts: number;
  kind: "swap" | "send";
  title: string;
  detail: string;
  signature: string;
};

const FILLS = "senda.fills.v1";
const ACTS = "senda.acts.v1";
const INTENT = "senda.intent.v1";

export function currentIntent(): Bucket {
  if (typeof localStorage === "undefined") return "hold";
  const value = localStorage.getItem(INTENT);
  return value === "trade" || value === "send" ? value : "hold";
}

export function setIntent(bucket: Bucket | null) {
  if (typeof localStorage === "undefined") return;
  if (!bucket) localStorage.removeItem(INTENT);
  else localStorage.setItem(INTENT, bucket);
}

export function readFills(): Fill[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(FILLS) || "[]") as Fill[];
    return Array.isArray(raw) ? raw.filter((row) => row && typeof row.signature === "string") : [];
  } catch {
    return [];
  }
}

export function recordFill(input: Omit<Fill, "id" | "ts">) {
  if (typeof localStorage === "undefined" || !input.signature) return;
  const all = readFills();
  if (all.some((row) => row.signature === input.signature && row.mint === input.mint && row.side === input.side)) return;
  const row: Fill = { ...input, id: `${Date.now()}-${input.signature.slice(0, 6)}`, ts: Date.now() };
  localStorage.setItem(FILLS, JSON.stringify([row, ...all].slice(0, 200)));
  window.dispatchEvent(new Event("senda-book"));
}

export function readActs(): Act[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(ACTS) || "[]") as Act[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function noteAct(input: Omit<Act, "id" | "ts"> & { usd?: number }) {
  if (typeof localStorage === "undefined" || !input.signature) return;
  const all = readActs();
  const seen = all.some((row) => row.signature === input.signature && row.title === input.title);
  if (!seen) {
    const row: Act = { ...input, id: `${Date.now()}-${input.signature.slice(0, 6)}`, ts: Date.now() };
    localStorage.setItem(ACTS, JSON.stringify([row, ...all].slice(0, 80)));
    window.dispatchEvent(new Event("senda-book"));
    window.dispatchEvent(new Event("senda-chain"));
  }
  const usd = dollarsOf(input.title, input.detail, input.usd);
  if (usd > 0) {
    void recordMove({ data: { signature: input.signature, kind: input.kind, title: input.title, usd } }).catch(() => undefined);
  }
}

export function lotsFrom(
  fills: Fill[],
  chain: Array<{ mint: string; ui: number }>,
  marks: Array<{ mint: string; symbol: string; last: number }>,
): { hold: Lot[]; trade: Lot[]; holdValue: number; tradeValue: number; pnl: number } {
  const mark = new Map(marks.filter((row) => row.mint && row.last > 0).map((row) => [row.mint, row]));
  const books = {
    hold: new Map<string, { qty: number; cost: number; symbol: string }>(),
    trade: new Map<string, { qty: number; cost: number; symbol: string }>(),
  };
  for (const fill of [...fills].sort((a, b) => a.ts - b.ts)) {
    const bucket = fill.bucket === "trade" ? "trade" : "hold";
    const map = books[bucket];
    const cur = map.get(fill.mint) ?? { qty: 0, cost: 0, symbol: fill.symbol };
    if (fill.side === "buy" && fill.qty > 0) {
      cur.qty += fill.qty;
      cur.cost += fill.usd;
    } else if (cur.qty > 0 && fill.qty > 0) {
      const qty = Math.min(fill.qty, cur.qty);
      const avg = cur.cost / cur.qty;
      cur.qty -= qty;
      cur.cost = Math.max(0, cur.cost - avg * qty);
    }
    cur.symbol = fill.symbol || cur.symbol;
    if (cur.qty <= 1e-9) map.delete(fill.mint);
    else map.set(fill.mint, cur);
  }
  const onChain = new Map(chain.map((row) => [row.mint, row.ui]));
  function pile(bucket: "hold" | "trade"): Lot[] {
    const rows: Lot[] = [];
    for (const [mint, acc] of books[bucket]) {
      const other = (bucket === "hold" ? books.trade : books.hold).get(mint)?.qty ?? 0;
      const total = acc.qty + other;
      const held = onChain.get(mint);
      const scale = held != null && total > 0 ? Math.min(1, held / total) : 1;
      const qty = acc.qty * scale;
      const cost = acc.cost * scale;
      if (qty <= 0) continue;
      const last = mark.get(mint)?.last ?? 0;
      const value = last > 0 ? qty * last : cost;
      rows.push({
        bucket,
        mint,
        symbol: mark.get(mint)?.symbol || acc.symbol,
        qty,
        cost,
        value,
        pnl: last > 0 ? value - cost : null,
      });
    }
    return rows;
  }
  const hold = pile("hold");
  const trade = pile("trade");
  const holdValue = hold.reduce((sum, row) => sum + row.value, 0);
  const tradeValue = trade.reduce((sum, row) => sum + row.value, 0);
  const pnl = [...hold, ...trade].reduce((sum, row) => sum + (row.pnl ?? 0), 0);
  return { hold, trade, holdValue, tradeValue, pnl };
}
