/** A spend card is a cap and a destination. Using it sends USDC. It is not a Mastercard number. */

import { payUsdc } from "@/lib/solana-pay";

const KEY = "senda.cards.v1";

export type CardKind = "once" | "shop" | "cash" | "agent" | "gift";

export const CARD_KINDS: { id: CardKind; label: string; line: string }[] = [
  { id: "once", label: "Once", line: "One payment. Then the card is dead." },
  { id: "shop", label: "Shop", line: "Pays one merchant until the cap is gone." },
  { id: "cash", label: "Cash", line: "Sends USDC to a Bitso address so they can take pesos out. Not an ATM." },
  { id: "agent", label: "Agent", line: "Funds an agent wallet, and stops at the cap." },
  { id: "gift", label: "Gift", line: "Pays a person until the cap is gone." },
];

export type SpendCard = {
  id: string;
  kind: CardKind;
  cap: number;
  spent: number;
  dest: string;
  live: boolean;
};

function load(): SpendCard[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is SpendCard => {
      if (!row || typeof row !== "object") return false;
      const card = row as SpendCard;
      return typeof card.dest === "string" && typeof card.cap === "number" && typeof card.kind === "string";
    });
  } catch {
    return [];
  }
}

function save(rows: SpendCard[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function listCards(): SpendCard[] {
  return load();
}

export function makeCard(kind: CardKind, cap: number, dest: string): SpendCard {
  if (!(cap >= 0.01)) throw new Error("Set a cap of at least a cent.");
  if (dest.trim().length < 32) throw new Error("Paste the address this card is allowed to pay.");
  const row: SpendCard = { id: `${kind}-${Date.now().toString(36)}`, kind, cap, spent: 0, dest: dest.trim(), live: true };
  save([row, ...load()].slice(0, 20));
  return row;
}

/** Sends USDC from the Phantom to the only address on the card. */
export async function useCard(id: string, owner: string, usd: number): Promise<string> {
  const rows = load();
  const card = rows.find((row) => row.id === id);
  if (!card || !card.live) throw new Error("That card is spent.");
  const left = Math.round((card.cap - card.spent) * 1_000_000) / 1_000_000;
  if (!(usd > 0) || usd - left > 0.000001) throw new Error(`This card has $${left.toFixed(2)} left.`);
  const paid = await payUsdc({ owner, to: card.dest, usd, memo: card.kind });
  card.spent = Math.round((card.spent + usd) * 1_000_000) / 1_000_000;
  if (card.kind === "once" || card.spent >= card.cap - 0.000001) card.live = false;
  save(rows);
  return paid.signature;
}
