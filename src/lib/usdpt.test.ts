import assert from "node:assert/strict";
import test from "node:test";
import { pickUsdpt, poolNote, USDPT } from "./usdpt.ts";

const LIVE = {
  id: USDPT,
  symbol: "USDPT",
  isVerified: true,
  circSupply: 19_366_832,
  holderCount: 615,
  usdPrice: 0.98,
  liquidity: 261,
};

test("the verified Western Union mint is kept and the pump coin is dropped", () => {
  const pump = { id: "BjqH7c7Zqu9Pwdim8fveZiF7UDiT7ktBVnUrXvuRpump", symbol: "USDPT", isVerified: false, circSupply: 999, usdPrice: 0.00002, liquidity: 5000 };
  const snap = pickUsdpt([pump, LIVE]);
  assert.equal(snap?.supply, 19_366_832);
  assert.equal(snap?.holders, 615);
  assert.equal(pickUsdpt([pump]), null);
  assert.equal(pickUsdpt({ id: USDPT }), null);
});

test("a thin pool is named, not treated as a rail", () => {
  assert.match(poolNote(261), /261/);
  assert.match(poolNote(261), /will not clear/);
  assert.doesNotMatch(poolNote(20_000), /will not clear/);
});
