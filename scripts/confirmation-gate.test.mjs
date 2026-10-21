import assert from "node:assert/strict";
import test from "node:test";
import { waitForChainConfirmation } from "../src/lib/confirmation-gate.mjs";

const signature = "3".repeat(88);
const options = { attempts: 3, pauseMs: 1, sleep: async () => {} };

test("accepts only confirmed or finalized on-chain signatures", async () => {
  let n = 0;
  const result = await waitForChainConfirmation(signature, async () => {
    n += 1;
    if (n === 1) return null;
    if (n === 2) return { err: null, confirmationStatus: "processed" };
    return { err: null, confirmationStatus: "confirmed" };
  }, options);
  assert.equal(result.confirmationStatus, "confirmed");
  assert.equal(n, 3);
  const finalized = await waitForChainConfirmation(signature, async () => ({ err: null, confirmationStatus: "finalized" }), options);
  assert.equal(finalized.confirmationStatus, "finalized");
});
test("rejects a definitively failed transaction before recording a fill", async () => {
  await assert.rejects(
    () => waitForChainConfirmation(signature, async () => ({ err: { InstructionError: [0, "Custom"] }, confirmationStatus: "confirmed" }), options),
    /failed on-chain/,
  );
});
test("transient RPC errors remain unconfirmed, and can recover", async () => {
  let first = true;
  const result = await waitForChainConfirmation(signature, async () => {
    if (first) { first = false; throw new Error("RPC 429"); }
    return { err: null, confirmationStatus: "finalized" };
  }, options);
  assert.equal(result.confirmationStatus, "finalized");
});
test("missing execution status is never mistaken for success", async () => {
  await assert.rejects(
    () => waitForChainConfirmation(signature, async () => ({ confirmationStatus: "confirmed" }), options),
    /not yet confirmed/,
  );
});

test("timeouts never claim a fill or invite blind re-signing", async () => {
  await assert.rejects(
    () => waitForChainConfirmation(signature, async () => null, options),
    /submitted but is not yet confirmed.*never sign a duplicate blindly/i,
  );
});
test("invalid signatures fail before RPC calls", async () => {
  let called = false;
  await assert.rejects(
    () => waitForChainConfirmation("not-a-signature", async () => {called = true; return null}, options),
    /valid Solana transaction signature/,
  );
  assert.equal(called, false);
});
