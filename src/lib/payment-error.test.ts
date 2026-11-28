import assert from "node:assert/strict";
import test from "node:test";
import { coverCheck, explainPayment } from "./payment-error.ts";

test("a short balance is refused before a payment", () => {
  const short = coverCheck(5_000_000, 0.01);
  assert.equal(short.ok, false);
  if (!short.ok) assert.match(short.why, /Nothing was sent/);
  assert.equal(coverCheck(20_000_000, 0.01).ok, true);
});

test("a declined wallet and a submitted signature stay distinct", () => {
  assert.match(explainPayment(new Error("User rejected the request.")), /Nothing was sent/);
  assert.match(explainPayment(new Error("Submitted abc. It was not confirmed. Do not send it again.")), /Do not send it again/);
  assert.match(explainPayment(new Error("Transfer: insufficient lamports")), /Nothing was sent/);
});
