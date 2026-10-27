import test from "node:test";
import assert from "node:assert/strict";
import { admit, emptyBook, liquidFirst } from "../src/lib/liq-router.ts";

test("a size over 5 percent of a known pool is refused", () => {
  assert.equal(admit(10, 100).ok, false);
  assert.equal(admit(10, 0).ok, true);
  assert.equal(admit(10, 10_000).ok, true);
});

test("the deeper pool sorts first", () => {
  const rows = liquidFirst(
    [
      { id: "thin", liquidity: 1_000, last: 1 },
      { id: "deep", liquidity: 500_000, last: 1 },
    ],
    25,
  );
  assert.equal(rows[0].id, "deep");
});

test("an empty futures book says it is not a share", () => {
  assert.match(emptyBook("bids"), /not a share/);
});
