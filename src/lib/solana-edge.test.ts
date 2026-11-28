import assert from "node:assert/strict";
import test from "node:test";
import { Keypair } from "@solana/web3.js";
import { actorPda, chainLine, edgeHash, edgePreimage, feeTape, MACHINES } from "./solana-edge.ts";

test("the chain line is the hash, not the account number", () => {
  const key = "002180650612345670";
  const preimage = edgePreimage({ actor: "mexico", corridor: "mx-spei", usd: 100, name: "Ana Ruiz", concept: "Rent", key, slot: 10 });
  const hash = edgeHash(preimage);
  const line = chainLine("mexico", hash, 10);
  assert.equal(hash.length, 64);
  assert.equal(line.includes(key), false);
  assert.equal(preimage.includes(key), true);
  assert.equal(line, `senda.edge.1 mexico ${hash} slot 10`);
});

test("an actor address is off the curve", () => {
  const owner = Keypair.generate().publicKey.toBase58();
  const mexico = actorPda(owner, "mexico");
  const brazil = actorPda(owner, "brazil");
  assert.equal(mexico.onCurve, false);
  assert.equal(brazil.onCurve, false);
  assert.notEqual(mexico.address, brazil.address);
});

test("a hot fee market holds a send", () => {
  const quiet = feeTape([{ prioritizationFee: 0 }, { prioritizationFee: 100 }]);
  const hot = feeTape([{ prioritizationFee: 80_000 }, { prioritizationFee: 120_000 }]);
  assert.equal(quiet.hold, false);
  assert.equal(hot.hold, true);
});

test("machine ids are real addresses", () => {
  assert.equal(MACHINES.length, 6);
  for (const row of MACHINES) assert.equal(row.id.length > 30, true);
});
