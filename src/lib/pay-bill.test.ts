import assert from "node:assert/strict";
import test from "node:test";
import { USDC_MINT, billClock, chargeMemo, readSlip, withTip } from "./pay-bill.ts";

const TO = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

test("a tip is cents on the bill, in the same total", () => {
  assert.deepEqual(withTip(18.4, 15), { bill: 18.4, tip: 2.76, total: 21.16 });
  assert.deepEqual(withTip(10, 0), { bill: 10, tip: 0, total: 10 });
  assert.equal(withTip(0, 20).total, 0);
});

test("the clock is a stamp in the memo, not a second payment", () => {
  assert.equal(chargeMemo("coffee", 1_700_000_000_000), "exp=1700000000000 coffee");
  assert.equal(chargeMemo("exp=9 lunch", null), "lunch");
  assert.equal(billClock("exp=1700000000000 coffee"), 1_700_000_000_000);
  assert.equal(billClock("no clock"), null);
});

test("a bill names the shop, the amount, and when it dies", () => {
  const slip = readSlip(
    { recipient: TO, amount: 12.5, splToken: USDC_MINT, label: "Cafe", message: "Lunch", memo: "exp=1700000000000 coffee" },
    1_700_000_000_001,
  );
  assert.equal(slip.ok, true);
  if (!slip.ok) return;
  assert.equal(slip.to, TO);
  assert.equal(slip.bill, 12.5);
  assert.equal(slip.label, "Cafe");
  assert.equal(slip.expired, true);
});

test("a bare address is a bill with no amount and no clock", () => {
  const slip = readSlip({ recipient: TO }, 9);
  assert.equal(slip.ok, true);
  if (!slip.ok) return;
  assert.equal(slip.bill, null);
  assert.equal(slip.expiresAt, null);
  assert.equal(slip.expired, false);
});

test("a non-USDC bill is refused", () => {
  const slip = readSlip({ recipient: TO, amount: 1, splToken: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" });
  assert.equal(slip.ok, false);
});
