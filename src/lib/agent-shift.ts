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

export type Queue = { symbol: string; side: "buy" | "sell"; usd: number; why: string };

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
    queue: { symbol: name.symbol, side, usd: gate.usd, why: gate.risk },
  };
}

export function think(env: Envelope, book: HouseListing[]): { log: string; queue?: Queue } | null {
  if (env.armed === false) return null;
  if (env.lastTick && Date.now() - Date.parse(env.lastTick) < 18_000) return null;
  const rows = pool(env, book);
  if (!rows.length) return { log: "Nothing on the book to watch." };
  const job = env.job || "scout";
  const cheap = [...rows].sort((a, b) => (a.premium ?? 0) - (b.premium ?? 0))[0];
  const rich = [...rows].sort((a, b) => (b.premium ?? 0) - (a.premium ?? 0))[0];
  if (job === "scout") {
    return { log: `${cheap.symbol} is the cheap one. ${rich.symbol} is the rich one.` };
  }
  if (job === "discount" && (cheap.premium ?? 0) < -0.03) return gateQueue(env, cheap, "buy", rows);
  if (job === "rich" && (rich.premium ?? 0) > 0.03) return gateQueue(env, rich, "sell", rows);
  if (job === "daily") {
    const day = new Date().toISOString().slice(0, 10);
    if (env.lastTick?.slice(0, 10) === day) return { log: "Today's buy already queued." };
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
