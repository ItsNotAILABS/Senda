import assert from "node:assert/strict";
import test from "node:test";
import { parseKalshiBook, parsePolyBook } from "./book-depth.ts";

test("a Polymarket book keeps the best bid and the best ask", () => {
  const book = parsePolyBook({
    bids: [
      { price: "0.10", size: "5" },
      { price: "0.42", size: "10" },
    ],
    asks: [
      { price: "0.55", size: "3" },
      { price: "0.48", size: "8" },
    ],
  });
  assert.equal(book.bids[0].price, 0.42);
  assert.equal(book.asks[0].price, 0.48);
  assert.equal(book.bids[0].size, 10);
});

test("a price at a dollar is not a level", () => {
  const book = parsePolyBook({
    bids: [{ price: "1", size: "9" }],
    asks: [{ price: "0", size: "9" }],
  });
  assert.equal(book.bids.length, 0);
  assert.equal(book.asks.length, 0);
});

test("Kalshi yes bids and no bids become a two-sided book", () => {
  const book = parseKalshiBook({
    orderbook_fp: {
      yes_dollars: [
        ["0.40", "10"],
        ["0.41", "4"],
      ],
      no_dollars: [["0.57", "6"]],
    },
  });
  assert.equal(book.bids[0].price, 0.41);
  assert.equal(book.asks[0].price, 0.43);
  assert.equal(book.asks[0].size, 6);
});

test("a legacy cent book is read the same way", () => {
  const book = parseKalshiBook({ orderbook: { yes: [[40, 10]], no: [[55, 2]] } });
  assert.equal(book.bids[0].price, 0.4);
  assert.equal(book.asks[0].price, 0.45);
});
