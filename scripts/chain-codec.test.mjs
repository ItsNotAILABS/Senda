import assert from "node:assert/strict";
import test from "node:test";
import { coverMemo, payMemo, transferData } from "../src/lib/chain-codec.ts";

test("one dollar matches the rust transfer", () => {
  const data = transferData(1_000_000n);
  assert.deepEqual([...data], [3, 0x40, 0x42, 0x0f, 0, 0, 0, 0, 0]);
  assert.equal(payMemo(1, "ref11111111111111111111111111111111"), "Senda USDC 1.00 ref=ref11111111111111111111111111111111");
});

test("a drop cover matches the rust memo", () => {
  assert.equal(
    coverMemo({ kind: "drop", symbol: "openai", strikeUsd: 12.5, coverUsd: 100, premiumUsd: 4, until: 1_700_000_000 }),
    "Senda cover drop OPENAI strike=12500000 cover=100000000 premium=4000000 until=1700000000",
  );
});
