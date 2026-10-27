import assert from "node:assert/strict";
import test from "node:test";
import { matmul } from "../src/lib/matdaemon.ts";
import { launchScore, refuseLaunch } from "../src/lib/launch-gate.ts";

test("matmul matches the textbook product", () => {
  assert.deepEqual(matmul([[1, 2], [3, 4]], [[5, 6], [7, 8]]), [[19, 22], [43, 50]]);
});

test("a live mint authority is refused", () => {
  const row = {
    mint: "x", symbol: "NEW", name: "New", decimals: 6, launchpad: "pump.fun",
    holders: 3, createdAt: new Date().toISOString(), organic: 10, liquidity: 1000, price: 0,
    mintOff: false, freezeOff: true, devMints: 1,
  };
  assert.match(refuseLaunch(row) || "", /Mint authority/);
  assert.equal(launchScore(row).score, 0);
});

test("authorities off can score", () => {
  const row = {
    mint: "x", symbol: "NEW", name: "New", decimals: 6, launchpad: "pump.fun",
    holders: 4, createdAt: new Date().toISOString(), organic: 20, liquidity: 2500, price: 0.0001,
    mintOff: true, freezeOff: true, devMints: 1,
  };
  assert.equal(refuseLaunch(row), null);
  assert.ok(launchScore(row).score > 0);
});
