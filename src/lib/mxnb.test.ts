import assert from "node:assert/strict";
import test from "node:test";
import { MXNB_MINT, parseMxnb } from "./mxnb.ts";

const mint = (supply: string, paused = false, program = "spl-token-2022") => ({
  result: {
    value: {
      data: {
        program,
        parsed: {
          info: {
            decimals: 6,
            supply,
            extensions: [{ extension: "pausableConfig", state: { paused } }],
          },
        },
      },
    },
  },
});

test("an empty Token-2022 mint stays empty", () => {
  const row = parseMxnb(mint("0"));
  assert.equal(row.ok, true);
  if (!row.ok) return;
  assert.equal(row.mint, MXNB_MINT);
  assert.equal(row.supply, 0);
  assert.equal(row.paused, false);
  assert.equal(row.token2022, true);
});

test("raw supply uses the mint decimals", () => {
  const row = parseMxnb(mint("2500000", true));
  assert.equal(row.ok, true);
  if (!row.ok) return;
  assert.equal(row.supply, 2.5);
  assert.equal(row.paused, true);
});

test("a classic SPL mint is not called Token-2022", () => {
  const row = parseMxnb(mint("0", false, "spl-token"));
  assert.equal(row.ok, true);
  if (!row.ok) return;
  assert.equal(row.token2022, false);
});

test("a missing account is not a zero balance", () => {
  assert.deepEqual(parseMxnb({ result: { value: null } }), { ok: false });
});
