/** Stables with a published Solana mint. EURC is euros. The rest are dollar stables. */

export type Stable = {
  symbol: string;
  mint: string;
  issuer: string;
  decimals: number;
  peg: "usd" | "eur";
};

export const STABLES: Stable[] = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", issuer: "Circle", decimals: 6, peg: "usd" },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", issuer: "Tether", decimals: 6, peg: "usd" },
  { symbol: "PYUSD", mint: "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo", issuer: "Paxos", decimals: 6, peg: "usd" },
  { symbol: "USDG", mint: "2u1tszSeqZ3qBWF3uNGPFc8TzMk2tdiwknnRMWGWjGWH", issuer: "Paxos", decimals: 6, peg: "usd" },
  { symbol: "USD1", mint: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB", issuer: "World Liberty Financial", decimals: 6, peg: "usd" },
  { symbol: "CASH", mint: "CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH", issuer: "Phantom Cash", decimals: 6, peg: "usd" },
  { symbol: "EURC", mint: "HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr", issuer: "Circle", decimals: 6, peg: "eur" },
];

export const USDC_MINT = STABLES[0].mint;

export function stablePayLink(owner: string, mint: string): string {
  const q = new URLSearchParams({ "spl-token": mint });
  return `solana:${owner}?${q.toString()}`;
}
