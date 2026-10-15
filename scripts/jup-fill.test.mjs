import assert from "node:assert/strict";
import test from "node:test";
import { FILL_PROBE_USD, fillsAtProductionSlippage, impactBps, keepListed, weightBook } from "../src/lib/jup-fill.mjs";
import { giftHash, giftOpen, readGiftHash } from "../src/lib/gift-link.mjs";

test("the listing probe is a $100 retail buy", () => {
  assert.equal(FILL_PROBE_USD, 100);
});

test("a jupiter quote inside 100 bps is fillable and a wide impact is not", () => {
  assert.equal(impactBps("0.005"), 50);
  assert.equal(
    fillsAtProductionSlippage({ outAmount: "1000", priceImpactPct: "0.005", slippageBps: 100, inUsd: 10, swapUsdValue: "9.8" }),
    true,
  );
  assert.equal(fillsAtProductionSlippage({ outAmount: "1000", priceImpactPct: "0.02", slippageBps: 100, inUsd: 10, swapUsdValue: "9.8" }), false);
  assert.equal(fillsAtProductionSlippage({ outAmount: "0", priceImpactPct: "0", slippageBps: 100 }), false);
  assert.equal(fillsAtProductionSlippage({ error: "No route." }), false);
});

test("a solana mint that cannot fill is left off and a price with no mint stays", () => {
  const rows = [
    { symbol: "BONK", mint: "bonk", lane: "solana" },
    { symbol: "USDC", mint: "usdc", lane: "solana" },
    { symbol: "ADA", mint: null, lane: "chain" },
  ];
  const kept = keepListed(rows, ["bonk"]);
  assert.deepEqual(kept.map((row) => row.symbol), ["BONK", "USDC", "ADA"]);
  assert.deepEqual(keepListed(rows, []).map((row) => row.symbol), ["USDC", "ADA"]);
});

test("filled weight drops a leg jupiter cannot fill and the level uses the executable price", () => {
  const book = weightBook(
    [
      { symbol: "A", mint: "mintA", mark: 2, target: 1, decimals: 6 },
      { symbol: "B", mint: "mintB", mark: 2, target: 1, decimals: 6 },
    ],
    {
      mintA: { inAmount: "10000000", outAmount: "5000000", priceImpactPct: "0.001", slippageBps: 100, inUsd: 10, swapUsdValue: "10" },
      mintB: { outAmount: "0", priceImpactPct: "0", slippageBps: 100 },
    },
  );
  const a = book.legs.find((leg) => leg.symbol === "A");
  const b = book.legs.find((leg) => leg.symbol === "B");
  assert.equal(a.filled, true);
  assert.equal(a.targetWeight, 0.5);
  assert.equal(a.filledWeight, 1);
  assert.equal(a.exec, 2);
  assert.equal(b.filled, false);
  assert.equal(b.filledWeight, 0);
  assert.equal(book.level, 1000);
});

test("a gift link keeps the secret in the hash and closes when the window ends", () => {
  const hash = giftHash({ secret: "abc", expiresAt: 50, usd: 12 });
  assert.equal(hash.includes("?"), false);
  assert.deepEqual(readGiftHash(`#${hash}`), { secret: "abc", expiresAt: 50, usd: 12 });
  assert.equal(giftOpen(49, 50), true);
  assert.equal(giftOpen(50, 50), false);
});
