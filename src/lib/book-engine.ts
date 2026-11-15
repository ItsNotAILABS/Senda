/** One read of a filled book. Home, trade, markets, and agents all call this. No second copy of the math. */

export type BookSide = { usd: number };
export type BookPrint = { side: "buy" | "sell" };

export type BookCall = {
  imbalance: number | null;
  spreadBps: number | null;
  lean: "bid" | "ask" | "flat" | "empty";
  block: string | null;
  note: string;
};

export function judgeBook(book: {
  bids: BookSide[];
  asks: BookSide[];
  lastPrice: number;
  spread: number;
  prints: BookPrint[];
}): BookCall {
  const bidUsd = book.bids.reduce((sum, row) => sum + (row.usd > 0 ? row.usd : 0), 0);
  const askUsd = book.asks.reduce((sum, row) => sum + (row.usd > 0 ? row.usd : 0), 0);
  const total = bidUsd + askUsd;
  if (!(total > 0) || !(book.lastPrice > 0)) {
    return {
      imbalance: null,
      spreadBps: null,
      lean: "empty",
      block: null,
      note: "No filled book yet. Nothing is invented.",
    };
  }
  const imbalance = (bidUsd - askUsd) / total;
  const spreadBps = book.spread > 0 ? (book.spread / book.lastPrice) * 10_000 : 0;
  const lean = imbalance >= 0.2 ? "bid" : imbalance <= -0.2 ? "ask" : "flat";
  const block =
    spreadBps > 200
      ? `Spread is ${spreadBps.toFixed(0)} bps. Too wide to pay.`
      : lean === "ask"
        ? "Filled size is on the ask. A buy does not clear."
        : null;
  return {
    imbalance,
    spreadBps,
    lean,
    block,
    note: `${lean} · ${Math.round(imbalance * 100)}% bid · ${spreadBps.toFixed(0)} bps`,
  };
}
