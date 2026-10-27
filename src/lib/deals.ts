/** A contract this desk can show. Paying one moves USDC. A mandate moves no money. Nothing here is a new chain program. */

const KEY = "senda.deals.v1";

export type DealChain = "Solana" | "Ethereum" | "Base" | "Arbitrum" | "Polygon" | "Optimism" | "Avalanche" | "BNB" | "Monad";

export const DEAL_CHAINS: DealChain[] = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism", "Avalanche", "BNB", "Monad"];

export type DealTemplate = {
  id: string;
  title: string;
  tag: "Pay" | "Work" | "Cover" | "Agent";
  line: string;
  pays: boolean;
};

export const DEAL_TEMPLATES: DealTemplate[] = [
  { id: "invoice", title: "Invoice", tag: "Pay", line: "Pay for work that is already done.", pays: true },
  { id: "rent", title: "Rent", tag: "Pay", line: "One period of rent, paid to the landlord.", pays: true },
  { id: "delivery", title: "Delivery", tag: "Pay", line: "Pay when a named thing is handed over.", pays: true },
  { id: "freelance", title: "Freelance", tag: "Work", line: "A fixed price for one deliverable.", pays: true },
  { id: "earnest", title: "Earnest money", tag: "Pay", line: "A deposit toward a purchase you named.", pays: true },
  { id: "loan", title: "Repayment", tag: "Pay", line: "Send principal back to the person who lent it.", pays: true },
  { id: "split", title: "Revenue split", tag: "Pay", line: "One share of money already earned. Not an ongoing cut.", pays: true },
  { id: "cover", title: "Cover note", tag: "Cover", line: "A premium for a written risk. Not an insurance policy.", pays: true },
  { id: "service", title: "Service", tag: "Work", line: "Pay a person to do a job you described.", pays: true },
  { id: "mandate", title: "Agent mandate", tag: "Agent", line: "A budget an agent may not pass. Signing moves no USDC.", pays: false },
];

export type Deal = {
  id: string;
  template: string;
  title: string;
  tag: DealTemplate["tag"];
  chain: DealChain;
  amount: number;
  counterparty: string;
  note: string;
  terms: string;
  due: string;
  pays: boolean;
  status: "signed" | "void";
  sig: string;
  at: number;
};

function read(): Deal[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Deal[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(rows: Deal[]) {
  window.localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 80)));
}

export function listDeals(): Deal[] {
  return read();
}

export function voidDeal(id: string) {
  write(read().map((row) => (row.id === id && row.status === "signed" ? { ...row, status: "void" } : row)));
}

export function termsFor(template: DealTemplate, input: { chain: DealChain; amount: number; counterparty: string; note: string; due: string }): string {
  const who = input.counterparty.trim();
  const money = `$${input.amount.toFixed(2)} USDC`;
  const due = input.due || "on signing";
  const note = input.note.trim() || template.line;
  if (template.id === "mandate") {
    return `An agent may propose sends and trades up to ${money} on this desk until ${due}. ${note} Every send still asks the wallet. This mandate does not move USDC.`;
  }
  if (template.id === "cover") {
    return `You pay ${who} a premium of ${money} on ${input.chain}, due ${due}. The written risk: ${note}. This is a payment plus a sentence. It is not a regulated policy and it does not pay you back by itself.`;
  }
  if (template.id === "rent") {
    return `Rent of ${money} on ${input.chain} to ${who}, due ${due}. The period: ${note}. One payment. The wallet signs it.`;
  }
  if (template.id === "loan") {
    return `Repayment of ${money} on ${input.chain} to ${who}, due ${due}. What is being repaid: ${note}. This sends the principal. It does not accrue interest on a chain.`;
  }
  if (template.id === "earnest") {
    return `A deposit of ${money} on ${input.chain} to ${who}, due ${due}, toward: ${note}. The deposit moves when you sign. A refund is a later payment the other way.`;
  }
  return `${template.title}: ${money} on ${input.chain} to ${who}, due ${due}. ${note} One payment. The wallet signs it.`;
}

export function saveDeal(row: Omit<Deal, "id" | "at" | "status" | "sig"> & { sig: string }): Deal {
  const deal: Deal = { ...row, id: crypto.randomUUID(), status: "signed", at: Date.now() };
  write([deal, ...read()]);
  return deal;
}
