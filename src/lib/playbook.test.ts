import assert from "node:assert/strict";
import test from "node:test";
import { parsePlay, replayPlay, type PlayBar } from "./playbook.ts";

function bar(i: number, close: number, volume: number): PlayBar {
  return { time: i * 3600, open: close, high: close, low: close, close, volume };
}

test("a sentence becomes a price and volume rule", () => {
  const spec = parsePlay(
    "Buy SOL when the last hour is up 3% and volume doubles. Take profit at 2%. Stop if it falls 2%.",
    ["SOL", "HYPE"],
  );
  assert.ok(!("error" in spec));
  if ("error" in spec) return;
  assert.equal(spec.symbol, "SOL");
  assert.equal(spec.side, "buy");
  assert.equal(spec.changePct, 3);
  assert.equal(spec.volumeMul, 2);
  assert.equal(spec.takePct, 2);
  assert.equal(spec.stopPct, 2);
  assert.equal(spec.direction, "up");
  assert.equal(spec.span, "60");
  assert.equal(spec.wantsOpenInterest, false);
});

test("a stop that says falls does not flip the entry", () => {
  const spec = parsePlay("Sell SOL into USDC when the hour is up 4%. Stop if it runs another 2%.", ["SOL"]);
  assert.ok(!("error" in spec));
  if ("error" in spec) return;
  assert.equal(spec.side, "sell");
  assert.equal(spec.direction, "up");
  assert.equal(spec.changePct, 4);
  assert.equal(spec.stopPct, 2);
  assert.equal(spec.takePct, null);
});

test("open interest is named and not pretended", () => {
  const spec = parsePlay("Buy HYPE when open interest climbs 5% in an hour and volume doubles.", ["HYPE"]);
  assert.ok(!("error" in spec));
  if ("error" in spec) return;
  assert.equal(spec.wantsOpenInterest, true);
  assert.match(spec.line, /not armed/i);
  assert.equal(spec.volumeMul, 2);
});

test("the replay buys the jump and takes the profit", () => {
  const spec = parsePlay("Buy SOL when the hour is up 3% and volume doubles. Take profit at 2%. Stop at 5%.", ["SOL"]);
  assert.ok(!("error" in spec));
  if ("error" in spec) return;
  const bars = [bar(0, 100, 10), bar(1, 100, 10), bar(2, 104, 30), bar(3, 108, 10)];
  const replay = replayPlay(spec, bars);
  assert.equal(replay.trades.length, 1);
  assert.ok(replay.trades[0].pnl > 0);
  assert.equal(replay.fired, false);
  assert.equal(replay.open, null);
});

test("a quiet tape does not fire", () => {
  const spec = parsePlay("Buy SOL when the hour is up 3% and volume doubles.", ["SOL"]);
  assert.ok(!("error" in spec));
  if ("error" in spec) return;
  const bars = [bar(0, 100, 10), bar(1, 100, 10), bar(2, 101, 10)];
  const replay = replayPlay(spec, bars);
  assert.equal(replay.trades.length, 0);
  assert.equal(replay.fired, false);
});
