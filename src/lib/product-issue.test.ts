import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { handoff, markUse, payLegs, planIssue, seatState, spendAgainst, splitAmounts, thingKindFor } from "./product-issue.ts";

const maker = Keypair.generate().publicKey.toBase58();
const contributor = Keypair.generate().publicKey.toBase58();
const reserve = Keypair.generate().publicKey.toBase58();
const buyer = Keypair.generate().publicKey.toBase58();

test("70, 20, and 10 of $100 land on the cent", () => {
  const split = splitAmounts(100, 7000, 2000, 1000);
  assert.deepEqual(split, { makerUsd: 70, contributorUsd: 20, heldUsd: 10 });
});

test("dust goes to the largest share", () => {
  const split = splitAmounts(10, 3333, 3333, 3334);
  assert.ok(!("error" in split));
  if ("error" in split) return;
  assert.equal(Math.round((split.makerUsd + split.contributorUsd + split.heldUsd) * 100), 1000);
});

test("a split that is not 100 is refused", () => {
  assert.deepEqual(splitAmounts(10, 7000, 2000, 500), { error: "The split has to add to 100." });
});

test("a product is a seal, software is a pass, a follow-on is lineage", () => {
  assert.equal(thingKindFor("product", ""), "seal");
  assert.equal(thingKindFor("software", ""), "pass");
  assert.equal(thingKindFor("software", "ab".repeat(32)), "line");
});

test("the plan hashes the terms and leaves the name off the line", () => {
  const plan = planIssue({
    kind: "software",
    title: "Desk build",
    body: "The build that runs the lab desk.",
    priceUsd: 25,
    maker,
    makerBps: 7000,
    contributorBps: 2000,
    heldBps: 1000,
    contributor,
    reserve,
    allow: "Run this build.",
    quota: 100,
    days: 30,
    parent: "",
    slot: 80,
  });
  assert.ok(!("error" in plan));
  if ("error" in plan) return;
  assert.equal(plan.thing, "pass");
  assert.equal(plan.draft.line.includes("Desk build"), false);
  assert.equal(plan.draft.line.includes("lab desk"), false);
  assert.equal(plan.makerUsd, 17.5);
  assert.equal(plan.contributorUsd, 5);
  assert.equal(plan.heldUsd, 2.5);
  const pay = payLegs(buyer, plan.rule);
  assert.equal(pay.reduce((sum, row) => sum + row.usd, 0), 25);
});

test("the buyer does not pay their own share", () => {
  const plan = planIssue({
    kind: "product",
    title: "Field radio",
    body: "One radio. The serial stays with the unit.",
    priceUsd: 40,
    maker,
    makerBps: 10000,
    contributorBps: 0,
    heldBps: 0,
    contributor: "",
    reserve: "",
    allow: "Hold it. Hand it on.",
    quota: 0,
    days: 0,
    parent: "",
    slot: 11,
  });
  assert.ok(!("error" in plan));
  if ("error" in plan) return;
  assert.deepEqual(payLegs(maker, plan.rule), []);
  assert.equal(payLegs(buyer, plan.rule)[0]?.to, maker);
});

test("a file can move and a license cannot", () => {
  assert.equal("error" in handoff("license", maker, buyer), true);
  assert.equal("error" in handoff("service", maker, buyer), true);
  assert.equal("ok" in handoff("file", maker, buyer), true);
  assert.equal(thingKindFor("license", ""), "pass");
  assert.equal(thingKindFor("file", ""), "seal");
});

test("a license cannot be handed off", () => {
  assert.equal("error" in handoff("software", maker, buyer), true);
  const moved = handoff("product", maker, buyer);
  assert.equal("ok" in moved && moved.ok, true);
});

test("a seat expires, revokes, and counts down", () => {
  const seat = { quota: 2, left: 2, until: 1_000, revoked: false };
  assert.equal(seatState(seat, 1_001), "expired");
  assert.equal(seatState({ ...seat, revoked: true }, 10), "revoked");
  const once = markUse(seat, 10);
  assert.ok(!("error" in once));
  if ("error" in once) return;
  assert.equal(once.left, 1);
  assert.equal(seatState({ ...once, left: 0 }, 10), "used");
});

test("an agent cannot spend past the cap", () => {
  assert.deepEqual(spendAgainst(20, 15, 6), { error: "The cap has $5.00 left." });
  assert.deepEqual(spendAgainst(20, 15, 5), { spent: 20 });
});
