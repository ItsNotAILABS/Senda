import assert from "node:assert/strict";
import test from "node:test";
import { settle } from "../src/lib/pro-desk.ts";

const risk = { maxTradeUsd: 5, maxImpact: 1 };

test("a sell is released and the earlier buy is kept", () => {
  const result = settle(
    [
      { id: "sell", symbol: "SOL", side: "sell", usd: 1, status: "queued", at: "2026-10-26T01:00:00.000Z" },
      { id: "late", symbol: "SOL", side: "buy", usd: 1, status: "queued", at: "2026-10-26T02:00:00.000Z" },
      { id: "early", symbol: "SOL", side: "buy", usd: 2, status: "queued", at: "2026-10-26T00:00:00.000Z" },
      { id: "big", symbol: "ETH", side: "buy", usd: 25, status: "queued", at: "2026-10-26T00:00:00.000Z" },
    ],
    risk,
  );
  assert.deepEqual(result.sign.map((row) => row.id), ["early"]);
  assert.deepEqual(result.release.map((row) => row.id).sort(), ["big", "late", "sell"]);
});
