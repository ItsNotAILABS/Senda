/** Listings people post. Payment is a USDC transfer to the address on the listing. */

const KEY = "senda.make.v1";

export const KINDS = [
  { id: "payroll", label: "Payroll", line: "USDC to a person. One signature." },
  { id: "lend", label: "Lend", line: "USDC leaves now. It comes back only if they sign a repayment. Nothing here takes collateral." },
  { id: "repay", label: "Repay", line: "USDC back to the address that lent it." },
  { id: "invoice", label: "Invoice", line: "A bill. The whole amount goes to that address." },
  { id: "settle", label: "Settle", line: "Close what you owe, or buy it back, in USDC." },
] as const;

const OLD: Record<string, string> = {
  job: "Payroll",
  hours: "Payroll",
  care: "Payroll",
  video: "Payroll",
  teaching: "Payroll",
  service: "Invoice",
  repair: "Invoice",
  haul: "Invoice",
  finance: "Lend",
  software: "Invoice",
  hardware: "Settle",
  robotics: "Settle",
  goods: "Settle",
  repurchase: "Settle",
};

export type MakeKind = (typeof KINDS)[number]["id"];

export function kindLabel(id: string): string {
  return KINDS.find((k) => k.id === id)?.label || OLD[id] || id;
}

export type Listing = {
  id: string;
  kind: MakeKind;
  title: string;
  detail: string;
  usd: number;
  payTo: string;
  revtag?: string;
  at: number;
};

export function listListings(): Listing[] {
  if (typeof window === "undefined") return [];
  try {
    const rows = JSON.parse(window.localStorage.getItem(KEY) || "[]") as Listing[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function saveListing(row: Omit<Listing, "id" | "at">): Listing {
  const next: Listing = { ...row, id: crypto.randomUUID(), at: Date.now() };
  const all = [next, ...listListings()];
  window.localStorage.setItem(KEY, JSON.stringify(all));
  return next;
}
