import assert from "node:assert/strict";
import test from "node:test";
import { headlineRails } from "./solana-rails.ts";
import { annualVol, assigned, deal, modelPremium, windowAverage } from "./stack-math.ts";

test("a covered call sells above the spot and a put buys below it", () => {
  const call = deal({ side: "call", spot: 140, size: 1, liftPct: 10, days: 14 });
  const put = deal({ side: "put", spot: 140, size: 1540, liftPct: 10, days: 14 });
  assert.equal(call?.strike, 154);
  assert.equal(call?.usdc, 154);
  assert.equal(put?.strike, 126);
  assert.ok(Math.abs((put?.sol ?? 0) - 1540 / 126) < 1e-9);
  assert.equal(deal({ side: "call", spot: 0, size: 1, liftPct: 10, days: 7 }), null);
  assert.equal(deal({ side: "call", spot: 140, size: 1, liftPct: 10, days: 3 }), null);
});

test("assignment is only past the strike", () => {
  assert.equal(assigned("call", 160, 154), true);
  assert.equal(assigned("call", 154, 154), false);
  assert.equal(assigned("put", 100, 126), true);
  assert.equal(assigned("put", 126, 126), false);
});

test("Senda prices a call from the day's move, and a flat day has no vol", () => {
  const vol = annualVol(1);
  assert.ok(vol != null && Math.abs(vol - 0.01 * Math.sqrt(365)) < 1e-12);
  assert.equal(annualVol(0), null);
  const row = deal({ side: "call", spot: 100, size: 1, liftPct: 10, days: 14 });
  const px = modelPremium({ side: "call", spot: 100, strike: row!.strike, sol: 1, days: 14, vol: vol! });
  assert.ok(px != null && px > 0 && px < 100);
  const rich = modelPremium({ side: "call", spot: 100, strike: 80, sol: 1, days: 14, vol: vol! });
  assert.ok(rich != null && rich > 19);
  assert.equal(modelPremium({ side: "call", spot: 100, strike: 110, sol: 1, days: 14, vol: 0 }), null);
  assert.equal(windowAverage([73]), null);
  assert.equal(windowAverage([73, 74]), 73.5);
});

test("a protocol rate is the deepest pool, not the loudest apy", () => {
  const rows = headlineRails([
    { project: "sanctum-infinity", chain: "Solana", tvlUsd: 100, apy: 900, symbol: "DUST" },
    { project: "sanctum-infinity", chain: "Solana", tvlUsd: 1_000_000, apy: 5.5, symbol: "INF" },
    { project: "sanctum-infinity", chain: "Ethereum", tvlUsd: 9_000_000, apy: 1, symbol: "NO" },
    { project: "not-ours", chain: "Solana", tvlUsd: 50_000_000, apy: 99, symbol: "X" },
  ]);
  const sanctum = rows.find((row) => row.id === "sanctum-infinity");
  assert.equal(sanctum?.apy, 5.5);
  assert.equal(sanctum?.pool, "INF");
  assert.equal(sanctum?.tvl, 1_000_100);
  assert.equal(rows.some((row) => row.id === "not-ours"), false);
});
