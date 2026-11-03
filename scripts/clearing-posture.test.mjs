import assert from "node:assert/strict";
import test from "node:test";
import { clearingPosture } from "../src/lib/clearing-posture.mjs";

test("clearing stays uncustodial and does not invent a card or a chain head", () => {
  const posture = clearingPosture();
  assert.equal(posture.parallax.deployed, false);
  assert.equal(posture.parallax.custody, false);
  assert.equal(posture.stocklana.panStored, false);
  assert.equal(posture.monad.signed, false);
  assert.equal(posture.monad.chainId, 143);
  assert.equal(posture.mastercard.secrets.length, 4);
});
