/** What each outside card will take from this desk. The asset is enforced. A Solana address is not proof it is theirs. */

import { PublicKey } from "@solana/web3.js";

export type CardAsset = { symbol: string; mint: string; decimals: number; native?: boolean; cap: number; savedCap: number };

const USDC: CardAsset = { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6, cap: 250, savedCap: 200_000 };
const USDT: CardAsset = { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", decimals: 6, cap: 250, savedCap: 5_000 };

export const CARD_BOOK: Record<string, { name: string; assets: CardAsset[]; address: boolean }> = {
  jupiter: { name: "Jupiter", address: true, assets: [USDC] },
  avici: { name: "Avici", address: true, assets: [{ ...USDC, savedCap: 5_000 }] },
  kast: { name: "KAST", address: true, assets: [{ ...USDC, savedCap: 5_000 }] },
  xplace: {
    name: "XPlace",
    address: true,
    assets: [
      USDT,
      { symbol: "SOL", mint: "", decimals: 9, native: true, cap: 1, savedCap: 5 },
      { symbol: "wETH", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, cap: 0.05, savedCap: 0.2 },
      { symbol: "cbBTC", mint: "cbbtcf3aa214zXHbiAZQwf4122FBYbraNdFqgw4iMij", decimals: 8, cap: 0.002, savedCap: 0.01 },
      { symbol: "jitoSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", decimals: 9, cap: 1, savedCap: 5 },
    ],
  },
  fuse: { name: "Fuse", address: true, assets: [{ ...USDC, savedCap: 2_000 }] },
  rain: { name: "Rain", address: true, assets: [{ ...USDC, savedCap: 5_000 }] },
  bridge: { name: "Bridge", address: true, assets: [USDC] },
};

export function bindCardSend(input: { program: string; symbol: string; dest: string; amount: number; tail: string; remembered: string }): { name: string; asset: CardAsset; dest: string; cap: number } {
  const book = CARD_BOOK[input.program];
  if (!book) throw new Error("That card is not on this desk.");
  const asset = book.assets.find((row) => row.symbol === input.symbol);
  if (!asset) throw new Error(`${book.name} does not take ${input.symbol} from this desk.`);
  if (input.program === "xplace" && asset.symbol === "USDC") throw new Error("XPlace does not take USDC from this desk.");
  let dest = "";
  try {
    dest = new PublicKey(input.dest.trim()).toBase58();
  } catch {
    throw new Error(`Paste the address ${book.name} is showing.`);
  }
  if (dest.slice(-4) !== input.tail.trim()) throw new Error("The last four characters do not match. The wallet was not asked.");
  const known = input.remembered.length > 0 && input.remembered === dest;
  const cap = known ? asset.savedCap : asset.cap;
  if (!(input.amount > 0) || input.amount > cap) {
    throw new Error(known ? `That is over ${cap} ${asset.symbol} for an address already used here.` : `A first send to a new address stops at ${cap} ${asset.symbol}.`);
  }
  return { name: book.name, asset, dest, cap };
}
