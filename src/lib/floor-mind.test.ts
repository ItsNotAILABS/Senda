import assert from "node:assert/strict";
import test from "node:test";
import { clampPromise, inventFromBars, monroePick, pickSize, roomLeft, type PlayBar, type SizeRow } from "./floor-mind.ts";

function bar(i: number, close: number, volume = 10): PlayBar {
  return { time: i * 3600, open: close, high: close, low: close, close, volume };
}

function flatThen(lastClose: number, lastVol = 10): PlayBar[] {
  const rows = Array.from({ length: 10 }, (_, i) => bar(i, 100, 10));
  rows.push(bar(10, lastClose, lastVol));
  return rows;
}

const curve: SizeRow[] = [
  { usd: 5, status: "available", impactPct: 0.02, router: "Whirlpool" },
  { usd: 25, status: "available", impactPct: 0.2, router: "Whirlpool" },
  { usd: 100, status: "available", impactPct: 2.4, router: "Meteora" },
  { usd: 250, status: "unavailable", impactPct: null, router: null },
];

test("a flat window is not a strategy", () => {
  assert.equal(inventFromBars("SOL", flatThen(100.2, 10), 25), null);
});

test("a wash becomes a buy the floor wrote", () => {
  const spec = inventFromBars("SOL", flatThen(97, 20), 25);
  assert.ok(spec);
  assert.equal(spec?.side, "buy");
  assert.equal(spec?.direction, "down");
  assert.equal(spec?.usd, 25);
  assert.match(spec?.line || "", /floor wrote this/);
  assert.equal(spec?.wantsOpenInterest, false);
});

test("a blow-off is a sell, not a chase", () => {
  const spec = inventFromBars("JUP", flatThen(106, 30), 5);
  assert.equal(spec?.side, "sell");
  assert.equal(spec?.direction, "up");
});

test("an older blow-off is still a rule when the last hour is quiet", () => {
  const rows = [100, 100, 100, 100, 100, 106, 106.2, 106.1, 106.3, 106.2, 106.4, 106.3].map((close, i) => bar(i, close, i === 5 ? 40 : 10));
  const spec = inventFromBars("SOL", rows, 25);
  assert.equal(spec?.side, "sell");
  assert.equal(spec?.direction, "up");
});

test("Liquify keeps the largest calm size inside the cap", () => {
  const calm = pickSize(curve, 100);
  assert.equal(calm.usd, 25);
  assert.match(calm.note, /Liquify sized \$25/);
  assert.equal(pickSize(curve, 4).usd, null);
  assert.equal(pickSize(curve, 100, 5).usd, 100);
});

test("Monroe pays the route with more output", () => {
  const pick = monroePick([
    { id: "direct", outAmount: "1000000", route: "Direct · Whirlpool", impact: 0.1 },
    { id: "routed", outAmount: "1005000", route: "Whirlpool → Meteora", impact: 0.2 },
  ]);
  assert.equal(pick.winner?.id, "routed");
  assert.equal(pick.edgeBps, 50);
  const tie = monroePick([
    { id: "direct", outAmount: "10", route: "Direct", impact: null },
    { id: "routed", outAmount: "10", route: "Routed", impact: null },
  ]);
  assert.equal(tie.edgeBps, 0);
  assert.equal(monroePick([]).winner, null);
});

test("the promise cannot outrun the send cap or the day", () => {
  const promise = clampPromise({ mode: "prepare", tradeUsd: 500, dayUsd: 40 }, 40);
  assert.equal(promise.tradeUsd, 40);
  assert.equal(promise.dayUsd, 40);
  assert.equal(promise.mode, "prepare");
  assert.equal(roomLeft(promise, 15, 40), 25);
  assert.equal(roomLeft(promise, 40, 40), 0);
  assert.equal(clampPromise({ mode: "nope" }, 100).mode, "watch");
});
