/** A contract this desk can show. Paying one moves USDC. A mandate moves no money. Nothing here is a new chain program. */

const KEY = "senda.deals.v1";

export type DealChain = "Solana" | "Ethereum" | "Base" | "Arbitrum" | "Polygon" | "Optimism" | "Avalanche" | "BNB" | "Monad";

export const DEAL_CHAINS: DealChain[] = ["Solana", "Ethereum", "Base", "Arbitrum", "Polygon", "Optimism", "Avalanche", "BNB", "Monad"];

export type DealFamily = "Sell" | "Hire" | "Place" | "Capital" | "Cover" | "Desk";

export const DEAL_FAMILIES: DealFamily[] = ["Sell", "Hire", "Place", "Capital", "Cover", "Desk"];

export type DealTemplate = {
  id: string;
  title: string;
  tag: "Pay" | "Work" | "Cover" | "Agent";
  family: DealFamily;
  line: string;
  pays: boolean;
  /** Sets the desk spend cap. Never moves USDC. */
  cap: boolean;
  who: string;
  about: string;
};

export const DEAL_TEMPLATES: DealTemplate[] = [
  { id: "invoice", family: "Sell", title: "Invoice", tag: "Pay", line: "Pay for work that is already done.", pays: true, cap: false, who: "Solana address that gets paid", about: "What was delivered" },
  { id: "milestone", family: "Sell", title: "Milestone", tag: "Pay", line: "One named piece of a larger job. Not the rest of it.", pays: true, cap: false, who: "Solana address that gets paid", about: "Which milestone, and what done means" },
  { id: "retainer", family: "Sell", title: "Retainer", tag: "Pay", line: "One period, paid now. It does not renew itself.", pays: true, cap: false, who: "Solana address that gets paid", about: "The period and what is included" },
  { id: "change", family: "Sell", title: "Change order", tag: "Pay", line: "Extra pay for a change you wrote down.", pays: true, cap: false, who: "Solana address that gets paid", about: "What changed from the original job" },
  { id: "period", family: "Sell", title: "One period", tag: "Pay", line: "A subscription period paid once. Next period is another signature.", pays: true, cap: false, who: "Solana address that gets paid", about: "Which period, which service" },
  { id: "delivery", family: "Sell", title: "Delivery", tag: "Pay", line: "Pay when a named thing is handed over.", pays: true, cap: false, who: "Solana address that gets paid", about: "What is handed over" },
  { id: "earnest", family: "Sell", title: "Earnest money", tag: "Pay", line: "A deposit toward a purchase you named.", pays: true, cap: false, who: "Solana address that gets paid", about: "The purchase this deposit is toward" },
  { id: "freelance", family: "Hire", title: "Freelance", tag: "Work", line: "A fixed price for one deliverable.", pays: true, cap: false, who: "Solana address that gets paid", about: "The deliverable" },
  { id: "service", family: "Hire", title: "Service", tag: "Work", line: "Pay a person to do a job you described.", pays: true, cap: false, who: "Solana address that gets paid", about: "The job" },
  { id: "sow", family: "Hire", title: "Statement of work", tag: "Work", line: "The deliverable, the price, and what is out of scope.", pays: true, cap: false, who: "Solana address that gets paid", about: "In scope, and what is out" },
  { id: "referral", family: "Hire", title: "Referral", tag: "Work", line: "One fee for an introduction you named. Not a trailing cut.", pays: true, cap: false, who: "Solana address that gets paid", about: "Who was introduced, and to what" },
  { id: "kill", family: "Hire", title: "Kill fee", tag: "Work", line: "Pay to stop a job. The work does not continue on this signature.", pays: true, cap: false, who: "Solana address that gets paid", about: "The job being stopped" },
  { id: "rent", family: "Place", title: "Rent", tag: "Pay", line: "One period of rent, paid to the landlord.", pays: true, cap: false, who: "Solana address that gets paid", about: "Which month, which place" },
  { id: "deposit", family: "Place", title: "Security deposit", tag: "Pay", line: "One deposit. A refund is a later payment the other way.", pays: true, cap: false, who: "Solana address that holds it", about: "The place, and what the deposit covers" },
  { id: "prepay", family: "Place", title: "Vendor prepay", tag: "Pay", line: "Pay a vendor before the goods show up.", pays: true, cap: false, who: "Solana address that gets paid", about: "What you are prepaying" },
  { id: "loan", family: "Capital", title: "Repayment", tag: "Pay", line: "Send principal back to the person who lent it.", pays: true, cap: false, who: "Solana address that gets paid", about: "What is being repaid" },
  { id: "split", family: "Capital", title: "Revenue split", tag: "Pay", line: "One share of money already earned. Not an ongoing cut.", pays: true, cap: false, who: "Solana address that gets paid", about: "The revenue this share comes from" },
  { id: "partner", family: "Capital", title: "Partner draw", tag: "Pay", line: "One draw. It is not equity and it is not a token.", pays: true, cap: false, who: "Solana address that gets paid", about: "The venture, and what this draw is" },
  { id: "cover", family: "Cover", title: "Cover note", tag: "Cover", line: "A premium for a written risk. Not an insurance policy.", pays: true, cap: false, who: "Solana address that gets paid", about: "The written risk" },
  { id: "mandate", family: "Desk", title: "Spend mandate", tag: "Agent", line: "A budget an agent may not pass. Signing moves no USDC.", pays: false, cap: true, who: "Agent name, if you have one", about: "What the agent may do" },
  { id: "trade", family: "Desk", title: "Trade mandate", tag: "Agent", line: "A cap on trades only. Sends are not included.", pays: false, cap: true, who: "Agent name, if you have one", about: "Which names it may propose" },
  { id: "scope", family: "Desk", title: "Scope note", tag: "Work", line: "What a job includes. No USDC moves.", pays: false, cap: false, who: "The other party’s name", about: "In scope" },
  { id: "accept", family: "Desk", title: "Acceptance", tag: "Work", line: "You record that a delivery matches the note. No USDC moves.", pays: false, cap: false, who: "Who delivered it", about: "What you are accepting" },
  { id: "quiet", family: "Desk", title: "Quiet note", tag: "Work", line: "A confidentiality note on this phone. Not a filing and not a court order.", pays: false, cap: false, who: "Who the note is with", about: "What stays quiet, and until when" },
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
  const who = input.counterparty.trim() || "the party you name";
  const money = `$${input.amount.toFixed(2)} USDC`;
  const due = input.due || "on signing";
  const note = input.note.trim() || template.line;
  const limit = "This is one signature on this desk. It does not deploy a program, it does not file anything, and voiding the record later does not pull a payment back.";
  const pay = `You pay ${who} ${money} on ${input.chain}, due ${due}.`;
  if (template.id === "mandate") return `An agent may propose sends and trades up to ${money} on this desk until ${due}. ${note} Every send still asks the wallet. This mandate does not move USDC. ${limit}`;
  if (template.id === "trade") return `An agent may propose trades up to ${money} until ${due}. Names: ${note}. It may not propose a send. Every trade still asks the wallet. This does not move USDC. ${limit}`;
  if (template.id === "scope") return `Scope with ${who}, through ${due}. ${note} The figure ${money} is the price written here. No USDC moves on this signature. ${limit}`;
  if (template.id === "accept") return `You accept delivery from ${who} as of ${due}. What you accept: ${note}. The figure ${money} is the value you wrote. No USDC moves. ${limit}`;
  if (template.id === "quiet") return `A quiet note with ${who} until ${due}. What stays quiet: ${note}. The figure ${money} is not a payment. This is not a court order and it is not filed anywhere. ${limit}`;
  if (template.id === "cover") return `${pay} The written risk: ${note}. This is a payment plus a sentence. It is not a regulated policy and it does not pay you back by itself. ${limit}`;
  if (template.id === "rent") return `${pay} The period and place: ${note}. One period. It does not renew. ${limit}`;
  if (template.id === "deposit") return `${pay} Held as a deposit for: ${note}. A refund is a new payment the other way. This signature cannot claw it back. ${limit}`;
  if (template.id === "loan") return `${pay} What is being repaid: ${note}. This sends that amount. It does not accrue interest on a chain. ${limit}`;
  if (template.id === "split") return `${pay} The share: ${note}. One payment of money already earned. It does not take a cut of later revenue. ${limit}`;
  if (template.id === "partner") return `${pay} The draw: ${note}. This is not equity, not a share certificate, and not a token. ${limit}`;
  if (template.id === "retainer" || template.id === "period") return `${pay} The period: ${note}. The next period needs another signature. ${limit}`;
  if (template.id === "milestone" || template.id === "sow") return `${pay} The work: ${note}. This pays this piece only. Later pieces are later signatures. ${limit}`;
  if (template.id === "kill") return `${pay} The job stops here: ${note}. This does not require the other side to keep working. ${limit}`;
  if (template.id === "referral") return `${pay} The introduction: ${note}. One fee. No trailing share. ${limit}`;
  if (template.id === "earnest") return `${pay} Toward: ${note}. The deposit moves when you sign. A refund is a later payment the other way. ${limit}`;
  return `${template.title}. ${pay} ${note} ${limit}`;
}

export function saveDeal(row: Omit<Deal, "id" | "at" | "status" | "sig"> & { sig: string }): Deal {
  const deal: Deal = { ...row, id: crypto.randomUUID(), status: "signed", at: Date.now() };
  write([deal, ...read()]);
  return deal;
}
