import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accept,
  claw,
  FLOAT,
  freeze,
  fresh,
  openingHolds,
  returnPublic,
  send,
  shield,
  stageBreakpoint,
  thaw,
  view,
  type Rail,
  type Result,
} from "./zelle-rail.ts";

function rng(): string {
  return "ab".repeat(32);
}

function ok(result: Result): Rail {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.rail;
}

describe("zelle rail", () => {
  it("stages the breakpoint send and hides $1.25M from the public and the issuer", () => {
    const rail = ok(stageBreakpoint(fresh(), rng));
    assert.equal(rail.buckets.anchorage.pub, 0);
    assert.equal(rail.buckets.alpha.pub, 3_000_000);
    assert.equal(rail.buckets.alpha.conf, 750_000);
    assert.equal(rail.pending[0]?.usd, 1_250_000);

    const pub = view(rail, "public");
    const sendRow = pub.tape.find((row) => row.kind === "send");
    assert.equal(sendRow?.usd, null);
    assert.equal(sendRow?.hidden, true);
    assert.equal(pub.pending[0]?.usd, null);
    assert.equal(pub.buckets.find((row) => row.id === "alpha")?.conf, null);
    assert.equal(view(rail, "anchorage").pending[0]?.usd, null);

    assert.equal(view(rail, "zelle").pending[0]?.usd, 1_250_000);
    assert.equal(view(rail, "beta").pending[0]?.usd, 1_250_000);
    assert.equal(view(rail, "beta").buckets.find((row) => row.id === "alpha")?.conf, null);
    assert.equal(view(rail, "alpha").buckets.find((row) => row.id === "alpha")?.conf, 750_000);
    assert.ok(sendRow && openingHolds(1_250_000, "ab".repeat(32), sendRow.commitment));
  });

  it("lets only the receiver accept, once", () => {
    const staged = ok(stageBreakpoint(fresh(), rng));
    const id = staged.pending[0]!.id;
    assert.equal(accept(staged, id, "alpha").ok, false);
    assert.equal(view(staged, "alpha").pending[0]?.canAccept, false);
    assert.equal(view(staged, "beta").pending[0]?.canAccept, true);
    const accepted = ok(accept(staged, id, "beta"));
    assert.equal(accepted.pending.length, 0);
    assert.equal(accepted.buckets.beta.conf, 1_250_000);
    assert.equal(view(accepted, "public").tape.find((row) => row.kind === "accept")?.usd, null);
    assert.equal(view(accepted, "zelle").buckets.find((row) => row.id === "beta")?.conf, 1_250_000);
    assert.equal(accept(accepted, id, "beta").ok, false);
  });

  it("freeze blocks the hidden balance, and a claw cannot reach it", () => {
    const staged = ok(stageBreakpoint(fresh(), rng));
    const frozenBeta = ok(freeze(staged, "beta", "Hold Bank Beta"));
    const id = frozenBeta.pending[0]!.id;
    const refused = accept(frozenBeta, id, "beta");
    assert.equal(refused.ok, false);
    if (!refused.ok) assert.match(refused.error, /frozen/);
    const pendingStill = send(frozenBeta, "alpha", 100, "settlement", "Beta is held");
    assert.equal(pendingStill.ok, true);

    const senderFrozen = ok(freeze(staged, "alpha", "Hold Bank Alpha"));
    assert.equal(send(senderFrozen, "alpha", 100, "settlement", "Should fail").ok, false);
    assert.equal(shield(senderFrozen, "alpha", 100, "Should fail").ok, false);
    const took = ok(claw(senderFrozen, "alpha", 3_000_000, "Take the public dollars"));
    assert.equal(took.buckets.alpha.pub, 0);
    assert.equal(took.buckets.alpha.conf, 750_000);
    assert.equal(took.buckets.alpha.frozen, true);
    assert.equal(claw(took, "alpha", 1, "The rest").ok, false);
    assert.equal(view(took, "public").tape.find((row) => row.kind === "claw")?.usd, 3_000_000);
    assert.equal(thaw(senderFrozen, "alpha", "Open").ok, true);
  });

  it("refuses an empty memo, an oversize hidden send, and a second funding", () => {
    const rail = fresh();
    assert.equal(send(rail, "alpha", 10, "settlement", "   ").ok, false);
    const early = send(rail, "alpha", 10, "settlement", "Before any shield");
    assert.equal(early.ok, false);
    if (!early.ok) assert.match(early.error, /confidential/i);
    const funded = ok(stageBreakpoint(rail, rng));
    assert.equal(send(funded, "alpha", 800_000, "remit-in", "Too much").ok, false);
    const returned = ok(returnPublic(funded, "alpha", 1_000_000, "Partial return"));
    const shielded = ok(shield(returned, "alpha", 100, "Small shield"));
    assert.equal(shielded.buckets.alpha.conf > 750_000, true);
    assert.equal(stageBreakpoint(funded, rng).ok, false);
    assert.equal(FLOAT, 5_000_000);
  });
});
