/**
 * Policy check before Phantom is asked to sign an agent order.
 * The wallet stays the signer. This module holds no key and never signs.
 * Impact above 1% is the same thin-book line the desk fee already uses.
 */

import { spendCap } from "@/lib/spend-cap";

export type ParallaxReceipt = {
  ok: boolean;
  why: string;
  usd: number;
  impact: number;
  budgetLeft: number;
  escrow: string;
};

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Refuse a size, a thin book, a blown budget, or a send with no work job. */
export function checkParallax(input: {
  owner: string;
  symbol: string;
  side: "buy" | "sell" | "send";
  usd: number;
  impact: number;
  budgetLeft: number;
  escrow?: string;
}): ParallaxReceipt {
  const side = input.side;
  const usd = input.usd;
  const impact = input.impact;
  const budgetLeft = Number.isFinite(input.budgetLeft) ? input.budgetLeft : 0;
  const escrow = (input.escrow ?? "").trim();
  const symbol = input.symbol.trim() || "this name";
  const owner = input.owner.trim();
  const pocket = owner.length >= 4 ? `${owner.slice(0, 4)}…` : "this wallet";
  const receipt = (ok: boolean, why: string): ParallaxReceipt => ({
    ok,
    why,
    usd: Number.isFinite(usd) ? usd : 0,
    impact: Number.isFinite(impact) ? impact : 0,
    budgetLeft,
    escrow,
  });

  if (!Number.isFinite(usd) || !(usd > 0)) {
    return receipt(false, "The size is not a usable dollar amount, so the wallet was not asked.");
  }
  if (usd > spendCap()) {
    return receipt(
      false,
      `That is ${money(usd)}, above the ${money(spendCap())} spend cap, so the wallet was not asked.`,
    );
  }
  if (!Number.isFinite(impact)) {
    return receipt(false, "Impact is not a number, so the wallet was not asked.");
  }
  if (impact > 1) {
    return receipt(
      false,
      `Impact is ${impact.toFixed(2)}%, above 1%, so the wallet was not asked.`,
    );
  }
  if (usd > budgetLeft) {
    return receipt(
      false,
      `That is ${money(usd)}, above the ${money(budgetLeft)} left in this agent's budget, so the wallet was not asked.`,
    );
  }
  if (side === "send" && !escrow) {
    return receipt(false, "A send has no work job attached, so the wallet was not asked.");
  }
  const verb = side === "buy" ? "Buy" : side === "sell" ? "Sell" : "Send";
  const job = side === "send" ? `, on work job ${escrow}` : "";
  return receipt(
    true,
    `${verb} ${money(usd)} of ${symbol} from ${pocket} is inside the spend cap, at or under 1% impact, and inside the ${money(budgetLeft)} left${job}.`,
  );
}
