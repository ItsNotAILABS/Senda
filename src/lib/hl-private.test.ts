import assert from "node:assert/strict";
import test from "node:test";
import { dayChange, impliedValue, markText, parseDay, parseDayRange, privateBook } from "./hl-private.ts";

test("the share book and the valuation book are not the same Anthropic", () => {
  const share = privateBook("xyz:ANT");
  const value = privateBook("io:ANTH");
  assert.equal(share?.unit, "share");
  assert.equal(value?.unit, "valuation");
  assert.equal(share?.name, "Anthropic");
  assert.equal(value?.name, "Anthropic");
  assert.match(value?.line || "", /1,700/);
  assert.equal(privateBook("xyz:NVDA"), null);
});

test("1,700 is $1.70 trillion, not a share price", () => {
  assert.equal(impliedValue(1700), "$1.70T implied");
  assert.equal(impliedValue(1727.4), "$1.73T implied");
  assert.equal(impliedValue(800), "$800B implied");
  assert.equal(markText(1727.4, "valuation"), "1,727.4");
  assert.equal(markText(97.469, "share"), "$97.47");
  assert.equal(impliedValue(0), "");
});

test("a day range uses the high and the low, and a broken bar is not a range", () => {
  assert.deepEqual(parseDayRange([{ h: "99.5", l: "96.035", c: "97" }, { h: "98", l: "97", c: "97.5" }]), { high: 99.5, low: 96.035 });
  assert.deepEqual(parseDay([{ h: "99.5", l: "96.035", c: "97.2" }, { c: "0", h: "98", l: "97" }])?.points, [97.2]);
  assert.equal(parseDayRange([]), null);
  assert.equal(parseDayRange([{ h: "0", l: "10" }]), null);
});

test("a share move is dollars, a valuation move is not a share price", () => {
  assert.equal(dayChange(97.469, 96.445, "share")?.text, "+$1.024 (+1.06%)");
  assert.equal(dayChange(1730.5, 1693.8, "valuation")?.text, "+36.7 · $37B · +2.17%");
  assert.equal(dayChange(2109.5, 2109.5, "valuation")?.text, "unchanged");
  assert.equal(privateBook("xyz:NVDA"), null);
});
