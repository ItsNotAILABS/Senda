import assert from "node:assert/strict";
import test from "node:test";
import { sendAllowed } from "./solana-cli.ts";

test("the house wallet only sends a small devnet amount", () => {
  assert.equal(sendAllowed(0.05), true);
  assert.equal(sendAllowed(0), false);
  assert.equal(sendAllowed(1), false);
  assert.equal(sendAllowed(Number.NaN), false);
});
