import assert from "node:assert/strict";
import test from "node:test";
import { fundData, packTreasury, unpackTreasury } from "./treasury-ix.ts";

test("the account matches the native layout and a zero fund is refused", () => {
  const packed = packTreasury({
    bump: 2,
    spendOpen: false,
    authority: new Uint8Array(32).fill(1),
    funded: 1000n,
    fundCount: 1n,
    lastFunder: new Uint8Array(32).fill(2),
  });
  assert.equal(String.fromCharCode(...packed.subarray(0, 8)), "SENDATRY");
  assert.deepEqual([...packed.subarray(0, 12)], [83, 69, 78, 68, 65, 84, 82, 89, 1, 2, 0, 0]);
  assert.equal(packed[44], 0xe8);
  assert.equal(packed[45], 0x03);
  const read = unpackTreasury(packed);
  assert.equal(read?.spendOpen, false);
  assert.equal(read?.funded, 1000n);
  assert.equal(fundData(0n), null);
  assert.equal(fundData(1000n)?.[0], 1);
});
