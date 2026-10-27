import assert from "node:assert/strict";
import test from "node:test";
import { cosine, receipt, scorePaths, topK } from "../src/lib/matdaemon.ts";

test("cosine of identical vectors is 1", () => {
  assert.equal(cosine([3, 4], [3, 4]), 1);
});

test("topK returns the nearer vector first", () => {
  const hits = topK(
    [1, 0],
    [
      { id: "far", vector: [0, 1] },
      { id: "near", vector: [1, 0.1] },
    ],
    2,
  );
  assert.equal(hits[0].id, "near");
  assert.ok(hits[0].score > hits[1].score);
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ["near", "far"],
  );
});

test("a zero vector is skipped", () => {
  const hits = topK(
    [1, 0],
    [
      { id: "zero", vector: [0, 0] },
      { id: "ok", vector: [0, 1] },
    ],
    2,
  );
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ["ok"],
  );
});

test("scorePaths prefers higher output and deeper liquidity over a worse impact", () => {
  const ranked = scorePaths([
    { id: "thin", out: 10, impact: 0.01, liquidity: 100 },
    { id: "deep", out: 100, impact: 0.8, liquidity: 5000 },
  ]);
  assert.equal(ranked[0].id, "deep");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("receipt.ms is a positive integer and bound is 16", () => {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const row = receipt("topk", started, 3);
  assert.equal(row.op, "topk");
  assert.equal(row.rows, 3);
  assert.equal(row.bound, 16);
  assert.equal(typeof row.ms, "number");
  assert.ok(Number.isInteger(row.ms));
  assert.ok(row.ms >= 1);
});
