/** Parametric life cover. Premium in USD, payout in USDC on Solana. Paper book. */

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
    blurb: "Crack, theft, liquid. Payout to USDC in the wallet.",
    premium: 9,
    cover: 1200,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "travel",
    title: "Travel",
    blurb: "Delay, bag, medical abroad. No weekend FX on the payout.",
    premium: 18,
    cover: 10000,
    term: "Trip · 14 days",
    payout: "USDC",
  },
  {
    id: "renters",
    title: "Renters",
    blurb: "Theft and water in a Texas rental. Not a licensed carrier.",
    premium: 14,
    cover: 15000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "accident",
    title: "Accident",
    blurb: "ER and follow-up cash. Parametric — you file, it pays.",
    premium: 22,
    cover: 25000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "pet",
    title: "Pet",
    blurb: "Vet emergency. Same cash account as send.",
    premium: 12,
    cover: 5000,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "auto",
    title: "Auto glass",
    blurb: "Windshield and roadside. Fleet-friendly.",
    premium: 11,
    cover: 800,
    term: "30 days",
    payout: "USDC",
  },
  {
    id: "load",
    title: "Load",
    blurb: "Cargo on a DFW run. Pays if the load is a total loss.",
    premium: 45,
    cover: 50000,
    term: "One haul",
    payout: "USDC",
  },
  {
    id: "life",
    title: "Life",
    blurb: "Term cash for family. Paper policy, USDC beneficiary.",
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
