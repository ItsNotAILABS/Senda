/** Turns a Solana wallet plus Jupiter marks into the home book. No prices are invented. */

import type { HoldMark } from "@/lib/hold-marks";
import { SOL_MINT } from "@/lib/hold-marks";
import type { ChainWallet } from "@/lib/phantom";

export type HomeLine = {
  mint: string;
  symbol: string;
  name: string;
  icon: string;
  amount: number;
  price: number;
  value: number;
  /** Jupiter's 24h change. A fraction when |x| <= 2, otherwise already a percent. */
  chg: number;
  chart: boolean;
};

export type HomeBook = {
  total: number;
  day: number;
  lines: HomeLine[];
};

export function asPercent(chg: number): number {
  if (!Number.isFinite(chg) || chg === 0) return 0;
  return Math.abs(chg) <= 2 ? chg * 100 : chg;
}

function dayMove(value: number, chg: number): number {
  const p = asPercent(chg) / 100;
  if (!(value > 0) || p <= -0.99) return 0;
  return value - value / (1 + p);
}

export function bookHome(chain: ChainWallet, marks: Record<string, HoldMark>, cash = 0): HomeBook {
  const lines: HomeLine[] = [];
  if (chain.sol > 0) {
    const mark = marks[SOL_MINT];
    const price = mark?.usd || 0;
    lines.push({
      mint: SOL_MINT,
      symbol: "SOL",
      name: mark?.name || "Solana",
      icon: mark?.icon || "",
      amount: chain.sol,
      price,
      value: chain.sol * price,
      chg: mark?.chg || 0,
      chart: true,
    });
  }
  for (const token of chain.tokens) {
    const mark = marks[token.mint];
    const stable = token.symbol === "USDC" || token.symbol === "USDT" || token.symbol === "USD1";
    const price = mark?.usd || (stable ? 1 : 0);
    lines.push({
      mint: token.mint,
      symbol: mark?.symbol || token.symbol,
      name: mark?.name || token.symbol,
      icon: mark?.icon || "",
      amount: token.ui,
      price,
      value: token.ui * price,
      chg: mark?.chg || 0,
      chart: true,
    });
  }
  if (cash > 0) {
    lines.push({
      mint: "",
      symbol: "USD",
      name: "Cash on the desk",
      icon: "",
      amount: cash,
      price: 1,
      value: cash,
      chg: 0,
      chart: false,
    });
  }
  const total = lines.reduce((sum, line) => sum + line.value, 0);
  const day = lines.reduce((sum, line) => sum + dayMove(line.value, line.chg), 0);
  return { total, day, lines };
}
