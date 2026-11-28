/**
 * What a venue already charges, and the piece this desk will attach.
 * Half is not a second payment. We attach half the cut and leave the other half off the quote.
 */

export type VenueCut = {
  id: string;
  venue: string;
  what: string;
  theirs: string;
  askBps: number;
  takeBps: number;
  needs: string;
  wired: boolean;
};

export const VENUE_CUTS: VenueCut[] = [
  { id: "spot", venue: "Jupiter swap", what: "A token that is not SOL", theirs: "No protocol fee. Eight bps only when this route beats the other quote.", askBps: 8, takeBps: 8, needs: "A Jupiter fee token account", wired: true },
  { id: "bridge", venue: "deBridge", what: "A cross-chain send", theirs: "About 4 bps protocol, plus a solver margin and a flat gas fee.", askBps: 8, takeBps: 4, needs: "A Solana wallet, not the swap fee account", wired: true },
  { id: "kamino", venue: "Kamino", what: "A borrow", theirs: "A share of Kamino’s own borrow fee. It does not raise the rate. The referrer is permanent.", askBps: 0, takeBps: 0, needs: "A Kamino referrer, set once", wired: false },
  { id: "perps", venue: "Jupiter perps", what: "A short", theirs: "Six bps to open and six to close. That is Jupiter’s. No integrator fee is published.", askBps: 0, takeBps: 0, needs: "Nothing to attach", wired: false },
  { id: "drift", venue: "Drift", what: "A perp on their book", theirs: "A builder fee the user approves, paid when they settle. A referral is 35% of taker fees and 5% off for the user.", askBps: 0, takeBps: 0, needs: "A Drift revenue account and a user approval", wired: false },
  { id: "limit", venue: "Jupiter Trigger", what: "A resting limit", theirs: "No fee on the order. A referral account would charge at the fill. We do not add one.", askBps: 0, takeBps: 0, needs: "Left off on purpose", wired: false },
];

/** Half of the ask, in bps. The rest stays in the user’s output. */
export function halfCut(askBps: number): { take: number; left: number } {
  if (!(askBps > 0)) return { take: 0, left: 0 };
  const take = Math.floor(askBps / 2);
  return { take, left: askBps - take };
}

export function bridgeWallet(): string {
  const raw = import.meta.env.VITE_SENDA_BRIDGE_WALLET;
  return typeof raw === "string" ? raw.trim() : "";
}

/** deBridge takes a percent. Four bps is 0.04. Empty until a wallet is set. */
export function bridgeAffiliate(): { percent: string; wallet: string } | null {
  const wallet = bridgeWallet();
  if (!wallet) return null;
  return { percent: (halfCut(8).take / 100).toFixed(2), wallet };
}

export function cutLine(row: VenueCut, usd: number): string {
  const money = (usd * (row.takeBps || row.askBps)) / 10_000;
  const shown = money >= 0.01 ? `$${money.toFixed(2)}` : `$${money.toFixed(4)}`;
  if (row.id === "bridge") {
    if (!bridgeWallet()) return `deBridge would keep 4 bps (${shown} on $${usd}) and leave 4 bps in your output. No bridge wallet is set, so this quote has no affiliate fee.`;
    return `deBridge keeps 4 bps (${shown} on $${usd}). The other 4 bps was not added. That is the rebate.`;
  }
  if (!row.wired || row.takeBps === 0) return `${row.venue}: nothing attached. ${row.needs}.`;
  return `${row.venue}: ${row.takeBps} bps, ${shown} on $${usd}.`;
}
