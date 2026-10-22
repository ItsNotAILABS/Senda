/** Friends games on the same Senda cash. Paper settle from last vs mark. */

import type { HouseListing } from "@/lib/sol-house";

export type PlayKind = "direction" | "closer";

export type Challenge = {
  id: string;
  kind: PlayKind;
  friend: string;
  tag: string;
  symbol: string;
  stake: number;
  pick: "up" | "down";
  result: "win" | "lose" | "open";
  pnl: number;
  createdAt: string;
};

const KEY = "senda.play.v1";

export const FRIENDS = [
  { name: "Rosa M.", tag: "@rosa" },
  { name: "Luis H.", tag: "@luis" },
  { name: "Sofia R.", tag: "@sofia" },
  { name: "Montesas", tag: "@montesas" },
];

export function loadPlay(): Challenge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const p = JSON.parse(raw) as Challenge[];
    return Array.isArray(p) ? p.slice(0, 40) : [];
  } catch {
    return [];
  }
}

function savePlay(rows: Challenge[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* quota */
  }
}

export function settleDirection(stock: HouseListing, pick: "up" | "down"): "win" | "lose" {
  const chg = stock.change24h ?? 0;
  const up = chg >= 0;
  const won = (pick === "up" && up) || (pick === "down" && !up);
  return won ? "win" : "lose";
}

export function settleCloser(stock: HouseListing): "win" | "lose" {
  const prem = stock.premium ?? 0;
  return Math.abs(prem) < 0.08 ? "win" : "lose";
}

export function dropChallenge(rows: Challenge[], row: Challenge): Challenge[] {
  const next = [row, ...rows];
  savePlay(next);
  return next;
}
