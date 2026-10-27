/** A label and a fixed USDC premium. The USDC sits in the cover account. Not a death benefit. */

export type CoverPlan = {
  id: string;
  title: string;
  blurb: string;
  premium: number;
  cover: number;
  term: string;
  payout: string;
};

export const COVERS: CoverPlan[] = [
  {
    id: "phone",
    title: "Phone",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 9,
    cover: 1200,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "travel",
    title: "Travel",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 18,
    cover: 10000,
    term: "Trip · 14 days",
    payout: "USDC",
  },
  {
    id: "renters",
    title: "Renters",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 14,
    cover: 15000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "accident",
    title: "Accident",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 22,
    cover: 25000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "pet",
    title: "Pet",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 12,
    cover: 5000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "auto",
    title: "Auto glass",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 11,
    cover: 800,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "load",
    title: "Load",
    blurb: "Fixed USDC premium for this label. Settle sends back what the cover account holds.",
    premium: 45,
    cover: 50000,
    term: "One haul",
    payout: "USDC",
  },
  {
    id: "life",
    title: "Life",
    blurb: "A label for a fixed USDC premium. Not a death benefit.",
    premium: 28,
    cover: 100000,
    term: "30 days",
    payout: "USDC",
  },
];

export function formatCover(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}
