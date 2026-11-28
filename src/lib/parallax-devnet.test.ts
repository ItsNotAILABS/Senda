import assert from "node:assert/strict";
import test from "node:test";
import { agentSpendGate, checkParallaxDevnet, PARALLAX_RPC } from "./parallax-devnet.ts";

test("mainnet is refused", () => {
  const row = checkParallaxDevnet({ cluster: "mainnet-beta", usd: 5, impact: 0.2, budget: 20 });
  assert.equal(row.ok, false);
  assert.match(row.why, /devnet only/i);
});

test("agent spending stays off until a treasury is verified and draw is open", () => {
  assert.equal(agentSpendGate({ verified: false, spendOpen: false }).ok, false);
  assert.equal(agentSpendGate({ verified: true, spendOpen: false }).ok, false);
  assert.match(agentSpendGate({ verified: true, spendOpen: false }).why, /Draw is closed/);
  assert.equal(agentSpendGate({ verified: true, spendOpen: true }).ok, true);
});

test("a thin devnet book is refused and a fit one is not a signature", () => {
  assert.equal(checkParallaxDevnet({ cluster: "devnet", usd: 5, impact: 1.4, budget: 20 }).ok, false);
  const ok = checkParallaxDevnet({ cluster: "devnet", usd: 5, impact: 0.4, budget: 20 });
  assert.equal(ok.ok, true);
  assert.match(ok.why, /does not sign/);
  assert.equal(PARALLAX_RPC, "https://api.devnet.solana.com");
});
