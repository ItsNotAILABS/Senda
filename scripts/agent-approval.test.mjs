import assert from "node:assert/strict";
import test from "node:test";
import { approveAgentQueue } from "../src/lib/agent-approval.mjs";
const day = "2026-10-23";
const base = () => ({
  armed: true, name: "Buyer", job: "discount", action: "swap", order: "market", side: "buy",
  symbols: ["PRE"], maxUsd: 100, spentUsd: 25, signedOn: "",
  queue: { action: "swap", order: "market", side: "buy", symbol: "PRE", usd: 75, why: "approved" },
});
const reject = /Nothing was signed/;
const invalid = (update) => assert.throws(() => approveAgentQueue(update, 100, day), reject);
test("permits the queued action at the remaining budget", () => {
  assert.deepEqual(approveAgentQueue(base(), 100, day), {
    action: "swap", order: "market", side: "buy", usd: 75, payTo: "",
  });
});
test("fails closed on paused, absent, over-budget, and daily-repeat actions", () => {
  invalid({ ...base(), armed: false });
  invalid({ ...base(), queue: null });
  invalid({ ...base(), spentUsd: 26 });
  invalid({ ...base(), spentUsd: 100 });
  invalid({ ...base(), queue: { ...base().queue, usd: 110 } });
  invalid({ ...base(), job: "daily", signedOn: day });
  assert.throws(() => approveAgentQueue(base(), 70, day), reject);
  invalid({ ...base(), spentUsd: NaN });
});
test("rejects queue mutation of side, asset, action or order", () => {
  invalid({ ...base(), queue: { ...base().queue, side: "sell" } });
  invalid({ ...base(), queue: { ...base().queue, symbol: "UNLISTED" } });
  invalid({ ...base(), queue: { ...base().queue, action: "pay" } });
  invalid({ ...base(), queue: { ...base().queue, order: "limit" } });
  invalid({ ...base(), action: "lend" });
  invalid({ ...base(), order: "limit", limitPx: 4, queue: { ...base().queue, order: "limit", limitPx: 5 } });
});
test("payment recipient is pinned to approved payee and asset", () => {
  const pay = { ...base(), action: "pay", payTo: "11111111111111111111111111111111", queue: {
    action: "pay", side: "buy", order: "market", symbol: "USDC", usd: 75,
    payTo: "11111111111111111111111111111111",
  }};
  assert.equal(approveAgentQueue(pay, 100, day).usd, 75);
  invalid({ ...pay, queue: { ...pay.queue, payTo: "22222222222222222222222222222222" } });
  invalid({ ...pay, queue: { ...pay.queue, symbol: "SOL" } });
});
