/** Runs a spec against the live book. The result is a list of orders. Nothing is signed here. */

import { wrapperPairs } from "@/lib/basis";
import { sized } from "@/lib/book-strategies";
import type { AdvisorOrder, AdvisorRun, AdvisorSpec } from "@/lib/advisors/types";
import type { HouseListing } from "@/lib/sol-house";
import { quoteWrap } from "@/lib/wrap-quote";

export type RunOver = { split?: AdvisorSpec["split"]; take?: number };

function roomOf(budget: number, cap: number): number {
  return sized(budget, cap);
}

function cuts(room: number, count: number): number[] {
  if (count <= 0 || !(room > 0)) return [];
  const each = Math.floor((room / count) * 100) / 100;
  return Array.from({ length: count }, () => each);
}

function priced(book: HouseListing[]): HouseListing[] {
  return book.filter((row) => row.mint && row.last > 0);
}

function byRank(spec: AdvisorSpec) {
  return (a: HouseListing, b: HouseListing) => {
    if (spec.rank === "liquidity") return (b.liquidity ?? 0) - (a.liquidity ?? 0);
    if (spec.rank === "change") {
      const left = a.change24h ?? 0;
      const right = b.change24h ?? 0;
      return spec.side === "sell" ? right - left : left - right;
    }
    const left = a.premium ?? 0;
    const right = b.premium ?? 0;
    return spec.side === "sell" ? right - left : left - right;
  };
}

function passes(row: HouseListing, spec: AdvisorSpec): boolean {
  if (spec.premiumMax != null && (row.premium == null || row.premium > spec.premiumMax)) return false;
  if (spec.premiumMin != null && (row.premium == null || row.premium < spec.premiumMin)) return false;
  if (spec.changeMax != null && (row.change24h == null || row.change24h > spec.changeMax)) return false;
  if (spec.changeMin != null && (row.change24h == null || row.change24h < spec.changeMin)) return false;
  if ((row.liquidity ?? 0) < spec.minLiquidity) return false;
  return true;
}

function finish(spec: AdvisorSpec, orders: AdvisorOrder[], room: number): AdvisorRun {
  if (!(room > 0)) {
    return { id: spec.id, title: spec.title, line: spec.line, orders: [], note: "The cap leaves nothing to size." };
  }
  if (!orders.length) {
    return { id: spec.id, title: spec.title, line: spec.line, orders: [], note: "Nothing on this book passed this file." };
  }
  return {
    id: spec.id,
    title: spec.title,
    line: spec.line,
    orders,
    note: `${orders.length} ${orders.length === 1 ? "order" : "orders"}. Nothing is signed.`,
  };
}

export function runAdvisor(spec: AdvisorSpec, book: HouseListing[], budget: number, cap: number, over: RunOver = {}): AdvisorRun {
  const split = over.split ?? spec.split;
  const take = split === "one" ? 1 : Math.min(8, over.take ?? spec.take);
  const room = roomOf(budget, cap);
  const rows = priced(book);
  if (!(room > 0)) return finish(spec, [], room);

  if (spec.mode === "wrap") {
    const wraps = wrapperPairs(rows)
      .map((pair) => quoteWrap(pair))
      .filter((row): row is NonNullable<typeof row> => Boolean(row && !row.insideBand && row.tradable > 0 && row.cheapStock.mint && row.cheapStock.last > 0))
      .sort((a, b) => b.tradable - a.tradable)
      .slice(0, take);
    const usd = split === "one" ? [room] : cuts(room, wraps.length);
    const orders = wraps.map((row, i) => ({
      symbol: row.cheapStock.symbol,
      mint: row.cheapStock.mint,
      side: "buy" as const,
      premium: row.headline,
      last: row.cheapStock.last,
      usd: usd[i] ?? 0,
    }));
    return finish(spec, orders, room);
  }

  if (spec.mode === "day-worst" || spec.mode === "day-best") {
    const days = rows.filter((row) => row.change24h != null && Number.isFinite(row.change24h)).sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0));
    const worst = days[0];
    const best = days[days.length - 1];
    const pick = spec.mode === "day-worst" ? worst : best;
    const bound = spec.mode === "day-worst" ? (spec.changeMax ?? -0.01) : (spec.changeMin ?? 0.01);
    const ok = spec.mode === "day-worst"
      ? Boolean(pick && (pick.change24h ?? 0) <= bound)
      : Boolean(pick && pick !== worst && (pick.change24h ?? 0) >= bound);
    if (!ok || !pick) return finish(spec, [], room);
    return finish(spec, [{
      symbol: pick.symbol,
      mint: pick.mint,
      side: spec.side,
      premium: pick.change24h ?? 0,
      last: pick.last,
      usd: room,
    }], room);
  }

  const hits = rows.filter((row) => passes(row, spec)).sort(byRank(spec)).slice(0, take);
  const usd = split === "one" ? [room] : cuts(room, hits.length);
  const orders = hits.map((row, i) => ({
    symbol: row.symbol,
    mint: row.mint,
    side: spec.side,
    premium: row.premium ?? row.change24h ?? 0,
    last: row.last,
    usd: usd[i] ?? 0,
  }));
  return finish(spec, orders, room);
}
