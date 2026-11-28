import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { draftThing, thingName } from "./thing-route.ts";

const BODY = "The batch exists. The PDF stays off the cluster.";

test("a seal commits the words to the hash and leaves them off the line", () => {
  const draft = draftThing({ kind: "seal", title: "Lab note", body: BODY, slot: 40 });
  assert.ok(!("error" in draft));
  if ("error" in draft) return;
  assert.equal(draft.hash.length, 64);
  assert.equal(draft.line, `senda.thing.1 seal ${draft.hash} slot 40`);
  assert.equal(draft.line.includes(BODY), false);
  assert.equal(draft.line.includes("Lab note"), false);
  assert.equal(draft.until, 190);
});

test("lineage names its parent and not the note", () => {
  const draft = draftThing({ kind: "line", title: "Memory", body: "This note follows the sealed batch.", parent: "genesis", slot: 9 });
  assert.ok(!("error" in draft));
  if ("error" in draft) return;
  assert.match(draft.line, /^senda\.thing\.1 line [0-9a-f]{64} parent genesis slot 9$/);
  assert.equal(draft.line.includes("follows"), false);
});

test("a bad parent is refused", () => {
  const draft = draftThing({ kind: "line", title: "Memory", body: "This note follows the sealed batch.", parent: "yesterday", slot: 9 });
  assert.deepEqual(draft, { error: "Lineage needs genesis, or the 64-character parent hash." });
});

test("a handoff names the other wallet and does not pay it", () => {
  const to = Keypair.generate().publicKey.toBase58();
  const draft = draftThing({
    kind: "hand",
    title: "Lab node",
    body: "The lab node changes hands. The machine is not a payment.",
    to,
    slot: 12,
  });
  assert.ok(!("error" in draft));
  if ("error" in draft) return;
  assert.equal(draft.line.includes(to), true);
  assert.equal(draft.line.includes("USDC"), false);
  assert.equal(draft.line.includes("machine"), false);
});

test("a handoff without a wallet is refused", () => {
  const draft = draftThing({ kind: "hand", title: "Lab node", body: "The lab node changes hands today.", slot: 12 });
  assert.ok("error" in draft);
});

test("the name is off the curve and changes with the job", () => {
  const owner = Keypair.generate().publicKey.toBase58();
  const seal = thingName(owner, "seal", "Lab note");
  const pass = thingName(owner, "pass", "Lab note");
  assert.equal(seal.onCurve, false);
  assert.equal(pass.onCurve, false);
  assert.notEqual(seal.address, pass.address);
});
