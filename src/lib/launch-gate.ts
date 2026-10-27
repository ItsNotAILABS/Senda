/** Rug gates for a new Solana mint. A failure refuses the buy before the wallet opens. */

import { cosine } from "./matdaemon.ts";

export const LAUNCH_FEE_BPS = 10;
export const SERIAL_DEV = 8;

export type Launch = {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  launchpad: string;
  holders: number;
  createdAt: string;
  organic: number;
  liquidity: number;
  price: number;
  mintOff: boolean;
  freezeOff: boolean;
  devMints: number | null;
};

/** What a clean snipe looks like: authorities off, not a crowd, a little depth, still fresh. */
const TARGET = [1, 1, 0.3, 0.2, 0.25, 1];

export function refuseLaunch(row: Launch): string | null {
  if (!row.mintOff) return "Mint authority is still on. Refused.";
  if (!row.freezeOff) return "Freeze authority is still on. Refused.";
  if (row.devMints != null && row.devMints >= SERIAL_DEV) return `That deployer has ${row.devMints} mints. Refused.`;
  return null;
}

export function launchVector(row: Launch): number[] {
  const ageMin = Math.max(0, (Date.now() - Date.parse(row.createdAt)) / 60_000);
  const fresh = ageMin <= 5 ? 1 : ageMin <= 30 ? 0.5 : 0.2;
  return [
    row.mintOff ? 1 : 0,
    row.freezeOff ? 1 : 0,
    Math.min(row.holders / 50, 1),
    Math.min(row.organic / 100, 1),
    Math.min(row.liquidity / 10_000, 1),
    fresh,
  ];
}

export function launchScore(row: Launch): { score: number; ms: number; refused: string | null } {
  const refused = refuseLaunch(row);
  const started = Date.now();
  const score = refused ? 0 : Math.round(cosine(launchVector(row), TARGET) * 100);
  return { score, ms: Math.max(0, Date.now() - started), refused };
}

export function feeOn(usd: number): { bps: number; usd: number; collected: false } {
  return { bps: LAUNCH_FEE_BPS, usd: Math.round(usd * LAUNCH_FEE_BPS) / 10_000, collected: false };
}
