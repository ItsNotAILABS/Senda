import assert from "node:assert/strict";
import test from "node:test";
import { describeCurve, quoteFromJupiter } from "./liquify-math.mjs";

test("a Jupiter plan is a quote even without a router field", () => {
  const quote = quoteFromJupiter({
    inAmount: "5000000",
    outAmount: "73000000",
    priceImpactPct: "0.001",
    routePlan: [{ swapInfo: { label: "Whirlpool" } }, { swapInfo: { label: "Meteora" } }],
  }, "5000000");
  assert.ok(quote);
  assert.equal(quote?.router, "Whirlpool → Meteora");
  assert.equal(quote?.impactPct, 0.1);
  assert.equal(quote?.outAmount, "73000000");
});

test("a quote for a different mint is refused", () => {
  assert.equal(
    quoteFromJupiter(
      { inAmount: "5000000", outAmount: "7", outputMint: "wrong", inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
      "5000000",
      { outputMint: "So11111111111111111111111111111111111111112", inputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
    ),
    null,
  );
});

test("a quote for a different size is refused", () => {
  assert.equal(quoteFromJupiter({ inAmount: "100", outAmount: "5", router: "Jupiter" }, "5000000"), null);
});

test("the curve prices each size off the smallest quote", () => {
  const rows = describeCurve([
    { usd: 5, status: "available", quote: { outAmount: "100000000", router: "Jupiter" } },
    { usd: 25, status: "available", quote: { outAmount: "480000000", router: "Jupiter" } },
  ], 9);
  assert.equal(rows[0].status, "available");
  assert.equal(rows[0].executionPremiumPct, 0);
  assert.ok((rows[1].executionPremiumPct ?? 0) > 0);
});
