import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { livePlan, noteSend, noteSleeve, OPEN_PLAN, proposeSend, proposeSleeve, sendRoom } from "./money-plan.ts";

const NOW = new Date("2026-11-16T18:00:00Z");
const ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

describe("money plan", () => {
  it("refuses a send that breaks the cash floor or the month", () => {
    const plan = { ...OPEN_PLAN, month: "2026-11", cashFloor: 40, monthSend: 25, sent: 20 };
    const floor = proposeSend({ plan, cap: 100, pocket: 42, usd: 5, to: ADDR, memo: "Rent", now: NOW });
    assert.equal(floor.ok, false);
    if (!floor.ok) assert.match(floor.error, /cash floor/);
    const month = proposeSend({ plan, cap: 100, pocket: 200, usd: 10, to: ADDR, memo: "Rent", now: NOW });
    assert.equal(month.ok, false);
    if (!month.ok) assert.match(month.error, /left this month/);
    const ok = proposeSend({ plan, cap: 100, pocket: 200, usd: 5, to: ADDR, memo: "Rent", now: NOW });
    assert.equal(ok.ok, true);
    const chain = proposeSend({ plan: { ...OPEN_PLAN, month: "2026-11", cashFloor: 0 }, cap: 100, pocket: 0, usd: 5, to: ADDR, memo: "Rent", now: NOW });
    assert.equal(chain.ok, true);
  });

  it("resets the month and refuses a blank memo or a bad address", () => {
    const plan = { ...OPEN_PLAN, month: "2026-10", monthSend: 30, sent: 30 };
    assert.equal(sendRoom(plan, 100, NOW), 30);
    const blank = proposeSend({ plan, cap: 100, pocket: 100, usd: 5, to: ADDR, memo: "  ", now: NOW });
    assert.equal(blank.ok, false);
    const addr = proposeSend({ plan, cap: 100, pocket: 100, usd: 5, to: "not-an-address", memo: "Rent", now: NOW });
    assert.equal(addr.ok, false);
    const rolled = livePlan(plan, NOW);
    assert.equal(rolled.sent, 0);
    assert.equal(noteSend(plan, 5, NOW).sent, 5);
  });

  it("keeps the stock sleeve on one symbol and under its month", () => {
    const plan = { ...OPEN_PLAN, month: "2026-11", sleeveSymbol: "SPYX", sleeveMonth: 40, sleeveSpent: 30 };
    const other = proposeSleeve({ plan, cap: 100, symbol: "AAPLx", usd: 5, now: NOW });
    assert.equal(other.ok, false);
    const over = proposeSleeve({ plan, cap: 100, symbol: "SPYx", usd: 20, now: NOW });
    assert.equal(over.ok, false);
    const halted = proposeSleeve({ plan, cap: 100, symbol: "SPYx", usd: 5, halted: true, now: NOW });
    assert.equal(halted.ok, false);
    const ok = proposeSleeve({ plan, cap: 100, symbol: "spyx", usd: 5, now: NOW });
    assert.equal(ok.ok, true);
    assert.equal(noteSleeve(plan, 5, NOW).sleeveSpent, 35);
  });
});
