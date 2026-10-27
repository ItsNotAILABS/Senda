/**
 * Twenty-one native assets. A chain row is a network this desk already asks a wallet to sign.
 * A wrapped row is a Solana token. A price row is a mark. It is not a chain we trade.
 */

import { createServerFn } from "@tanstack/react-start";

export type MarkKind = "chain" | "wrapped" | "price";

export type NativeMark = {
  symbol: string;
  name: string;
  kind: MarkKind;
  /** Solana mint when the thing you can hold is a wrapped token. Empty when there is nothing to sign. */
  mint: string;
  decimals: number;
  line: string;
  price: number | null;
  change: number | null;
};

const MARKS: Omit<NativeMark, "price" | "change">[] = [
  { symbol: "BTC", name: "Bitcoin", kind: "wrapped", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", decimals: 8, line: "Portal bitcoin on Solana. This desk does not sign the Bitcoin chain." },
  { symbol: "ETH", name: "Ether", kind: "chain", mint: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", decimals: 8, line: "Ethereum is one of the networks a wallet already signs. The Solana token is Portal, not a second chain." },
  { symbol: "SOL", name: "Solana", kind: "chain", mint: "So11111111111111111111111111111111111111112", decimals: 9, line: "Solana is a network this desk signs. The buy is SOL itself." },
  { symbol: "BNB", name: "BNB", kind: "chain", mint: "9gP2kCy3wA1ctvYWQk75guqXuHfrEomqydHLtcTCqiLa", decimals: 8, line: "BNB Chain is a network this desk signs. The Solana token is a wrap, not that chain." },
  { symbol: "XRP", name: "XRP", kind: "wrapped", mint: "6UpQcMAb5xMzxc7ZfPaVMgx3KqsvKZdT5U718BzD5We2", decimals: 6, line: "Hex Trust’s token on Solana. The XRP Ledger is not a chain this desk signs." },
  { symbol: "ADA", name: "Cardano", kind: "price", mint: "", decimals: 6, line: "A price. There is no Cardano transaction here." },
  { symbol: "SUI", name: "Sui", kind: "wrapped", mint: "suifhC9gU1VbJAPYPTBkHJyyyStKGLLYPVDTmPoqbvA", decimals: 8, line: "A Sui token on Solana. The Sui network is not signed here." },
  { symbol: "APT", name: "Aptos", kind: "price", mint: "", decimals: 8, line: "A price. There is no Aptos transaction here." },
  { symbol: "TON", name: "TON", kind: "price", mint: "", decimals: 9, line: "A price. There is no TON transaction here." },
  { symbol: "NEAR", name: "NEAR", kind: "wrapped", mint: "3ZLekZYq2qkZiSpnSvabjit34tUkjSwD1JFuW9as9wBG", decimals: 9, line: "Wrapped NEAR on Solana. The NEAR network is not signed here." },
  { symbol: "DOGE", name: "Dogecoin", kind: "wrapped", mint: "DoGEV7LASBkQbibMc5k5vKnTZoMg423GpJ5QtJEGfm7R", decimals: 8, line: "A Dogecoin token on Solana. Not a transfer on Dogecoin." },
  { symbol: "AVAX", name: "Avalanche", kind: "chain", mint: "KgV1GvrHQmRBY8sHQQeUKwTm2r2h8t4C8qt12Cw1HVE", decimals: 8, line: "Avalanche is a network this desk signs. The Solana token is a wrap of the coin." },
  { symbol: "DOT", name: "Polkadot", kind: "price", mint: "", decimals: 10, line: "A price. There is no Polkadot transaction here." },
  { symbol: "ATOM", name: "Cosmos", kind: "price", mint: "", decimals: 6, line: "A price. There is no Cosmos transaction here." },
  { symbol: "ICP", name: "Internet Computer", kind: "price", mint: "", decimals: 8, line: "A price. No verified ICP mint is offered, and ICP is not a chain this desk signs." },
  { symbol: "LTC", name: "Litecoin", kind: "price", mint: "", decimals: 8, line: "A price. There is no Litecoin transaction here." },
  { symbol: "TRX", name: "Tron", kind: "price", mint: "", decimals: 6, line: "A price. There is no Tron transaction here." },
  { symbol: "HBAR", name: "Hedera", kind: "price", mint: "", decimals: 8, line: "A price. There is no Hedera transaction here." },
  { symbol: "LINK", name: "Chainlink", kind: "wrapped", mint: "2wpTofQ8SkACrkZWrZDjXPitYa8AwWgX8AfxdeBRRVLX", decimals: 8, line: "Portal Chainlink on Solana, from Wormhole’s list. The Ethereum contract is the other listing. Neither one is a new chain." },
  { symbol: "UNI", name: "Uniswap", kind: "wrapped", mint: "8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36", decimals: 8, line: "Portal Uniswap on Solana, from Wormhole’s list. The Ethereum contract is the other listing." },
  { symbol: "POL", name: "Polygon", kind: "chain", mint: "", decimals: 18, line: "Polygon is a network this desk signs. This row is not a separate token." },
];

const BINANCE = MARKS.map((row) => `${row.symbol}USDT`);

export const loadNativeMarks = createServerFn({ method: "GET" }).handler(async (): Promise<NativeMark[]> => {
  let px = new Map<string, { price: number; change: number }>();
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(BINANCE))}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const rows = (await res.json()) as Array<{ symbol?: string; lastPrice?: string; priceChangePercent?: string }>;
      px = new Map(
        rows.map((row) => [
          (row.symbol || "").replace(/USDT$/, ""),
          { price: Number(row.lastPrice) || 0, change: Number(row.priceChangePercent) || 0 },
        ]),
      );
    }
  } catch {
    px = new Map();
  }
  return MARKS.map((row) => {
    const live = px.get(row.symbol);
    return { ...row, price: live && live.price > 0 ? live.price : null, change: live ? live.change : null };
  });
});
