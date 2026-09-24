import type { WrapperPair } from "@/lib/basis";
import { formatBps } from "@/lib/basis";
import { formatUsd, type HouseListing } from "@/lib/sol-house";
import { quoteWrap } from "@/lib/wrap-quote";

export function structureOf(stock: HouseListing): "Loan" | "SPV" {
  return stock.venue === "tessera" ? "Loan" : "SPV";
}

export function structureLine(stock: HouseListing): string {
  return stock.venue === "tessera"
    ? "A Tessera T-Token is a loan-participation right. It is not a share of the company."
    : "A PreStock is SPV economic exposure. It is not a share of the company.";
}

export function vsMarkLine(stock: HouseListing): string {
  const p = stock.premium;
  if (p == null || !Number.isFinite(p)) return "No private mark on this print.";
  const pct = Math.abs(p * 100).toFixed(1);
  if (Math.abs(p) < 0.005) {
    return `Last is in line with the private mark of ${formatUsd(stock.mark)}.`;
  }
  if (p > 0) {
    return `Last is ${pct}% above the private mark (${formatUsd(stock.mark)}). The token is rich to mark.`;
  }
  return `Last is ${pct}% below the private mark (${formatUsd(stock.mark)}). The token is cheap to mark.`;
}

export function cheaperVenue(pair: WrapperPair): "Tessera" | "PreStocks" | null {
  return quoteWrap(pair)?.cheap ?? null;
}

export function wrapLine(pair: WrapperPair): string {
  const q = quoteWrap(pair);
  const t = pair.tessera;
  const s = pair.prestocks;
  if (!t || !s) return `${pair.label} lists on one venue.`;
  if (!q) return `${pair.label} lists as ${t.symbol} and ${s.symbol}. Marks not in.`;
  const head = `Headline wrap ${formatBps(q.headline)} (Tessera prem − PreStocks prem).`;
  if (!q.cheap) return `${head} Inside the ${formatBps(q.band)} no-arb band.`;
  if (q.insideBand) {
    return `${head} ${q.cheap} is cheaper to mark, but the gap does not clear Tessera’s 20 bp sell fee plus DEX.`;
  }
  return `${head} Tradable ${formatBps(q.tradable)} after fees. Long ${q.cheapStock.symbol}, short ${q.richStock.symbol}.`;
}

export function counterpartOf(stock: HouseListing, rows: HouseListing[]): HouseListing | null {
  const fam = stock.symbol.toUpperCase().replace(/^T-/, "").replace(/[^A-Z]/g, "");
  return (
    rows.find((r) => {
      if (r.id === stock.id) return false;
      const other = r.symbol.toUpperCase().replace(/^T-/, "").replace(/[^A-Z]/g, "");
      return other === fam && r.venue !== stock.venue;
    }) ?? null
  );
}
