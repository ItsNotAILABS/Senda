/** What each outside card will take. The asset is enforced. The amount is the amount. */

import { PublicKey } from "@solana/web3.js";

export type CardAsset = { symbol: string; mint: string; decimals: number; native?: boolean; cap: number };

const USDC: CardAsset = { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, cap: 200_000 };
const USDT: CardAsset = { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, cap: 200_000 };

export const CARD_BOOK: Record<string, { name: string; assets: CardAsset[]; address: boolean }> = {
  jupiter: { name: "Jupiter", address: true, assets: [USDC] },
  avici: { name: "Avici", address: true, assets: [USDC] },
  kast: { name: "KAST", address: true, assets: [USDC] },
  xplace: {
    name: "XPlace",
    address: true,
    assets: [
      USDT,
      { symbol: "SOL", mint: "", decimals: 9, native: true, cap: 500 },
      { symbol: "wETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, cap: 20 },
      { symbol: "cbBTC", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8, cap: 1 },
      { symbol: "jitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9, cap: 500 },
    ],
  },
  fuse: { name: "Fuse", address: true, assets: [USDC] },
  rain: { name: "Rain", address: true, assets: [USDC] },
  bridge: { name: "Bridge", address: true, assets: [USDC] },
};

export function bindCardSend(input: { program: string; symbol: string; dest: string; amount: number }): { name: string; asset: CardAsset; dest: string } {
  const book = CARD_BOOK[input.program];
  if (!book) throw new Error("That card is not on this desk.");
  const asset = book.assets.find((row) => row.symbol === input.symbol);
  if (!asset) throw new Error(`${book.name} does not take ${input.symbol} from this desk.`);
  if (input.program === "xplace" && input.symbol === "USDC") throw new Error("XPlace does not take USDC from this desk.");
  let dest = "";
  try {
    dest = new PublicKey(input.dest.trim()).toBase58();
  } catch {
    throw new Error(`Paste the address ${book.name} is showing.`);
  }
  if (!(input.amount > 0) || input.amount > asset.cap) throw new Error(`Send up to ${asset.cap} ${asset.symbol}.`);
  return { name: book.name, asset, dest };
}
