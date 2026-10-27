import assert from "node:assert/strict";
import test from "node:test";
import { coherence, cosineSimilarity, logSpectralDistance, readRoutes, resonance } from "../src/lib/mesie-route.ts";

test("identical spectra are coherent", () => {
  const row = [1, 1, 1];
  assert.ok(Math.abs(cosineSimilarity(row, row) - 1) < 1e-12);
  assert.equal(coherence([row]), 1);
  assert.equal(resonance(row), 1);
  assert.equal(logSpectralDistance(row, row), 0);
});

test("a 2× peak is dropped when a flat route exists", () => {
  const read = readRoutes([
    { out: 100, impact: 0.01, ms: 50 },
    { out: 100, impact: 4.9, ms: 8000 },
  ]);
  assert.ok(read.resonance[1] >= 2);
  assert.equal(read.keep[0], true);
  assert.equal(read.keep[1], false);
  assert.ok(read.coherence < 1);
  assert.ok(read.logDistance > 0);
});
