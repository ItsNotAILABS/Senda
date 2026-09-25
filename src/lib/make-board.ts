/** Listings people post. Payment is a USDC transfer to the address on the listing. */

const KEY = "senda.make.v1";

export const KINDS = [
  { id: "job", label: "Job", line: "Hire a person to do the work." },
  { id: "software", label: "Software", line: "A tool someone will build or already has." },
  { id: "service", label: "Service", line: "Work, not a thing on a shelf." },
  { id: "hardware", label: "Hardware", line: "A physical product." },
  { id: "robotics", label: "Robotics", line: "A machine, a part, or the labor to build one." },
  { id: "teaching", label: "For a teacher", line: "What a class needs. Anyone can fund it." },
] as const;

export type MakeKind = (typeof KINDS)[number]["id"];

export type Listing = {
  id: string;
  kind: MakeKind;
  title: string;
  detail: string;
  usd: number;
  payTo: string;
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
