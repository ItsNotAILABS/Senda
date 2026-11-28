import assert from "node:assert/strict";
import test from "node:test";
import { BULLISH, ISSUER_ASKS, holdingBand, shareCard } from "./access-rails.ts";

test("a public balance is a band, not a proof of wealth", () => {
  assert.equal(holdingBand(0), "No USDC in this wallet");
  assert.equal(holdingBand(Number.NaN), "No USDC in this wallet");
  assert.equal(holdingBand(50), "Under $100");
  assert.equal(holdingBand(250), "$100 to $1,000");
  assert.equal(holdingBand(5_000), "$1,000 to $10,000");
  assert.equal(holdingBand(20_000), "Over $10,000");
});

test("the share card refuses a credit score and a Jupiter identity", () => {
  const text = shareCard({
    device: "open",
    wallet: "Abcdefghijklmnop",
    usdc: 40,
    bandOnly: true,
    floor: 0,
    sendLeft: 500,
  });
  assert.match(text, /Under \$100/);
  assert.match(text, /Phone key open/);
  assert.match(text, /Abcd…mnop/);
  assert.match(text, /not a credit score/i);
  assert.match(text, /not Jupiter Verified Identity/);
  assert.match(text, /not a zero-knowledge proof/i);
});

test("an exact balance is still not a score", () => {
  const text = shareCard({
    device: "none",
    wallet: "",
    usdc: 12.5,
    bandOnly: false,
    floor: 25,
    sendLeft: 80,
  });
  assert.match(text, /\$12\.50 public USDC/);
  assert.match(text, /No wallet/);
  assert.match(text, /not a credit score/i);
});

test("the Bullish market is announced and not open", () => {
  assert.equal(BULLISH.open, false);
  assert.match(BULLISH.gate, /Not open/);
  assert.match(BULLISH.terms, /will not invent/);
  assert.match(BULLISH.agent, /Senda is not/);
});

test("issuer services are not filed from this desk", () => {
  assert.equal(ISSUER_ASKS.length, 4);
  for (const row of ISSUER_ASKS) {
    assert.match(row.line, /does not|will not|no maker/i);
  }
});
