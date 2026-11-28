import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { buildActivity, parseRecovery, recipientsOf, searchActivity } from "./activity.ts";
import { mergeRecovered, recordSubmission } from "./tx-journal.mjs";

const owner = Keypair.generate().publicKey.toBase58();
const other = Keypair.generate().publicKey.toBase58();
const dest = Keypair.generate().publicKey.toBase58();
const sig = "5".repeat(87) + "A";

function memory() {
  const box = new Map();
  return { getItem: (k) => box.get(k) ?? null, setItem: (k, v) => box.set(k, v) };
}

test("a journal status replaces a local signed note, and search finds the recipient", () => {
  const rows = buildActivity(
    [{ signature: sig, owner, kind: "send", asset: "USDC", destination: dest, amountRaw: "2500000", submittedAt: 10, checkedAt: 11, status: "pending" }],
    [{ at: 9, symbol: "USDC", side: "send", usd: 2.5, mint: dest, signature: sig }],
  );
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].amount, "2.50");
  assert.equal(searchActivity(rows, dest.slice(0, 6)).length, 1);
  assert.equal(recipientsOf(rows)[0].address, dest);
});

test("a recovery file for another wallet is refused", () => {
  const store = memory();
  recordSubmission(store, { signature: sig, owner, kind: "send", asset: "USDC", destination: dest, amountRaw: "1000000" }, 20);
  assert.throws(() => mergeRecovered(store, owner, [{ signature: sig, owner: other, kind: "send", asset: "USDC", destination: dest, amountRaw: "1000000", submittedAt: 20, checkedAt: 20, status: "finalized" }]), /different wallet/);
  assert.equal(parseRecovery(JSON.stringify({ v: 1, owner: other, journal: [], trades: [] }), owner).error, "That file is for a different wallet. Nothing was replaced.");
});

test("an import can confirm a pending send and cannot reopen a finalized one", () => {
  const store = memory();
  recordSubmission(store, { signature: sig, owner, kind: "send", asset: "USDC", destination: dest, amountRaw: "1000000" }, 20);
  const pending = { signature: sig, owner, kind: "send", asset: "USDC", destination: dest, amountRaw: "1000000", submittedAt: 20, checkedAt: 21, status: "confirmed" };
  assert.equal(mergeRecovered(store, owner, [pending])[0].status, "confirmed");
  const fin = { ...pending, status: "finalized", checkedAt: 30 };
  mergeRecovered(store, owner, [fin]);
  mergeRecovered(store, owner, [{ ...pending, status: "pending", checkedAt: 40 }]);
  assert.equal(mergeRecovered(store, owner, [])[0].status, "finalized");
});
