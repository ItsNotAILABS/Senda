import test from "node:test";
import assert from "node:assert/strict";
import { verifiedSendReceipt } from "../src/lib/verified-send-receipt.mjs";

const owner = "6".repeat(44), to = "7".repeat(44), sig = "8".repeat(88);
const row = { owner, signature:sig, kind:"send",asset:"USDC",status:"confirmed",
  amountRaw:"12340000",destination:to };
const read = changes => verifiedSendReceipt({ owner,signature:sig,rows:[{...row,...changes}] });

test("receipt uses verified journal provenance, never mutable form data", () => {
  assert.deepEqual(read({}),{signature:sig,cents:1234,to});
  assert.equal(read({status:"finalized"}).cents,1234);
});
test("reject pending and failed transfer statuses", () => {
  for (const status of ["pending","failed","unknown",null])
    assert.throws(()=>read({status}),/CONFIRMED_TRANSFER_EVIDENCE_INVALID/);
});
test("reject wallet, signature and asset mismatch", () => {
  for (const changes of [{owner:"9".repeat(44)},{signature:"4".repeat(88)},
      {asset:"SOL"},{kind:"swap"}])
    assert.throws(()=>read(changes),/CONFIRMED_TRANSFER_EVIDENCE_MISSING/);
});
test("reject missing, duplicated and malformed journal rows", () => {
  assert.throws(()=>verifiedSendReceipt({owner,signature:sig,rows:[]}));
  assert.throws(()=>verifiedSendReceipt({owner,signature:sig,rows:[row,row]}));
  assert.throws(()=>read({destination:"bad"}));
  assert.throws(()=>verifiedSendReceipt({owner,signature:"bad",rows:[row]}));
});
test("amounts must use exact USDC cents and safe integer limits", () => {
  for (const amountRaw of ["1","12340001","0","-10000","90071992547409930000"])
    assert.throws(()=>read({amountRaw}));
  assert.equal(read({amountRaw:"10000"}).cents,1);
});
