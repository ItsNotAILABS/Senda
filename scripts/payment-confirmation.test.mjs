import assert from "node:assert/strict";
import test from "node:test";
import { confirmSolanaPayment } from "../src/lib/payment-confirmation.mjs";
const sig = "3".repeat(88);
const fast = { attempts: 2, pauseMs: 1, sleep: async () => {} };
test("requests exact signature status with transaction history", async () => {
  const calls = [];
  const ok = await confirmSolanaPayment(sig, async (method, params) => {
    calls.push([method, params]);
    return { value: [{ err: null, confirmationStatus: "confirmed" }] };
  }, fast);
  assert.equal(ok.signature, sig);
  assert.equal(ok.confirmationStatus, "confirmed");
  assert.deepEqual(calls, [["getSignatureStatuses", [[sig], { searchTransactionHistory: true }]]]);
});
test("rejects an on-chain execution error before declaring payment complete", async () => {
  await assert.rejects(() => confirmSolanaPayment(sig, async () =>
    ({ value: [{ err: { InstructionError: [1, "Custom"] }, confirmationStatus: "confirmed" }] }), fast),
  /failed on-chain/);
});
test("unknown status and RPC exceptions do not prove settlement", async () => {
  await assert.rejects(() => confirmSolanaPayment(sig, async () => ({ value: [null] }), fast), /not yet confirmed/);
  await assert.rejects(() => confirmSolanaPayment(sig, async () => { throw new Error("RPC 429"); }, fast), /not yet confirmed/);
  await assert.rejects(() => confirmSolanaPayment(sig, async () => ({ value: [{ confirmationStatus: "confirmed" }] }), fast), /not yet confirmed/);
});
test("recovers from processed to finalized status", async () => {
  let tries = 0;
  const ok = await confirmSolanaPayment(sig, async () => ({ value: [
    ++tries === 1 ? { err: null, confirmationStatus: "processed" } : { err: null, confirmationStatus: "finalized" },
  ] }), fast);
  assert.equal(ok.confirmationStatus, "finalized");
  assert.equal(tries, 2);
});
