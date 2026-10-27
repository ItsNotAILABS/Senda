/** What an agent does on a shift. It writes. It does not sign. */

import type { Envelope } from "@/lib/agent-envelope";
import { recall } from "@/lib/agent-memory";
import { bookLevel, drawdown, pushLevel, review } from "@/lib/agent-risk";
import { spendCap } from "@/lib/spend-cap";
import { basisBps } from "@/lib/market-engine";
import { loadTapes } from "@/lib/indicators";
import { shortBook } from "@/lib/short-market";
import type { HouseListing } from "@/lib/sol-house";

export type Job = "scout" | "discount" | "rich" | "daily" | "cover" | "clerk" | "basis" | "tape" | "signal";

export const JOBS: { id: Job; title: string; line: string }[] = [
  { id: "scout", title: "Scout", line: "Reads the book and writes what moved." },
  { id: "discount", title: "Discount", line: "Queues a buy when a name is cheap versus its mark." },
  { id: "rich", title: "Rich", line: "Queues a sell when a name is rich versus its mark." },
  { id: "daily", title: "Daily", line: "One buy a day. It waits if today already went." },
  { id: "cover", title: "Cover", line: "Flags a name down hard enough to cover." },
  { id: "clerk", title: "Clerk", line: "Writes a line on your sheet for each name it watches." },
  { id: "basis", title: "Basis", line: "Queues a buy when last is cheap versus the mark, or a sell when it is rich. The gap is measured here. You still sign." },
  { id: "tape", title: "Tape", line: "Names the print that moved the most. It writes. It does not queue." },
  { id: "signal", title: "Signal", line: "Reads RSI, MACD, and the averages from a chart you opened. Queues a buy or a short. You still sign." },
];

export type Queue = { symbol: string; side: "buy" | "sell" | "short"; usd: number; why: string };

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
  if (job === "basis") {
    const scored = rows
      .filter((n) => n.mark > 0 && n.last > 0)
      .map((n) => ({ n, bps: basisBps(n.last, n.mark) ?? 0 }))
      .sort((a, b) => a.bps - b.bps);
    const cheap = scored[0];
    if (cheap && cheap.bps <= -30) return gateQueue(env, cheap.n, "buy", rows);
    const rich = scored[scored.length - 1];
    if (rich && rich.bps >= 30) return gateQueue(env, rich.n, "sell", rows);
    return { log: "Basis is inside 30 bps. Nothing queued." };
  }
  if (job === "tape") {
    const moved = [...rows].sort((a, b) => Math.abs(b.change24h ?? 0) - Math.abs(a.change24h ?? 0))[0];
    if (!moved) return { log: "No print to read." };
    const pct = moved.change24h == null ? "—" : `${moved.change24h > 0 ? "+" : ""}${(moved.change24h * 100).toFixed(1)}%`;
    return { log: `${moved.symbol} moved the most, ${pct}. Nothing queued.` };
  }
  if (job === "signal") {
    const tapes = loadTapes();
    const hit = rows
      .map((n) => ({ n, tape: tapes[n.symbol.toUpperCase()] }))
      .find((row) => row.tape && row.tape.bias !== "flat" && Date.now() - row.tape.at < 30 * 60_000);
    if (!hit?.tape) return { log: "No fresh chart. Open a name so RSI and MACD are on the tape." };
    if (hit.tape.bias === "long") return gateQueue(env, hit.n, "buy", rows);
    const book = shortBook(hit.n.symbol);
    if (!book) return { log: `${hit.n.symbol} reads short. ${hit.tape.why} There is no short market, so nothing was queued.` };
    const sized = gateQueue(env, hit.n, "sell", rows);
    if (!sized.queue) return sized;
    return { log: `${hit.n.symbol} short via ${book.label}. ${hit.tape.why}`, queue: { ...sized.queue, side: "short", why: hit.tape.why } };
  }
  return { log: "Watching. Nothing to queue." };
}
