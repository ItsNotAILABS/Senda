import test from "node:test";
import assert from "node:assert/strict";
import { feeDrag, quoteEdge, sliceUsd } from "../src/lib/route-cost.ts";

test("the richer output is the cheaper buy", () => {
  const edge = quoteEdge(100, 100.5);
  assert.equal(edge?.lane, "routed");
  assert.ok(edge && edge.bps > 40 && edge.bps < 60);
});

test("a tie is not called a saving", () => {
  assert.equal(quoteEdge(100, 100.002)?.lane, "same");
});

test("a 10 bps fee on 100 dollars is ten cents", () => {
  assert.equal(feeDrag(100, 10), 0.1);
});

test("slices stay at least fifty cents and sum to the ticket", () => {
  const rows = sliceUsd(10, 4);
  assert.ok(rows.every((n) => n >= 0.5));
  assert.equal(Math.round(rows.reduce((s, n) => s + n, 0) * 100), 1000);
});
