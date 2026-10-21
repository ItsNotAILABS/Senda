import assert from "node:assert/strict";
import test from "node:test";
import { verifySwapQuote } from "../src/lib/quote-guard.mjs";

const intent = { inputMint: "MintIn", outputMint: "MintOut", amountRaw: 10_000_000 };
const valid = () => ({
  inputMint: intent.inputMint, outputMint: intent.outputMint,
  inAmount: "10000000", outAmount: "9000000", otherAmountThreshold: "8910000",
  slippageBps: 100, swapMode: "ExactIn", priceImpactPct: "0.015",
  routePlan: [{ swapInfo: { ammKey: "Jupiter" } }],
});
const denied = /wallet was not asked to sign/i;

test("allows a valid ExactIn quote and preserves the minimum receive", () => {
  assert.deepEqual(verifySwapQuote(valid(), intent), {
    inAmount: "10000000", outAmount: "9000000",
    minOutAmount: "8910000", impactPercent: 1.5,
  });
});
test("rejects changed mints, amounts, slippage, mode, route, and invalid impact", () => {
  const invalid = [
    { inputMint: "AttackerMint" }, { outputMint: "AttackerMint" },
    { inAmount: "10000001" }, { outAmount: "0" },
    { otherAmountThreshold: "0" }, { otherAmountThreshold: "9900000" },
    { slippageBps: 1000 }, { swapMode: "ExactOut" }, { routePlan: [] },
    { priceImpactPct: "0.06" }, { priceImpactPct: "NaN" },
    { priceImpactPct: undefined }, { priceImpactPct: "-0.02" },
  ];
  for (const change of invalid) {
    assert.throws(() => verifySwapQuote({ ...valid(), ...change }, intent), denied, JSON.stringify(change));
  }
});
test("rejects an unsafe JS integer rather than silently rounding financial amounts", () => {
  assert.throws(() => verifySwapQuote(valid(), { ...intent, amountRaw: Number.MAX_SAFE_INTEGER + 1 }), denied);
});
test("accepts the impact limit but rejects above the limit", () => {
  assert.equal(verifySwapQuote({ ...valid(), priceImpactPct: "0.05" }, intent).impactPercent, 5);
  assert.throws(() => verifySwapQuote({ ...valid(), priceImpactPct: "0.0501" }, intent), denied);
});
