import assert from "node:assert/strict";
import test from "node:test";
import { movePct, researchOk, reward, saveVow } from "./conviction.ts";

const NOTE = "Sanctum's INF rate is above Kamino on the same SOL, and the pool is deep enough that a 14-day hold is the trade.";

test("a ticker is not research", () => {
  assert.equal(researchOk("moon"), false);
  assert.equal(researchOk("SOL up soon"), false);
  assert.equal(researchOk(NOTE), true);
});

test("the reward is the move your way, and time only multiplies a win", () => {
  assert.equal(movePct("long", 100, 110), 10);
  assert.equal(movePct("short", 100, 90), 10);
  assert.equal(movePct("long", 100, 90), -10);
  assert.equal(reward(-10, 86_400_000), 0);
  assert.equal(reward(10, 0), 10);
  const later = reward(10, 86_400_000);
  assert.ok(later > 10);
  assert.equal(saveVow({ symbol: "SOL", mint: "So11111111111111111111111111111111111111112", side: "long", size: 25, entry: 0, thesis: NOTE }), null);
});
