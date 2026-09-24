/**
 * Paper options on token last. Cash-or-nothing digitals.
 * σ from 24h move, annualized, floored at 35% — pre-IPO is wide.
 * Not listed CBOE. Not a live order.
 */

import { normCdf } from "@/lib/combo-quote";
import type { HouseListing } from "@/lib/sol-house";

export type OptTenor = "1h" | "1d" | "7d";
export type OptKind = "call" | "put";

export type OptContract = {
  id: string;
  underlyingId: string;
  symbol: string;
  kind: OptKind;
  strike: number;
  tenor: OptTenor;
  expiryAt: number;
  mid: number;
  ask: number;
  delta: number;
  atm: boolean;
};

const VIG = 0.04;
const SIG_FLOOR = 0.35;

export const TENORS: Array<{ id: OptTenor; label: string }> = [
  { id: "1h", label: "1 hour" },
  { id: "1d", label: "Daily" },
  { id: "7d", label: "Week" },
];

export function tenorMs(tenor: OptTenor, now = Date.now()): number {
  if (tenor === "1h") return 3_600_000 - (now % 3_600_000);
  if (tenor === "7d") return 7 * 86_400_000;
  const day = 86_400_000;
  return day - (now % day);
}

export function expiryAt(tenor: OptTenor, now = Date.now()): number {
  return now + tenorMs(tenor, now);
}

export function annualSigma(change24h: number | null): number {
  const d = Math.abs(change24h ?? 0);
  return Math.min(2.5, Math.max(SIG_FLOOR, d * Math.sqrt(365)));
}

function niceStrike(s: number): number {
  if (!(s > 0)) return 0;
  if (s >= 500) return Math.round(s / 5) * 5;
  if (s >= 100) return Math.round(s);
  if (s >= 20) return Math.round(s * 2) / 2;
  return Math.round(s * 10) / 10;
}

function digital(S: number, K: number, sig: number, t: number, kind: OptKind): number {
  if (!(S > 0) || !(K > 0) || !(t > 0)) return 0.5;
  const vol = Math.max(sig * Math.sqrt(t), 1e-6);
  const d2 = (Math.log(S / K) - 0.5 * sig * sig * t) / vol;
  const p = kind === "call" ? normCdf(d2) : normCdf(-d2);
  return Math.min(0.97, Math.max(0.03, p));
}

const OFFSETS = [-0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1];

export function chainFor(stock: HouseListing, tenor: OptTenor, now = Date.now()): OptContract[] {
  const S = stock.last;
  if (!(S > 0)) return [];
  const t = Math.max(tenorMs(tenor, now) / (365 * 86_400_000), 1 / (365 * 24 * 60));
  const sig = annualSigma(stock.change24h);
  const exp = expiryAt(tenor, now);
  const strikes = new Set<number>();
  for (const o of OFFSETS) strikes.add(niceStrike(S * (1 + o)));
  if (stock.mark > 0) strikes.add(niceStrike(stock.mark));
  const sorted = [...strikes].filter((k) => k > 0).sort((a, b) => a - b);
  const atmK = niceStrike(S);
  const out: OptContract[] = [];
  for (const K of sorted) {
    for (const kind of ["call", "put"] as const) {
      const mid = digital(S, K, sig, t, kind);
      out.push({
        id: `${stock.id}:${tenor}:${K}:${kind}`,
        underlyingId: stock.id,
        symbol: stock.symbol,
        kind,
        strike: K,
        tenor,
        expiryAt: exp,
        mid,
        ask: Math.min(0.98, mid * (1 + VIG)),
        delta: kind === "call" ? mid : mid - 1,
        atm: K === atmK,
      });
    }
  }
  return out;
}

export function formatStrike(k: number): string {
  if (!(k > 0)) return "—";
  if (k >= 100) return k.toFixed(0);
  if (k >= 10) return k.toFixed(1);
  return k.toFixed(2);
}

export function formatDebit(p: number): string {
  return `${Math.round(p * 100)}¢`;
}
