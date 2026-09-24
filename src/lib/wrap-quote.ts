/**
 * Wrap quote: same name, two claims.
 *
 * Tessera T-Token = loan-participation right (0% on buy, 20 bps Token-2022
 * transfer on sell, Chainlink PoR, repayment at liquidity event).
 * PreStocks = SPV economic exposure (KYC mint/redeem, DEX otherwise).
 *
 * Last dollars are not comparable — different units-per-token.
 * Implied company value is not comparable — each venue maps token → EV
 * with its own share count.
 *
 * The only unit-free print is premium-to-own-mark:
 *   prem = last/mark − 1
 *   headline wrap = prem_Tessera − prem_PreStocks
 *
 * Tradable wrap haircuts a no-arb band:
 *   Tessera sell fee 20 bps + two DEX half-spreads.
 * Residual is claim risk. Not a share. Not fungible. Paper quote.
 */

import type { WrapperPair } from "@/lib/basis";
import type { HouseListing } from "@/lib/sol-house";

export const TESSERA_FEE = 0.002;

export type WrapSide = "Tessera" | "PreStocks";

export type WrapQuote = {
  family: string;
  label: string;
  tPrem: number;
  pPrem: number;
  headline: number;
  tesseraFee: number;
  dexRt: number;
  band: number;
  tradable: number;
  insideBand: boolean;
  cheap: WrapSide | null;
  rich: WrapSide | null;
  cheapStock: HouseListing;
  richStock: HouseListing;
  residual: string;
};

export function dexHalfSpread(liquidity: number): number {
  if (!(liquidity > 0)) return 0.015;
  return Math.min(0.02, Math.max(0.0005, 80 / liquidity));
}

export function quoteWrap(pair: WrapperPair): WrapQuote | null {
  const t = pair.tessera;
  const p = pair.prestocks;
  if (!t || !p) return null;
  const tPrem = t.premium;
  const pPrem = p.premium;
  if (tPrem == null || pPrem == null) return null;
  const headline = tPrem - pPrem;
  const dexRt = dexHalfSpread(t.liquidity) + dexHalfSpread(p.liquidity);
  const tesseraFee = TESSERA_FEE;
  const band = tesseraFee + dexRt;
  const abs = Math.abs(headline);
  const tradable = abs - band;
  const cheap: WrapSide | null = abs < 0.002 ? null : headline > 0 ? "PreStocks" : "Tessera";
  const rich: WrapSide | null = cheap == null ? null : cheap === "Tessera" ? "PreStocks" : "Tessera";
  const cheapStock = cheap === "PreStocks" ? p : t;
  const richStock = rich === "PreStocks" ? p : t;
  return {
    family: pair.family,
    label: pair.label,
    tPrem,
    pPrem,
    headline,
    tesseraFee,
    dexRt,
    band,
    tradable,
    insideBand: tradable <= 0,
    cheap,
    rich,
    cheapStock,
    richStock,
    residual:
      "Not fungible. Tessera is a loan-participation right (PoR, 20 bp on sell). PreStocks is SPV exposure (KYC mint/redeem). Implied EV uses different share counts — ignore it for the trade.",
  };
}

export function wrapCapture(q: WrapQuote, spend: number): number {
  if (q.insideBand || !(spend > 0)) return 0;
  return spend * q.tradable;
}
