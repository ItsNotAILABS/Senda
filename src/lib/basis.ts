/**
 * Wrapper basis on dual-listed names.
 *
 * Last and implied EV are different units on Tessera vs PreStocks.
 * Wrap print is premium-to-own-mark: wrap = prem_T − prem_P.
 * See wrap-quote.ts for the tradable haircut.
 */

import { familyOf } from "@/lib/combo-quote";
import type { HouseListing } from "@/lib/sol-house";

export type WrapperPair = {
  family: string;
  label: string;
  tessera: HouseListing | null;
  prestocks: HouseListing | null;
  tesseraPrem: number | null;
  prestocksPrem: number | null;
  wrap: number | null;
  valGap: number | null;
};

const LABELS: Record<string, string> = {
  kalshi: "Kalshi",
  openai: "OpenAI",
  spacex: "SpaceX",
  polymarket: "Polymarket",
  anthropic: "Anthropic",
  xai: "xAI",
  anduril: "Anduril",
};

export function formatBps(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const bps = Math.round(p * 10_000);
  const sign = bps > 0 ? "+" : "";
  if (Math.abs(bps) >= 1_000) return `${sign}${(p * 100).toFixed(1)}%`;
  return `${sign}${bps.toLocaleString("en-US")} bp`;
}

export function wrapperPairs(rows: HouseListing[]): WrapperPair[] {
  const by = new Map<string, { tessera?: HouseListing; prestocks?: HouseListing }>();
  for (const r of rows) {
    const fam = familyOf(r.symbol);
    const slot = by.get(fam) ?? {};
    if (r.venue === "tessera") slot.tessera = r;
    else slot.prestocks = r;
    by.set(fam, slot);
  }
  const out: WrapperPair[] = [];
  for (const [family, slot] of by) {
    if (!slot.tessera || !slot.prestocks) continue;
    const tesseraPrem = slot.tessera.premium;
    const prestocksPrem = slot.prestocks.premium;
    const wrap =
      tesseraPrem != null && prestocksPrem != null ? tesseraPrem - prestocksPrem : null;
    const tv = slot.tessera.valuation;
    const pv = slot.prestocks.valuation;
    const valGap = tv > 0 && pv > 0 ? tv / pv - 1 : null;
    out.push({
      family,
      label: LABELS[family] ?? family,
      tessera: slot.tessera,
      prestocks: slot.prestocks,
      tesseraPrem,
      prestocksPrem,
      wrap,
      valGap,
    });
  }
  out.sort((a, b) => Math.abs(b.valGap ?? 0) - Math.abs(a.valGap ?? 0));
  return out;
}
