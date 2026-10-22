/** What an agent does on a shift. It writes. It does not sign. */

import type { Envelope } from "@/lib/agent-envelope";
import { recall } from "@/lib/agent-memory";
import { bookLevel, drawdown, pushLevel, review } from "@/lib/agent-risk";
import { spendCap } from "@/lib/spend-cap";
import type { HouseListing } from "@/lib/sol-house";

export type Job = "scout" | "discount" | "rich" | "daily" | "cover" | "clerk";

export const JOBS: { id: Job; title: string; line: string }[] = [
  { id: "scout", title: "Scout", line: "Reads the book and writes what moved." },
  { id: "discount", title: "Discount", line: "Queues a buy when a name is cheap versus its mark." },
  { id: "rich", title: "Rich", line: "Queues a sell when a name is rich versus its mark." },
  { id: "daily", title: "Daily", line: "One buy a day. It waits if today already went." },
  { id: "cover", title: "Cover", line: "Flags a name down hard enough to cover." },
  { id: "clerk", title: "Clerk", line: "Writes a line on your sheet for each name it watches." },
];

export type Queue = {
  symbol: string;
  side: "buy" | "sell";
  usd: number;
  why: string;
  order?: "market" | "limit" | "stop";
  action?: "swap" | "pay" | "lend" | "watch";
  limitPx?: number;
  payTo?: string;
};

const SHEET = "senda.sheet.v1";

function pool(env: Envelope, book: HouseListing[]) {
  const rows = book.filter((n) => n.venue === "prestocks" && n.last > 0);
  return env.symbols.length ? rows.filter((n) => env.symbols.includes(n.symbol)) : rows;
}

function gateQueue(env: Envelope, name: HouseListing, side: "buy" | "sell", book: HouseListing[]): { log: string; queue?: Queue } {
  const series = pushLevel(bookLevel(book.map((n) => n.last)));
  const dd = drawdown(series);
  const hits = recall({ premium: name.premium ?? 0, change24h: name.change24h ?? 0, drawdown: dd, side }, 3);
  const again = hits.find((h) => h.memory.symbol === name.symbol && h.memory.side === side && h.score > 0.8);
  const asked = again ? Math.max(1, Math.round(env.maxUsd / 2)) : env.maxUsd;
  const gate = review({
    symbol: name.symbol,
    side,
    usd: asked,
    premium: name.premium,
    change24h: name.change24h,
    series,
    cap: spendCap(),
  });
  const memory = again ? ` Same tape as the last ${again.memory.side} of ${again.memory.symbol}, so the size is cut.` : "";
  if (gate.blocked || !(gate.usd > 0)) return { log: `${gate.blocked || gate.risk}${memory}` };
  return {
    log: `${name.symbol} queued at $${gate.usd}. ${gate.risk}${memory}`,
    queue: stamp(env, { symbol: name.symbol, side, usd: gate.usd, why: gate.risk }),
  };
}

function throughPrice(env: Envelope, name: HouseListing, side: "buy" | "sell"): { ok: boolean; log: string } {
  const order = env.order || "market";
  if (order === "market") return { ok: true, log: "" };
  const px = env.limitPx ?? 0;
  if (!(px > 0)) return { ok: false, log: "Set a price on the contract before this can queue." };
  if (!(name.last > 0)) return { ok: false, log: `${name.symbol} has no last.` };
  const touched = order === "limit" ? (side === "buy" ? name.last <= px : name.last >= px) : side === "sell" ? name.last <= px : name.last >= px;
  return touched
    ? { ok: true, log: "" }
    : { ok: false, log: `${name.symbol} is ${name.last}. The ${order} is ${px}. Not touched.` };
}

function stamp(env: Envelope, queue: Queue): Queue {
  return {
    ...queue,
    order: env.order || "market",
    action: env.action || "swap",
    limitPx: env.limitPx,
    payTo: env.payTo,
  };
}

export function think(env: Envelope, book: HouseListing[]): { log: string; queue?: Queue } | null {
  if (env.armed === false) return null;
  const day = new Date().toISOString().slice(0, 10);
  if (env.signedOn === day) return { log: "This contract already signed today." };
  if (env.lastTick && Date.now() - Date.parse(env.lastTick) < 18_000) return null;
  if (env.action === "pay") {
    if (!env.payTo) return { log: "No address on the contract. Nothing to sign." };
    return {
      log: `Pay $${env.maxUsd} USDC is waiting on your signature.`,
      queue: stamp(env, { symbol: "USDC", side: "buy", usd: env.maxUsd, why: "Approved pay" }),
    };
  }
  if (env.action === "lend") {
    return {
      log: "SPYx, QQQx, and NVDAx can be lent on the Kamino xStocks market. Yield comes back as the same token. Open that market and sign there.",
      queue: stamp(env, { symbol: "SPYx", side: "buy", usd: env.maxUsd, why: "In-kind yield" }),
    };
  }
  if (env.action === "watch") return { log: "Watching. This contract does not send." };
  const rows = pool(env, book);
  if (!rows.length) return { log: "Nothing on the book to watch." };
  const job = env.job || "scout";
  const cheap = [...rows].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...rows].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  if (job === "scout") {
    return { log: `${cheap.symbol} is the cheap one. ${rich.symbol} is the rich one.` };
  }
  if (job === "discount" && (cheap.premium ?? 0) < -0.03) {
    const gate = throughPrice(env, cheap, "buy");
    if (!gate.ok) return { log: gate.log };
    return gateQueue(env, cheap, "buy", rows);
  }
  if (job === "rich" && (rich.premium ?? 0) > 0.03) {
    const gate = throughPrice(env, rich, "sell");
    if (!gate.ok) return { log: gate.log };
    return gateQueue(env, rich, "sell", rows);
  }
  if (job === "daily") {
    const day = new Date().toISOString().slice(0, 10);
    if (env.lastTick?.slice(0, 10) === day) return { log: "Today's buy already queued." };
    const gate = throughPrice(env, rows[0], "buy");
    if (!gate.ok) return { log: gate.log };
    return gateQueue(env, rows[0], "buy", rows);
  }
  if (job === "cover") {
    const hit = rows.find((n) => (n.change24h ?? 0) < -0.05);
    return { log: hit ? `${hit.symbol} is down hard. Cover it on the book if you want.` : "Nothing is down hard enough to cover." };
  }
  if (job === "clerk") {
    try {
      const cur = JSON.parse(window.localStorage.getItem(SHEET) || "{}") as Record<string, string>;
      for (const n of rows.slice(0, 6)) {
        const pct = n.premium == null ? "—" : `${(n.premium * 100).toFixed(1)}% vs mark`;
        cur[n.symbol] = `${pct} · ${new Date().toISOString().slice(11, 16)}`;
      }
      window.localStorage.setItem(SHEET, JSON.stringify(cur));
    } catch {
      /* quota */
    }
    return { log: `Wrote ${Math.min(6, rows.length)} lines onto the sheet.` };
  }
  return { log: "Watching. Nothing to queue." };
}
