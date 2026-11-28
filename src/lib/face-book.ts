/** Logos for the names this desk already lists. Jupiter when it answers, the house marks when it does not. */

import { createServerFn } from "@tanstack/react-start";
import { UNIVERSE } from "@/lib/universe";
import { facesOf } from "@/lib/venue-book";

export type FaceRow = { mint: string; symbol: string; name: string; icon: string };

const BRAND: Record<string, string> = {
  OPENAI: "/logos/openai.png",
  ANTHROPIC: "/logos/anthropic.png",
  SPACEX: "/logos/spacex.png",
  SPCX: "/logos/spacex.png",
  SPCXX: "/logos/spacex.png",
  ANDURIL: "/logos/anduril.png",
  NEURALINK: "/logos/neuralink.png",
  FIGUREAI: "/logos/figureai.png",
  KALSHI: "/logos/kalshi.png",
  XAI: "/logos/xai.png",
  POLYMARKET: "/logos/polymarket.png",
};

/** Mints whose logos live on the public Solana token list. Used when a row has a symbol and no mint. */
const LISTED: Record<string, string> = {
  SOL: "So11111111111111111111111111111111111111112",
  BTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  WBTC: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  ETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  WETH: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  JTO: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL",
  RENDER: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
  MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  JITOSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
};

export function brandIcon(symbol: string): string {
  const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return BRAND[key] || "";
}

export function listedMint(symbol: string): string {
  const key = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return LISTED[key] || "";
}

/** xStock tickers (AAPLx, SPYx) use the underlying company mark. Crypto symbols are not sent here. */
export function equityIcon(symbol: string): string {
  const hit = symbol.trim().match(/^([A-Za-z]{1,5})x$/);
  if (!hit) return "";
  const stem = hit[1].toUpperCase();
  if (stem === "SPCX") return "/logos/spacex.png";
  return `https://assets.parqet.com/logos/symbol/${stem}`;
}

export function tokenListIcon(mint: string): string {
  if (!mint || mint.length < 32) return "";
  return `https://cdn.jsdelivr.net/gh/solana-labs/token-list@main/assets/mainnet/${mint}/logo.png`;
}

export function trustIcon(mint: string): string {
  if (!mint || mint.length < 32) return "";
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/${mint}/logo.png`;
}

export const loadFaceBook = createServerFn({ method: "GET" }).handler(async (): Promise<FaceRow[]> => {
  const names = UNIVERSE;
  const faces = await facesOf(names.map((row) => row.mint)).catch(() => new Map());
  return names.map((row) => {
    const face = faces.get(row.mint);
    const brand = brandIcon(row.symbol);
    return {
      mint: row.mint,
      symbol: face?.symbol || row.symbol,
      name: face?.name || row.symbol,
      icon: brand || face?.icon || equityIcon(row.symbol) || tokenListIcon(row.mint) || "",
    };
  });
});
