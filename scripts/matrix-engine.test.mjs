import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBars, evaluateMatrix } from "../src/lib/matrix-engine.ts";

function sample(vol = true) {
  return Array.from({ length: 55 }, (_, i) => {
    const p = 100 + i * 0.5;
    return { t: 1700000000000 + i * 3600000, o: p, h: p + 1, l: p - 0.6, c: p + 0.4, v: vol ? 1000 + i * 12 : 0 };
  });
}

test("reject invalid OHLCV and sort chronological candles", () => {
  const b = sample();
  const v = normalizeBars([b[1], { ...b[0], h: 1 }, b[0]]);
  assert.equal(v.length, 2);
  assert.ok(v[0].t < v[1].t);
});

test("never invent volume or matrix direction for price-only data", () => {
  const m = evaluateMatrix({ bars: sample(), source: "price-only" });
  assert.equal(m.market, "insufficient");
  assert.equal(m.volumeUsd, null);
  assert.ok(m.cells.every((x) => x.signal === "blocked"));
});

test("all-zero real pool volume still blocks every strategy", () => {
  const m = evaluateMatrix({ bars: sample(false), source: "gecko-pool" });
  assert.equal(m.confidence, 0);
  assert.equal(m.market, "insufficient");
});

test("reliable pool OHLCV produces indicators and bounded scores", () => {
  const m = evaluateMatrix({ bars: sample(), source: "gecko-pool" });
  assert.equal(m.bars, 55);
  assert.ok(m.volumeRatio > 0);
  assert.ok(m.vwap > 0);
  assert.ok(m.rsi >= 0 && m.rsi <= 100);
  assert.ok(m.atrPct > 0);
  assert.ok(m.confidence >= 0 && m.confidence <= 100);
});

test("too little real history has no signal", () => {
  const m = evaluateMatrix({ bars: sample().slice(0, 8), source: "gecko-pool" });
  assert.equal(m.market, "insufficient");
  assert.deepEqual(m.cells, []);
});
